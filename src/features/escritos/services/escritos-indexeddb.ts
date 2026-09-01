/**
 * Servicio IndexedDB para almacenamiento binario (firmas y fotografías)
 * Aislado estrictamente por usuario y por escrito.
 * La Veinte Digital
 */

import type { EscritoDraftV2, AnexoItem } from "@/shared/contracts/escrito-draft"

const DB_NAME = "la_veinte_escritos_db"
const DB_VERSION = 1
const STORE_NAME = "escritos_blobs"

interface BlobRecord {
  /** Clave canónica: `user_${userId}:esc_${escritoId}:${tipo}:${resourceId}` */
  key: string
  userId: string
  escritoId: string
  resourceType: "firma" | "anexo"
  resourceId: string
  mimeType: string
  blob: Blob
  createdAt: string
}

function openDatabase(): Promise<IDBDatabase> {
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
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    const record: BlobRecord = {
      key,
      userId,
      escritoId,
      resourceType,
      resourceId,
      mimeType: blobOrFile.type || (resourceType === "firma" ? "image/png" : "application/octet-stream"),
      blob: blobOrFile,
      createdAt: new Date().toISOString(),
    }

    const putReq = store.put(record)
    putReq.onsuccess = () => resolve(key)
    putReq.onerror = () => reject(putReq.error || new Error("Error guardando blob en IndexedDB."))
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

  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(storageRef)

      getReq.onsuccess = () => {
        const record = getReq.result as BlobRecord | undefined
        if (!record || record.userId !== userId) {
          resolve(null)
        } else {
          resolve(record.blob)
        }
      }
      getReq.onerror = () => reject(getReq.error || new Error("Error leyendo blob de IndexedDB."))
    })
  } catch (err) {
    console.error("[indexeddb] Error obteniendo blob:", err)
    return null
  }
}

/**
 * Elimina un recurso específico verificando la pertenencia al usuario.
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

  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const delReq = store.delete(storageRef)
      delReq.onsuccess = () => resolve(true)
      delReq.onerror = () => reject(delReq.error || new Error("Error eliminando blob."))
    })
  } catch {
    return false
  }
}

/**
 * Elimina todos los blobs asociados a un escrito al momento de borrarlo.
 */
export async function deleteEscritoBlobs(
  userId: string,
  escritoId: string
): Promise<number> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
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
        } else {
          resolve(deletedCount)
        }
      }
      req.onerror = () => reject(req.error || new Error("Error eliminando blobs de escrito."))
    })
  } catch (err) {
    console.error("[indexeddb] Error eliminando blobs de escrito:", err)
    return 0
  }
}

/**
 * Convierte un Data URL (base64) a un Blob nativo.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",")
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : "image/png"
  const bstr = atob(parts[1] || "")
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
 */
export async function duplicateEscritoBlobs(
  userId: string,
  sourceEscritoId: string,
  targetEscritoId: string
): Promise<Map<string, string>> {
  const refMap = new Map<string, string>()
  try {
    const db = await openDatabase()
    const recordsToClone: BlobRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const index = store.index("by_user_escrito")
      const range = IDBKeyRange.only([userId, sourceEscritoId])
      const req = index.getAll(range)
      req.onsuccess = () => resolve(req.result as BlobRecord[])
      req.onerror = () => reject(req.error || new Error("Error leyendo blobs para duplicar."))
    })

    if (recordsToClone.length === 0) return refMap

    await new Promise<void>((resolve, reject) => {
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
          createdAt: new Date().toISOString(),
        }
        store.put(newRecord)
        refMap.set(rec.key, newKey)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error("Error clonando blobs."))
    })

    return refMap
  } catch (err) {
    console.error("[indexeddb] Error duplicando blobs:", err)
    return refMap
  }
}

