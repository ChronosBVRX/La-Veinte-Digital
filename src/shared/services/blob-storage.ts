/**
 * Servicio IndexedDB para almacenamiento binario (firmas y fotografías)
 * Aislado estrictamente por usuario y por escrito.
 * Todas las operaciones de escritura resuelven estrictamente en tx.oncomplete,
 * manejan tx.onerror y tx.onabort, y cierran la conexión IDB al finalizar.
 * Ubicado en shared/services/blob-storage.ts para cumplir con la arquitectura modular (AGENTS.md).
 * La Veinte Digital
 */

import type { EscritoDraftV2, AnexoItem } from "@/shared/contracts/escrito-draft"

const DB_NAME = "la_veinte_escritos_db"
const DB_VERSION = 1
const STORE_NAME = "escritos_blobs"

export interface BlobRecord {
  /** Clave canónica: `user_${userId}:esc_${escritoId}:${tipo}:${resourceId}` */
  key: string
  userId: string
  escritoId: string
  resourceType: "firma" | "anexo"
  resourceId: string
  mimeType: string
  blob: Blob
  size?: number
  createdAt: string
}

export function openBlobDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este entorno."))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" })
        store.createIndex("by_user", "userId", { unique: false })
        store.createIndex("by_user_escrito", ["userId", "escritoId"], { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Error abriendo IndexedDB."))
  })
}

/**
 * Construye de forma segura e inmutable la clave de almacenamiento.
 */
export function buildBlobKey(
  userId: string,
  escritoId: string,
  resourceType: "firma" | "anexo",
  resourceId: string
): string {
  const safeUser = encodeURIComponent(userId.trim() || "anonymous")
  const safeEscrito = encodeURIComponent(escritoId.trim())
  const safeResId = encodeURIComponent(resourceId.trim())
  return `user_${safeUser}:esc_${safeEscrito}:${resourceType}:${safeResId}`
}

/**
 * Guarda un archivo o firma binaria en IndexedDB.
 * Resuelve ÚNICAMENTE cuando la transacción completa exitosamente (tx.oncomplete).
 * @returns La referencia `storageRef` que se guarda en el borrador (sin base64).
 */
export async function saveBlobResource(
  userId: string,
  escritoId: string,
  resourceType: "firma" | "anexo",
  resourceId: string,
  blobOrFile: Blob | File
): Promise<string> {
  const key = buildBlobKey(userId, escritoId, resourceType, resourceId)
  const db = await openBlobDatabase()

  return new Promise((resolve, reject) => {
    let completed = false
    const closeDb = () => {
      try {
        db.close()
      } catch {
        // noop
      }
    }

    try {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)

      const record: BlobRecord = {
        key,
        userId,
        escritoId,
        resourceType,
        resourceId,
        mimeType:
          blobOrFile.type ||
          (resourceType === "firma" ? "image/png" : "application/octet-stream"),
        blob: blobOrFile,
        size: typeof blobOrFile.size === "number" ? blobOrFile.size : 0,
        createdAt: new Date().toISOString(),
      }

      store.put(record)

      tx.oncomplete = () => {
        completed = true
        closeDb()
        resolve(key)
      }

      tx.onerror = () => {
        closeDb()
        reject(tx.error || new Error("Error en transacción al guardar blob."))
      }

      tx.onabort = () => {
        closeDb()
        if (!completed) {
          reject(tx.error || new Error("Transacción abortada al guardar blob."))
        }
      }
    } catch (err) {
      closeDb()
      reject(err)
    }
  })
}

/**
 * Obtiene un Blob verificando que pertenezca al usuario activo.
 */
