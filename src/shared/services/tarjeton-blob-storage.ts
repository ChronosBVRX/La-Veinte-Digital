/**
 * Servicio IndexedDB para almacenamiento y recuperación de archivos PDF de tarjetón.
 * Permite que el botón "Reintentar análisis" recupere el PDF original del dispositivo
 * y vuelva a ejecutar la extracción sin obligar al usuario a subir el archivo otra vez.
 * La Veinte Digital
 */

const DB_NAME = "la_veinte_tarjeton_blobs_db"
const DB_VERSION = 1
const STORE_NAME = "tarjeton_files"

interface TarjetonBlobRecord {
  key: string
  blob: Blob
  fileName?: string
  fileSize: number
  mimeType: string
  updatedAt: string
}

function openTarjetonDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este entorno."))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Error abriendo base de tarjetones."))
  })
}

function sanitizeKey(key: string): string {
  return key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_")
}

/**
 * Guarda un PDF de tarjetón en IndexedDB asociado a su periodo o hash.
 */
export async function saveTarjetonPdfBlob(
  key: string,
  blobOrFile: Blob | File,
  fileName?: string,
): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return
  const safeKey = sanitizeKey(key)
  if (!safeKey) return

  const db = await openTarjetonDatabase()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)

      const record: TarjetonBlobRecord = {
        key: safeKey,
        blob: blobOrFile,
        fileName: fileName ?? ("name" in blobOrFile ? blobOrFile.name : "tarjeton.pdf"),
        fileSize: blobOrFile.size,
        mimeType: blobOrFile.type || "application/pdf",
        updatedAt: new Date().toISOString(),
      }

      store.put(record)

      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error || new Error("Error guardando PDF en IndexedDB."))
      }
      tx.onabort = () => {
        db.close()
        reject(new Error("Transacción abortada."))
      }
    } catch (err) {
      db.close()
      reject(err)
    }
  })
}

/**
 * Recupera el File o Blob del tarjetón original guardado en el dispositivo.
 */
export async function getTarjetonPdfBlob(key: string): Promise<File | null> {
  if (typeof window === "undefined" || !window.indexedDB) return null
  const safeKey = sanitizeKey(key)
  if (!safeKey) return null

  try {
    const db = await openTarjetonDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(safeKey)

        getReq.onsuccess = () => {
          db.close()
          const record = getReq.result as TarjetonBlobRecord | undefined
          if (!record || !record.blob) {
            resolve(null)
            return
          }
          if (record.blob instanceof File) {
            resolve(record.blob)
          } else {
            const file = new File([record.blob], record.fileName || "tarjeton.pdf", {
              type: record.mimeType || "application/pdf",
            })
            resolve(file)
          }
        }

        getReq.onerror = () => {
          db.close()
          resolve(null)
        }
      } catch {
        db.close()
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

/**
 * Verifica si existe un PDF guardado para la clave.
 */
export async function hasTarjetonPdfBlob(key: string): Promise<boolean> {
  const blob = await getTarjetonPdfBlob(key)
  return blob !== null
}

/**
 * Intenta recuperar el PDF probando múltiples claves posibles (periodRaw, documentId, etc.)
 * Si ninguna coincide, busca el registro más recientemente actualizado en IndexedDB.
 */
export async function findTarjetonPdfBlob(candidates: (string | undefined | null)[]): Promise<File | null> {
  for (const c of candidates) {
    if (!c) continue
    const found = await getTarjetonPdfBlob(c)
    if (found) return found
  }

  // Búsqueda del último archivo almacenado como respaldo
  if (typeof window === "undefined" || !window.indexedDB) return null
  try {
    const db = await openTarjetonDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => {
          db.close()
          const records = (req.result || []) as TarjetonBlobRecord[]
          if (records.length === 0) {
            resolve(null)
            return
          }
          // Ordenar por updatedAt descendente
          records.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
          const best = records[0]
          if (!best || !best.blob) {
            resolve(null)
            return
          }
          if (best.blob instanceof File) {
            resolve(best.blob)
          } else {
            resolve(new File([best.blob], best.fileName || "tarjeton.pdf", {
              type: best.mimeType || "application/pdf",
            }))
          }
        }
        req.onerror = () => {
          db.close()
          resolve(null)
        }
      } catch {
        db.close()
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

export interface TarjetonBlobSummary {
  key: string
  fileName?: string
  fileSize: number
  mimeType: string
  updatedAt: string
  blob?: Blob
}

/**
 * Retorna todos los registros de tarjetones guardados en IndexedDB.
 */
export async function listAllTarjetonBlobs(): Promise<TarjetonBlobSummary[]> {
  if (typeof window === "undefined" || !window.indexedDB) return []
  try {
    const db = await openTarjetonDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => {
          db.close()
          const records = (req.result || []) as TarjetonBlobRecord[]
          resolve(records.map((r) => ({
            key: r.key,
            fileName: r.fileName,
            fileSize: r.fileSize,
            mimeType: r.mimeType,
            updatedAt: r.updatedAt,
            blob: r.blob,
          })))
        }
        req.onerror = () => {
          db.close()
          resolve([])
        }
      } catch {
        db.close()
        resolve([])
      }
    })
  } catch {
    return []
  }
}
