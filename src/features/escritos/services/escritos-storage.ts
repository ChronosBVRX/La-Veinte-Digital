import {
  isEscritoDraftV2,
  migrateLegacyEscritoToV2,
  type EscritoDraftV2,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"

const LEGACY_STORAGE_KEY = "escritos_guardados"

export type EscritoGuardado = EscritoDraftV2

export function getStorageKey(userId?: string): string {
  if (!userId || userId === "anonymous") return LEGACY_STORAGE_KEY
  return `escritos_guardados_${userId}`
}

export function nuevoIdEscrito(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Migra automáticamente los escritos de la clave global anterior "escritos_guardados"
 * a la clave aislada por usuario "escritos_guardados_${userId}".
 * Es completamente idempotente.
 */
export function migrarEscritosLegadosSiEsNecesario(userId: string): void {
  if (typeof window === "undefined" || !userId || userId === "anonymous") return

  const userKey = getStorageKey(userId)
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) return

  try {
    const legacyParsed = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed) || legacyParsed.length === 0) return

    const userRaw = localStorage.getItem(userKey)
    let userList: EscritoDraftV2[] = []
    if (userRaw) {
      try {
        const parsed = JSON.parse(userRaw)
        if (Array.isArray(parsed)) {
          userList = parsed.filter(isEscritoDraftV2)
        }
      } catch {
        userList = []
      }
    }

    const existingIds = new Set(userList.map((e) => e.id))
    let addedCount = 0

    for (const item of legacyParsed) {
      if (!item || typeof item !== "object" || !item.id) continue
      if (existingIds.has(item.id)) continue

      if (isEscritoDraftV2(item)) {
        userList.push({ ...item, ownerId: userId })
        existingIds.add(item.id)
        addedCount++
      } else {
        const migrated = migrateLegacyEscritoToV2(item as LegacyEscritoV1, userId)
        userList.push(migrated)
        existingIds.add(migrated.id)
        addedCount++
      }
    }

    if (addedCount > 0) {
      localStorage.setItem(userKey, JSON.stringify(userList))
    }
  } catch (e) {
    console.warn("[escritos-storage] Error durante la migración de escritos legados:", e)
  }
}

export function getEscritosGuardados(userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []
  if (userId) {
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
        validList.push(item)
      } else if (item && typeof item === "object" && item.id) {
        // Fallback resiliente para migrar al vuelo si algún registro es formato V1
        validList.push(migrateLegacyEscritoToV2(item as LegacyEscritoV1, userId ?? "anonymous"))
      }
    }

    // Ordenar de más reciente a más antiguo
    return validList.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  } catch {
    return []
  }
}

export function getEscritoById(id: string, userId?: string): EscritoDraftV2 | null {
  const list = getEscritosGuardados(userId)
  return list.find((e) => e.id === id) ?? null
}

export function guardarEscrito(escrito: EscritoDraftV2, userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const owner = userId || escrito.ownerId || "anonymous"
  const key = getStorageKey(owner)
  const list = getEscritosGuardados(owner)

  const now = new Date().toISOString()
  const idx = list.findIndex((e) => e.id === escrito.id)

  const draftToSave: EscritoDraftV2 = {
    ...escrito,
    schemaVersion: 2,
    ownerId: owner,
    createdAt: idx >= 0 && list[idx].createdAt ? list[idx].createdAt : (escrito.createdAt || now),
    updatedAt: now,
  }

  if (idx >= 0) {
    list[idx] = draftToSave
  } else {
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
        "El almacenamiento del dispositivo está lleno. Elimina algunos escritos o fotografías para liberar espacio."
      )
    }
    throw e
  }

  return list
}

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

export function eliminarEscrito(id: string, userId?: string): EscritoDraftV2[] {
  if (typeof window === "undefined") return []

  const key = getStorageKey(userId)
  const list = getEscritosGuardados(userId).filter((e) => e.id !== id)
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.error("[escritos-storage] Error eliminando escrito:", e)
  }
  return list
}