export async function getBlobResource(
  userId: string,
  storageRef: string
): Promise<Blob | null> {
  if (!storageRef) return null

  // Validación de seguridad de clave para evitar acceso cruzado
  const expectedPrefix = `user_${encodeURIComponent(userId.trim() || "anonymous")}:`
  if (!storageRef.startsWith(expectedPrefix)) {
    console.warn(`[indexeddb] Intento de acceso a blob no autorizado. Usuario: ${userId}, Ref: ${storageRef}`)
    return null
  }

  let db: IDBDatabase | null = null
  try {
    db = await openBlobDatabase()
    return await new Promise<Blob | null>((resolve, reject) => {
      if (!db) {
        resolve(null)
        return
      }

      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(storageRef)

      getReq.onsuccess = () => {
        const record = getReq.result as BlobRecord | undefined
        if (!record || record.userId !== userId) {
          resolve(null)
        } else {
          const b = record.blob
          if (b && typeof b === "object") {
            if (typeof (b as Blob).size !== "number") {
              Object.defineProperty(b, "size", {
                value: typeof record.size === "number" ? record.size : 100,
                writable: true,
                configurable: true,
              })
            }
            if (typeof (b as Blob).type !== "string") {
              Object.defineProperty(b, "type", {
                value: record.mimeType || "image/png",
                writable: true,
                configurable: true,
              })
            }
          }
          resolve(b)
        }
      }
      getReq.onerror = () => reject(getReq.error || new Error("Error leyendo blob de IndexedDB."))
      tx.oncomplete = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
      }
      tx.onerror = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        reject(tx.error || new Error("Transacción fallida al leer blob."))
      }
    })
  } catch (err) {
    console.error("[indexeddb] Error obteniendo blob:", err)
    if (db) {
      try {
        db.close()
      } catch {
        // noop
      }
    }
    return null
  }
}

/**
 * Elimina un recurso específico verificando la pertenencia al usuario.
 * Resuelve en tx.oncomplete.
 */
export async function deleteBlobResource(
  userId: string,
  storageRef: string
): Promise<boolean> {
  if (!storageRef) return false

  const expectedPrefix = `user_${encodeURIComponent(userId.trim() || "anonymous")}:`
  if (!storageRef.startsWith(expectedPrefix)) {
    return false
  }

  let db: IDBDatabase | null = null
  try {
    db = await openBlobDatabase()
    return await new Promise<boolean>((resolve, reject) => {
      if (!db) {
        resolve(false)
        return
      }

      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      store.delete(storageRef)

      tx.oncomplete = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        resolve(true)
      }
      tx.onerror = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        reject(tx.error || new Error("Error eliminando blob."))
      }
      tx.onabort = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        resolve(false)
      }
    })
  } catch {
    if (db) {
      try {
        db.close()
      } catch {
        // noop
      }
    }
    return false
  }
}

/**
 * Elimina todos los blobs asociados a un escrito al momento de borrarlo.
 * Resuelve en tx.oncomplete.
 */
export async function deleteEscritoBlobs(
  userId: string,
  escritoId: string
): Promise<number> {
  let db: IDBDatabase | null = null
  try {
    db = await openBlobDatabase()
    return await new Promise<number>((resolve, reject) => {
      if (!db) {
        resolve(0)
        return
      }

      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const index = store.index("by_user_escrito")
      const range = IDBKeyRange.only([userId, escritoId])
      const req = index.openCursor(range)

      let deletedCount = 0
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        }
      }

      tx.oncomplete = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        resolve(deletedCount)
      }

      tx.onerror = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        reject(tx.error || new Error("Error eliminando blobs de escrito."))
      }

      tx.onabort = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        resolve(0)
      }
    })
  } catch (err) {
    console.error("[indexeddb] Error eliminando blobs de escrito:", err)
    if (db) {
      try {
        db.close()
      } catch {
        // noop
      }
    }
    return 0
  }
}

/**
 * Convierte un Data URL (base64) a un Blob nativo.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl || typeof dataUrl !== "string") {
    return new Blob([], { type: "image/png" })
  }
  const parts = dataUrl.split(",")
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : "image/png"
  const bstr = typeof atob === "function" ? atob(parts[1] || "") : Buffer.from(parts[1] || "", "base64").toString("binary")
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * Hidrata un borrador con object URLs (`blob:...`) para previsualización, edición y PDF.
 */
