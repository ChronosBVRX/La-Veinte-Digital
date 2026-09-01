/**
 * Capa de almacenamiento en IndexedDB para anexos fotográficos y firmas
 * de los escritos, evitando saturar la cuota de 5MB de localStorage.
 */

const DB_NAME = "la_veinte_escritos_blobs"
const DB_VERSION = 1
const STORE_NAME = "blobs"

const memoryFallback = new Map<string, string>()

function getIDB(): IDBFactory | undefined {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB
  }
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB
  }
  return undefined
}

function openDB(): Promise<IDBDatabase> {
  const idb = getIDB()
  if (!idb) {
    return Promise.reject(new Error("IndexedDB no disponible"))
  }

  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Error abriendo IndexedDB"))
  })
}

export async function saveEscritoBlob(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const req = store.put({ key, dataUrl, savedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    memoryFallback.set(key, dataUrl)
  }
}

export async function getEscritoBlob(key: string): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        if (req.result && typeof req.result.dataUrl === "string") {
          resolve(req.result.dataUrl)
        } else {
          resolve(memoryFallback.get(key) ?? null)
        }
      }
      req.onerror = () => resolve(memoryFallback.get(key) ?? null)
    })
  } catch {
    return memoryFallback.get(key) ?? null
  }
}

export async function deleteEscritoBlob(key: string): Promise<void> {
  memoryFallback.delete(key)
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignorar fallo en fallback
  }
}
