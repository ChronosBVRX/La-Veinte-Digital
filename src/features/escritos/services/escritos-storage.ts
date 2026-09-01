/**
 * Almacenamiento local aislado por usuario para el Generador de Escritos V2.
 * La Veinte Digital
 */

import {
  isEscritoDraftV2,
  migrateLegacyEscritoToV2,
  nuevoIdEscrito,
  type EscritoDraftV2,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"
import { deleteEscritoBlobs } from "./escritos-indexeddb"

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

/**
 * Migra de forma única e irreversible los escritos legados globales al primer usuario autenticado.
 * Elimina la clave global para que un segundo usuario nunca reciba los documentos del primero.
 */
export function migrarEscritosLegadosSiEsNecesario(userId: string): void {
  if (typeof window === "undefined" || !userId || userId === "anonymous") return

  // Si ya fue migrado a algún usuario, no volver a migrar
  const alreadyMigratedTo = localStorage.getItem(MIGRATION_FLAG_KEY)
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!legacyRaw) {
    if (!alreadyMigratedTo) {
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
    }
    return
  }

  try {
    const legacyParsed = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed) || legacyParsed.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.setItem(MIGRATION_FLAG_KEY, userId)
      return
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

    for (const item of legacyParsed) {
      if (!item || typeof item !== "object" || !item.id) continue
      if (existingIds.has(item.id)) continue

      if (isEscritoDraftV2(item)) {
        userList.push({ ...item, ownerId: userId })
        existingIds.add(item.id)
      } else {
        const migrated = migrateLegacyEscritoToV2(item as LegacyEscritoV1, userId)
        userList.push(migrated)
        existingIds.add(migrated.id)
      }
    }

    // Guardar en la clave privada del usuario
    localStorage.setItem(userKey, JSON.stringify(userList))

    // Eliminar la clave global para garantizar que nadie más la lea
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.setItem(MIGRATION_FLAG_KEY, userId)
  } catch (e) {
    console.warn("[escritos-storage] Error durante la migración de escritos legados:", e)
  }
}

/**
 * Sanitiza un borrador antes de guardarlo en localStorage, asegurando que no se guarden
 * URLs blob en memoria ni strings gigantes base64.
 */
function sanitizarParaLocalStorage(draft: EscritoDraftV2): EscritoDraftV2 {
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
  if (userId && userId !== "anonymous") {
    migrarEscritosLegadosSiEsNecesario(userId)
  }

  const key = getStorageKey(userId)
  const raw = localStorage.getItem(key)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const validList: EscritoDraftV2[] = []
    for (const item of parsed) {
      if (isEscritoDraftV2(item)) {
        // Validación estricta de propiedad
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
 * Duplica un escrito como nueva plantilla borrador.
 */
export function duplicarEscrito(id: string, userId?: string): EscritoDraftV2 | null {
  const original = getEscritoById(id, userId)
  if (!original) return null

  const now = new Date().toISOString()
  const duplicado: EscritoDraftV2 = {
    ...original,
    id: nuevoIdEscrito(),
    titulo: `Copia de ${original.titulo}`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }

  guardarEscrito(duplicado, userId)
  return duplicado
}

/**
 * Elimina un escrito del usuario y purga todos sus recursos binarios de IndexedDB.
 */
export function eliminarEscrito(id: string, userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const owner = userId || "anonymous"
  const key = getStorageKey(owner)
  const list = getEscritosGuardados(owner).filter((e) => e.id !== id)

  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.error("[escritos-storage] Error eliminando escrito:", e)
  }

  // Purga de IndexedDB en segundo plano
  deleteEscritoBlobs(owner, id).catch((err) => {
    console.warn("[escritos-storage] Error purgando blobs de IndexedDB:", err)
  })

  return list
}
