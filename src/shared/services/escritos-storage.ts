/**
 * Servicio compartido de almacenamiento local para escritos V2.
 * Aislado estrictamente por usuario en localStorage.
 * Las firmas y fotos se guardan en IndexedDB (shared/services/blob-storage).
 * Implementa una migración de dos fases, idempotente y recuperable con journal por usuario.
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
  getBlobResource,
  deleteBlobResource,
  dataUrlToBlob,
} from "@/shared/services/blob-storage"

export const STORAGE_PREFIX = "la_veinte_escritos_v2"
export const LEGACY_STORAGE_KEY = "escritos_guardados"
export const MIGRATION_FLAG_KEY = "escritos_guardados_migrated_to"

export type MigrationJournalState = "pending" | "blobs_verified" | "metadata_committed" | "completed"

export interface MigrationJournal {
  userId: string
  state: MigrationJournalState
  startedAt: string
  updatedAt: string
  blobKeys: string[]
  draftsCount: number
}

export function getStorageKey(userId?: string): string {
  const safeUser = userId && userId.trim() ? userId.trim() : "anonymous"
  return `${STORAGE_PREFIX}_${safeUser}`
}

export function getJournalKey(userId: string): string {
  const safeUser = userId.trim() || "anonymous"
  return `${STORAGE_PREFIX}_journal_${safeUser}`
}

export function getMigrationJournal(userId: string): MigrationJournal | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getJournalKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as MigrationJournal
  } catch {
    return null
  }
}

export function saveMigrationJournal(journal: MigrationJournal): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getJournalKey(journal.userId), JSON.stringify(journal))
  } catch (e) {
    console.warn("[escritos-storage] No se pudo guardar journal de migración:", e)
  }
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
 * Genera una representación serializada canónica y estable del borrador para
 * detección precisa de cambios sin guardar (isDirty), ignorando campos volátiles (URLs blob:).
 */
export function serializePersistableDraft(draft: EscritoDraftV2): string {
  return JSON.stringify({
    tipo: draft.tipo || "solicitud",
    titulo: (draft.titulo || "").trim(),
    asunto: (draft.asunto || "").trim(),
    destino: {
      nombre: (draft.destino?.nombre || "").trim(),
      cargo: (draft.destino?.cargo || "").trim(),
    },
    ciudad: (draft.ciudad || "").trim(),
    fecha: (draft.fecha || "").trim(),
    hechos: (draft.hechos || "").trim(),
    peticion: (draft.peticion || "").trim(),
    cuerpo: (draft.cuerpo || "").trim(),
    firmaRef: (draft.firmaRef || "").trim(),
    incluirFundamentos: Boolean(draft.incluirFundamentos),
    atencion: (draft.atencion || []).map((a) => ({
      nombre: (a.nombre || "").trim(),
      cargo: (a.cargo || "").trim(),
    })),
    copias: (draft.copias || []).map((c) => ({
      nombre: (c.nombre || "").trim(),
      cargo: (c.cargo || "").trim(),
    })),
    anexos: (draft.anexos || []).map((anx) => ({
      id: anx.id,
      nombre: anx.nombre.trim(),
      descripcion: (anx.descripcion || "").trim(),
      tipo: anx.tipo,
      size: anx.size,
      storageRef: anx.storageRef,
    })),
  })
}

/**
 * Migración de dos fases, idempotente y recuperable para escritos legados (V1 -> V2).
 * Fase 1: Guarda firmas y fotos en IndexedDB y verifica inmediatamente su lectura (read-back).
 * Fase 2: Compromete los metadatos en localStorage del usuario.
 * Si ocurre un error antes de comprometer metadatos, revierte los blobs creados.
 * Si los metadatos ya fueron comprometidos, no destruye los blobs y completa el proceso en el reintento.
 */
export async function migrarEscritosLegadosSiEsNecesario(
  userId: string
): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  if (typeof window === "undefined") return { success: true, migratedCount: 0 }

  const now = new Date().toISOString()
  let journal = getMigrationJournal(userId)

  // Si ya se había completado la migración para este usuario
  if (journal && journal.state === "completed") {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.setItem(MIGRATION_FLAG_KEY, userId)
    return { success: true, migratedCount: journal.draftsCount }
  }

  // Si los metadatos ya fueron comprometidos en un intento previo que falló al limpiar la clave global
  if (journal && journal.state === "metadata_committed") {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
      journal.state = "completed"
      journal.updatedAt = now
      saveMigrationJournal(journal)
      return { success: true, migratedCount: journal.draftsCount }
    } catch (e) {
      return {
        success: false,
        migratedCount: journal.draftsCount,
        error: e instanceof Error ? e.message : "Error completando limpieza de migración previa.",
      }
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    if (!journal) {
      saveMigrationJournal({
        userId,
        state: "completed",
        startedAt: now,
        updatedAt: now,
        blobKeys: [],
        draftsCount: 0,
      })
    }
    return { success: true, migratedCount: 0 }
  }

  let legacyParsed: unknown
  try {
    legacyParsed = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed) || legacyParsed.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
      saveMigrationJournal({
        userId,
        state: "completed",
        startedAt: now,
        updatedAt: now,
        blobKeys: [],
        draftsCount: 0,
      })
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

  // Inicializar journal en pending
  journal = {
    userId,
    state: "pending",
    startedAt: now,
    updatedAt: now,
    blobKeys: [],
    draftsCount: 0,
  }
  saveMigrationJournal(journal)

  try {
    // ── FASE 1: Guardado y Verificación Read-back de Blobs en IndexedDB ──
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

        // Read-back verification
        const verifiedFirma = await getBlobResource(userId, firmaRef)
        if (!verifiedFirma || verifiedFirma.size === 0) {
          throw new Error(`Verificación fallida al releer la firma migrada (${firmaRef}).`)
        }

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

            // Read-back verification
            const verifiedPhoto = await getBlobResource(userId, photoRef)
            if (!verifiedPhoto || verifiedPhoto.size === 0) {
              throw new Error(`Verificación fallida al releer la foto migrada ${i + 1} (${photoRef}).`)
            }

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

    // Blobs verificados
    journal.state = "blobs_verified"
    journal.blobKeys = createdBlobKeys
    journal.draftsCount = newMigratedDrafts.length
    journal.updatedAt = new Date().toISOString()
    saveMigrationJournal(journal)

    // ── FASE 2: Compromiso de Metadatos en localStorage y Finalización ──
    const finalList = [...newMigratedDrafts, ...userList]
    localStorage.setItem(userKey, JSON.stringify(finalList.map(sanitizarParaLocalStorage)))

    journal.state = "metadata_committed"
    journal.updatedAt = new Date().toISOString()
    saveMigrationJournal(journal)

    // Limpieza atómica de la clave global únicamente tras confirmación de metadatos
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.setItem(MIGRATION_FLAG_KEY, userId)

    journal.state = "completed"
    journal.updatedAt = new Date().toISOString()
    saveMigrationJournal(journal)

    return {
      success: true,
      migratedCount: newMigratedDrafts.length,
    }
  } catch (err) {
    console.error("[escritos-storage] Error en migración recuperable:", err)

    // Si el error ocurrió antes de escribir metadatos (state = 'pending' o 'blobs_verified')
    if (journal.state === "pending" || journal.state === "blobs_verified") {
      // Rollback seguro de blobs creados para evitar fugas en IndexedDB
      for (const key of createdBlobKeys) {
        await deleteBlobResource(userId, key).catch(() => {})
      }
      // Conservar LEGACY_STORAGE_KEY intacto para permitir reintento
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
