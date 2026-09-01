/**
 * Almacenamiento local aislado por usuario para el Generador de Escritos V2.
 * Soporta migración transaccional de dos fases para fotos y firmas legadas.
 * La Veinte Digital
 */

import {
  isEscritoDraftV2,
  migrateLegacyEscritoToV2,
  nuevoIdEscrito,
  type EscritoDraftV2,
  type LegacyEscritoV1,
  type AnexoItem,
} from "@/shared/contracts/escrito-draft"
import {
  deleteEscritoBlobs,
  deleteBlobResource,
  duplicateEscritoBlobs,
  saveBlobResource,
  dataUrlToBlob,
} from "./escritos-indexeddb"

export { nuevoIdEscrito }

export type EscritoGuardado = EscritoDraftV2

const LEGACY_STORAGE_KEY = "escritos_guardados"
const MIGRATION_FLAG_KEY = "escritos_guardados_migrated_to"

export function getStorageKey(userId?: string): string {
  if (!userId || userId === "anonymous") {
    return "escritos_guardados_anonymous"
  }
  return `escritos_guardados_${encodeURIComponent(userId)}`
}

export interface MigrationResult {
  success: boolean
  migratedCount: number
  error?: string
}

/**
 * Migración transaccional de dos fases:
 * Fase 1: Convierte metadatos y migra fotos/firmaUrl a Blobs en IndexedDB.
 * Fase 2: Guarda en la clave privada del usuario.
 * Solo si todo tiene éxito, elimina la clave global y marca como migrado.
 * En caso de fallo, hace rollback de los blobs creados y permite reintento.
 */
export async function migrarEscritosLegadosSiEsNecesario(
  userId: string
): Promise<MigrationResult> {
  if (typeof window === "undefined" || !userId || userId === "anonymous") {
    return { success: true, migratedCount: 0 }
  }

  const alreadyMigratedTo = localStorage.getItem(MIGRATION_FLAG_KEY)
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!legacyRaw) {
    if (!alreadyMigratedTo) {
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
    }
    return { success: true, migratedCount: 0 }
  }

  let legacyParsed: unknown[]
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

    // Rollback de blobs creados en IndexedDB
    for (const key of createdBlobKeys) {
      await deleteBlobResource(userId, key).catch(() => {})
    }

    return {
      success: false,
      migratedCount: 0,
      error: err instanceof Error ? err.message : "Error durante la migración.",
    }
  }
}

/**
 * Sanitiza un borrador antes de guardarlo en localStorage, asegurando que no se guarden
 * URLs blob en memoria ni strings gigantes base64.
 */
export function sanitizarParaLocalStorage(draft: EscritoDraftV2): EscritoDraftV2 {
  return {
    ...draft,
    firmaPreviewUrl: undefined,
    anexos: draft.anexos.map((anexo) => ({
      ...anexo,
      previewUrl: undefined,
    })),
  }
}

/**
 * Obtiene todos los escritos guardados correspondientes estrictamente al usuario activo.
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
        if (!userId || userId === "anonymous" || item.ownerId === userId) {
          validList.push(item)
        }
      } else if (item && typeof item === "object" && item.id) {
        validList.push(migrateLegacyEscritoToV2(item as LegacyEscritoV1, userId ?? "anonymous"))
      }
    }

    return validList.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  } catch {
    return []
  }
}

/**
 * Obtiene un escrito por ID validando la pertenencia al usuario.
 */
export function getEscritoById(id: string, userId?: string): EscritoDraftV2 | null {
  const list = getEscritosGuardados(userId)
  return list.find((e) => e.id === id) || null
}

/**
 * Guarda o actualiza un escrito en el almacenamiento del usuario.
 * Preserva de forma inmutable id, createdAt y ownerId si ya existía.
 */
export function guardarEscrito(draft: EscritoDraftV2, userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const owner = userId || draft.ownerId || "anonymous"
  const key = getStorageKey(owner)
  const list = getEscritosGuardados(owner)
  const now = new Date().toISOString()

  const draftToSave: EscritoDraftV2 = sanitizarParaLocalStorage({
    ...draft,
    ownerId: owner,
    updatedAt: now,
  })

  const index = list.findIndex((e) => e.id === draftToSave.id)
  if (index >= 0) {
    const existing = list[index]
    if (existing) {
      draftToSave.createdAt = existing.createdAt
      draftToSave.titulo = draft.titulo || existing.titulo
    }
    list[index] = draftToSave
  } else {
    draftToSave.createdAt = draft.createdAt || now
    list.unshift(draftToSave)
  }

  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e: unknown) {
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
  } catch (err) {
    console.warn("[escritos-storage] Error purgando blobs de IndexedDB:", err)
  }

  return list
}