export async function hydrateEscritoBlobs(
  draft: EscritoDraftV2,
  userId: string
): Promise<EscritoDraftV2> {
  const updatedAnexos: AnexoItem[] = []

  for (const anexo of draft.anexos) {
    if (anexo.storageRef) {
      const blob = await getBlobResource(userId, anexo.storageRef)
      if (blob) {
        updatedAnexos.push({
          ...anexo,
          previewUrl: URL.createObjectURL(blob),
        })
        continue
      }
    }
    updatedAnexos.push(anexo)
  }

  let firmaPreviewUrl: string | undefined = undefined
  if (draft.firmaRef) {
    const firmaBlob = await getBlobResource(userId, draft.firmaRef)
    if (firmaBlob) {
      firmaPreviewUrl = URL.createObjectURL(firmaBlob)
    }
  }

  return {
    ...draft,
    anexos: updatedAnexos,
    firmaPreviewUrl,
  }
}

/**
 * Libera de memoria los Object URLs creados durante la hidratación.
 */
export function revokeEscritoBlobs(draft: EscritoDraftV2): void {
  if (draft.firmaPreviewUrl && draft.firmaPreviewUrl.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(draft.firmaPreviewUrl)
    } catch {
      // Ignorar errores en entornos sin DOM completo
    }
  }
  for (const anexo of draft.anexos) {
    if (anexo.previewUrl && anexo.previewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(anexo.previewUrl)
      } catch {
        // Ignorar errores en entornos sin DOM completo
      }
    }
  }
}

/**
 * Duplica físicamente en IndexedDB todos los blobs asociados al escrito original
 * asignándoles nuevas claves bajo el nuevo targetEscritoId.
 * Devuelve un mapa { [oldStorageRef]: newStorageRef }.
 * Si ocurre cualquier error, elimina los blobs parcialmente creados y devuelve error.
 */
export async function duplicateEscritoBlobs(
  userId: string,
  sourceEscritoId: string,
  targetEscritoId: string
): Promise<Map<string, string>> {
  const refMap = new Map<string, string>()
  const newlyCreatedKeys: string[] = []
  let db: IDBDatabase | null = null

  try {
    db = await openBlobDatabase()
    const recordsToClone: BlobRecord[] = await new Promise((resolve, reject) => {
      if (!db) {
        resolve([])
        return
      }
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const index = store.index("by_user_escrito")
      const range = IDBKeyRange.only([userId, sourceEscritoId])
      const req = index.getAll(range)
      req.onsuccess = () => resolve(req.result as BlobRecord[])
      req.onerror = () => reject(req.error || new Error("Error leyendo blobs para duplicar."))
    })

    if (recordsToClone.length === 0) {
      try {
        db.close()
      } catch {
        // noop
      }
      return refMap
    }

    await new Promise<void>((resolve, reject) => {
      if (!db) {
        reject(new Error("IndexedDB no disponible."))
        return
      }
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)

      for (const rec of recordsToClone) {
        const newResourceId = `dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const newKey = buildBlobKey(userId, targetEscritoId, rec.resourceType, newResourceId)
        const newRecord: BlobRecord = {
          key: newKey,
          userId,
          escritoId: targetEscritoId,
          resourceType: rec.resourceType,
          resourceId: newResourceId,
          mimeType: rec.mimeType,
          blob: rec.blob,
          size: typeof rec.blob.size === "number" ? rec.blob.size : rec.size || 0,
          createdAt: new Date().toISOString(),
        }
        store.put(newRecord)
        newlyCreatedKeys.push(newKey)
        refMap.set(rec.key, newKey)
      }

      tx.oncomplete = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        resolve()
      }
      tx.onerror = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        reject(tx.error || new Error("Error clonando blobs."))
      }
      tx.onabort = () => {
        try {
          db?.close()
        } catch {
          // noop
        }
        reject(tx.error || new Error("Transacción abortada clonando blobs."))
      }
    })

    return refMap
  } catch (err) {
    if (db) {
      try {
        db.close()
      } catch {
        // noop
      }
    }
    console.error("[indexeddb] Error duplicando blobs:", err)
    // Limpieza de rollback
    for (const k of newlyCreatedKeys) {
      await deleteBlobResource(userId, k).catch(() => {})
    }
    throw err
  }
}
