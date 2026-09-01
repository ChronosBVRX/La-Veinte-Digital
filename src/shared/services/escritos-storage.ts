/**
 * Servicio compartido de almacenamiento local para escritos V2.
 * Aislado estrictamente por usuario en localStorage.
 * Las firmas y fotos se guardan en IndexedDB (shared/services/blob-storage).
 * La Veinte Digital
 */

import {
  type EscritoDraftV2,
  type LegacyEscritoV1,
  type AnexoItem,
  isEscritoDraftV2,
  migrateLegacyEscritoToV2,
} from "@/shared/contracts/escrito-draft"
import {
  deleteEscritoBlobs,
  duplicateEscritoBlobs,
  saveBlobResource,
  deleteBlobResource,
  dataUrlToBlob,
} from "@/shared/services/blob-storage"

export const STORAGE_PREFIX = "la_veinte_escritos_v2"
export const LEGACY_STORAGE_KEY = "escritos_guardados"
export const MIGRATION_FLAG_KEY = "escritos_guardados_migrated_to"

export function getStorageKey(userId?: string): string {
  const safeUser = userId && userId.trim() ? userId.trim() : "anonymous"
  return `${STORAGE_PREFIX}_${safeUser}`
}

export function nuevoIdEscrito(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Sanitiza un borrador antes de guardarlo en localStorage para asegurar que
 * ninguna cadena base64 pesada o blob URL quede en el almacenamiento síncrono.
 */
export function sanitizarParaLocalStorage(draft: EscritoDraftV2): EscritoDraftV2 {
  return {
    ...draft,
    firmaPreviewUrl: undefined,
    anexos: draft.anexos.map((anx) => ({
      ...anx,
      previewUrl: undefined,
    })),
  }
}

/**
 * Migración transaccional de dos fases para escritos legados (V1 -> V2).
 * Guarda las firmas y fotos como Blobs en IndexedDB antes de eliminar la clave legada.
 * Si ocurre un error, ejecuta un rollback eliminando los blobs creados y conservando los datos originales.
 */
export async function migrarEscritosLegadosSiEsNecesario(
  userId: string
): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  if (typeof window === "undefined") return { success: true, migratedCount: 0 }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    return { success: true, migratedCount: 0 }
  }

  let legacyParsed: unknown
  try {
    legacyParsed = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed) || legacyParsed.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
      return { success: true, migratedCount: 0 }
    }
  } catch (e) {
    console.error("[escritos-storage] JSON legado inválido:", e)
    return { success: false, migratedCount: 0, error: "Formato de datos legados inválido." }
  }

  const userKey = getStorageKey(userId)
  const userRaw = localStorage.getItem(userKey)
  let userList: EscritoDraftV2[] = []
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw)
      if (Array.isArray(parsed)) {
        userList = parsed.filter((item) => isEscritoDraftV2(item) && item.ownerId === userId)
      }
    } catch {
      userList = []
    }
  }

  const existingIds = new Set(userList.map((e) => e.id))
  const createdBlobKeys: string[] = []
  const newMigratedDrafts: EscritoDraftV2[] = []

  try {
    for (const rawItem of legacyParsed) {
      if (!rawItem || typeof rawItem !== "object") continue
      const legacyItem = rawItem as LegacyEscritoV1
      const docId = legacyItem.id || nuevoIdEscrito()
      if (existingIds.has(docId)) continue

      let draft: EscritoDraftV2
      if (isEscritoDraftV2(legacyItem)) {
        draft = { ...legacyItem, ownerId: userId }
      } else {
        draft = migrateLegacyEscritoToV2(legacyItem, userId)
        draft.id = docId
      }

      // Migrar firmaUrl legado a Blob en IndexedDB
      if (legacyItem.firmaUrl && typeof legacyItem.firmaUrl === "string" && legacyItem.firmaUrl.startsWith("data:")) {
        const blob = dataUrlToBlob(legacyItem.firmaUrl)
        const firmaRef = await saveBlobResource(userId, draft.id, "firma", "legacy_sig", blob)
        draft.firmaRef = firmaRef
        createdBlobKeys.push(firmaRef)
      }

      // Migrar fotos legadas a Blobs en IndexedDB
      if (Array.isArray(legacyItem.fotos) && legacyItem.fotos.length > 0) {
        const anexos: AnexoItem[] = [...draft.anexos]
        for (let i = 0; i < legacyItem.fotos.length; i++) {
          const fotoDataUrl = legacyItem.fotos[i]
          if (typeof fotoDataUrl === "string" && fotoDataUrl.startsWith("data:")) {
            const photoBlob = dataUrlToBlob(fotoDataUrl)
            const photoId = `legacy_photo_${i + 1}`
            const photoRef = await saveBlobResource(userId, draft.id, "anexo", photoId, photoBlob)
            createdBlobKeys.push(photoRef)
            anexos.push({
              id: `anx_${photoId}`,
              nombre: `Fotografía adjunta ${i + 1}`,
              descripcion: "Fotografía migrada desde versión anterior",
              tipo: photoBlob.type || "image/jpeg",
              size: photoBlob.size,
              storageRef: photoRef,
            })
          }
        }
        draft.anexos = anexos
      }

      newMigratedDrafts.push(draft)
      existingIds.add(draft.id)
    }

    // Fase 2: Persistencia en localStorage
    const finalList = [...newMigratedDrafts, ...userList]
    localStorage.setItem(userKey, JSON.stringify(finalList.map(sanitizarParaLocalStorage)))

    // Limpieza atómica de la clave global únicamente tras éxito completo
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.setItem(MIGRATION_FLAG_KEY, userId)

    return {
      success: true,
      migratedCount: newMigratedDrafts.length,
    }
  } catch (err) {
    console.error("[escritos-storage] Error en migración transaccional. Ejecutando rollback:", err)

    // Rollback: Eliminar blobs parcialmente creados
    for (const key of createdBlobKeys) {
      await deleteBlobResource(userId, key).catch(() => {})
    }

    return {
      success: false,
      migratedCount: 0,
      error: err instanceof Error ? err.message : "Error durante la migración a IndexedDB.",
    }
  }
}

