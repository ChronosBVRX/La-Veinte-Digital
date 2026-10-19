/**
 * Servicio de persistencia para Documentos Normativos en la Bóveda de Documentos.
 * Permite guardar, listar y eliminar documentos normativos (CCT, Estatutos, Reglamentos,
 * Procedimientos IMSS y NOMs) en el almacenamiento del trabajador.
 */

export interface SavedNormativaDoc {
  id: string
  key?: string | null
  title: string
  category?: string
  url?: string | null
  fileSize?: number
  versionLabel?: string
  savedAt: number
}

const STORAGE_PREFIX = "lvd_normativa_vault_"

export function getSavedNormativaDocs(userId?: string | null): SavedNormativaDoc[] {
  if (typeof window === "undefined") return []
  const storageKey = `${STORAGE_PREFIX}${userId || "anonymous"}`
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveNormativaToVault(
  doc: {
    id: string
    key?: string | null
    title: string
    category?: string
    url?: string | null
    fileSize?: number
    versionLabel?: string
  },
  userId?: string | null
): SavedNormativaDoc {
  const existing = getSavedNormativaDocs(userId)
  const filtered = existing.filter((d) => d.id.toLowerCase() !== doc.id.toLowerCase())
  const item: SavedNormativaDoc = {
    id: doc.id,
    key: doc.key ?? null,
    title: doc.title,
    category: doc.category,
    url: doc.url ?? null,
    fileSize: doc.fileSize,
    versionLabel: doc.versionLabel,
    savedAt: Date.now(),
  }
  const updated = [item, ...filtered]

  if (typeof window !== "undefined") {
    try {
      const storageKey = `${STORAGE_PREFIX}${userId || "anonymous"}`
      localStorage.setItem(storageKey, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent("lvd:normativa-vault-changed", { detail: { id: doc.id } }))
    } catch (err) {
      console.warn("[normativa-boveda] Error al guardar documento en bóveda:", err)
    }
  }

  return item
}

export function removeSavedNormativaDoc(id: string, userId?: string | null): boolean {
  const existing = getSavedNormativaDocs(userId)
  const updated = existing.filter((d) => d.id.toLowerCase() !== id.toLowerCase())

  if (typeof window !== "undefined") {
    try {
      const storageKey = `${STORAGE_PREFIX}${userId || "anonymous"}`
      localStorage.setItem(storageKey, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent("lvd:normativa-vault-changed", { detail: { id } }))
      return true
    } catch {
      return false
    }
  }

  return false
}

export function isNormativaInVault(id: string, userId?: string | null): boolean {
  const existing = getSavedNormativaDocs(userId)
  return existing.some((d) => d.id.toLowerCase() === id.toLowerCase())
}