/**
 * Obtiene la lista de escritos del usuario activo.
 */
export function getEscritosGuardados(userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const key = getStorageKey(userId)
  const raw = localStorage.getItem(key)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const validList: EscritoDraftV2[] = []
    for (const item of parsed) {
      if (isEscritoDraftV2(item)) {
        if (!userId || item.ownerId === userId) {
          validList.push(item)
        }
      } else if (item && typeof item === "object" && "id" in item) {
        const migrated = migrateLegacyEscritoToV2(item as LegacyEscritoV1, userId || "anonymous")
        validList.push(migrated)
      }
    }

    validList.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt).getTime()
      return timeB - timeA
    })

    return validList
  } catch (e) {
    console.error("[escritos-storage] Error al parsear escritos:", e)
    return []
  }
}

/**
 * Obtiene un escrito por su ID.
 */
export function getEscritoById(id: string, userId?: string): EscritoDraftV2 | null {
  const list = getEscritosGuardados(userId)
  return list.find((e) => e.id === id) || null
}

/**
 * Guarda o actualiza un escrito en localStorage del usuario.
 */
export function guardarEscrito(draft: EscritoDraftV2, userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const owner = userId || draft.ownerId || "anonymous"
  const key = getStorageKey(owner)
  const list = getEscritosGuardados(owner)

  const sanitized = sanitizarParaLocalStorage({
    ...draft,
    ownerId: owner,
    updatedAt: new Date().toISOString(),
  })

  const index = list.findIndex((e) => e.id === sanitized.id)
  if (index >= 0) {
    list[index] = sanitized
  } else {
    list.unshift(sanitized)
  }

  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    if (
      e instanceof Error &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        e.message.includes("quota"))
    ) {
      throw new Error(
        "El almacenamiento del dispositivo está lleno. Elimina algunos escritos para liberar espacio."
      )
    }
    throw e
  }

  return list
}

/**
 * Duplica un escrito creando copias físicas independientes de su firma y anexos en IndexedDB.
 */
export async function duplicarEscrito(id: string, userId?: string): Promise<EscritoDraftV2 | null> {
  const original = getEscritoById(id, userId)
  if (!original) return null

  const owner = userId || original.ownerId || "anonymous"
  const newId = nuevoIdEscrito()
  const now = new Date().toISOString()

  try {
    // Clonar físicamente los blobs en IndexedDB
    const refMap = await duplicateEscritoBlobs(owner, original.id, newId)

    let newFirmaRef: string | undefined = undefined
    if (original.firmaRef) {
      newFirmaRef = refMap.get(original.firmaRef)
      if (!newFirmaRef) {
        throw new Error("No se pudo clonar la firma del escrito original.")
      }
    }

    const newAnexos: AnexoItem[] = []
    for (const anx of original.anexos) {
      if (anx.storageRef) {
        const clonedRef = refMap.get(anx.storageRef)
        if (!clonedRef) {
          throw new Error(`No se pudo clonar el anexo fotográfico ${anx.nombre}.`)
        }
        newAnexos.push({
          ...anx,
          id: `anx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          storageRef: clonedRef,
          previewUrl: undefined,
        })
      } else {
        newAnexos.push({
          ...anx,
          id: `anx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          previewUrl: undefined,
        })
      }
    }

    const duplicado: EscritoDraftV2 = {
      ...original,
      id: newId,
      ownerId: owner,
      titulo: `Copia de ${original.titulo}`,
      firmaRef: newFirmaRef,
      firmaPreviewUrl: undefined,
      anexos: newAnexos,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    }

    guardarEscrito(duplicado, owner)
    return duplicado
  } catch (err) {
    console.error("[escritos-storage] Error duplicando escrito:", err)
    await deleteEscritoBlobs(owner, newId).catch(() => {})
    throw err
  }
}

/**
 * Elimina un escrito del usuario y purga todos sus recursos binarios de IndexedDB.
 */
export async function eliminarEscrito(id: string, userId?: string): Promise<EscritoDraftV2[]> {
  if (typeof window === "undefined") return []

  const owner = userId || "anonymous"
  const key = getStorageKey(owner)
  const list = getEscritosGuardados(owner).filter((e) => e.id !== id)

  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.error("[escritos-storage] Error eliminando escrito:", e)
  }

  // Purga de IndexedDB
  try {
    await deleteEscritoBlobs(owner, id)
  } catch (blobErr) {
    console.warn("[escritos-storage] Error eliminando blobs asociados:", blobErr)
  }

  return list
}
