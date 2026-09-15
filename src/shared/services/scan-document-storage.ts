/**
 * Persistencia IndexedDB de documentos escaneados (web / fallback).
 *
 * - Aislada por usuario: la clave es `<userId>:<docId>` y además se valida
 *   `ownerUserId` en cada lectura (defensa en profundidad). Un usuario nunca
 *   ve ni puede leer registros de otro.
 * - La clasificación es explícita (`kind` + `source`), nunca por nombre de archivo.
 * - Sin URLs públicas ni sincronización externa: los bytes permanecen en el dispositivo.
 *
 * La Veinte Digital
 */

import {
  isScanDocumentKind,
  SCAN_DOCUMENT_KINDS,
  type ScanDocumentKind,
} from "@/shared/contracts/document-scan"

const DB_NAME = "la_veinte_scan_docs_db"
const DB_VERSION = 1
const STORE_NAME = "scan_documents"

export interface ScanDocumentRecord {
  key: string
  id: string
  ownerUserId: string
  kind: ScanDocumentKind
  name: string
  mimeType: string
  fileSize: number
  pageCount: number
  createdAt: number
  updatedAt: string
  /**
   * Bytes del PDF. Se guardan como ArrayBuffer (no Blob) para que el
   * structured clone sea portable entre navegadores y entornos de prueba.
   */
  bytes: ArrayBuffer
}

export interface ScanDocumentSummary {
  id: string
  kind: ScanDocumentKind
  name: string
  mimeType: string
  fileSize: number
  pageCount: number
  createdAt: number
  updatedAt: string
}

export interface SaveScanDocumentInput {
  id?: string
  kind: ScanDocumentKind
  name: string
  pageCount: number
  blob: Blob
  createdAt?: number
}

export type ScanStorageFailure =
  | "quota_exceeded"
  | "storage_unavailable"
  | "write_failed"
  | "unknown"

export class ScanStorageError extends Error {
  readonly failure: ScanStorageFailure
  readonly cause?: unknown

  constructor(failure: ScanStorageFailure, message: string, cause?: unknown) {
    super(message)
    this.name = "ScanStorageError"
    this.failure = failure
    this.cause = cause
  }
}

/**
 * Clasifica de forma determinista y segura errores de almacenamiento de IndexedDB / Storage,
 * reconociendo QuotaExceededError, NS_ERROR_DOM_QUOTA_REACHED, DOMException code 22,
 * restricciones de entorno y fallos transaccionales sin depender únicamente de texto libre.
 */
export function classifyStorageError(error: unknown): ScanStorageFailure {
  if (!error) return "unknown"
  if (error instanceof ScanStorageError) return error.failure

  const errObj = typeof error === "object" ? (error as Record<string, unknown>) : {}
  const name = typeof errObj.name === "string" ? errObj.name : ""
  const message = typeof errObj.message === "string" ? errObj.message : ""
  const code = typeof errObj.code === "number" ? errObj.code : 0

  // 1. QuotaExceededError (W3C standard, Firefox NS_ERROR_DOM_QUOTA_REACHED, legacy code 22)
  if (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    /quota/i.test(name) ||
    /quota/i.test(message)
  ) {
    return "quota_exceeded"
  }

  // 2. Storage unavailable (IndexedDB no soportado, bloqueado en iframe/sandbox o modo estricto)
  if (
    name === "SecurityError" ||
    name === "InvalidStateError" ||
    /not available/i.test(message) ||
    /no está disponible/i.test(message)
  ) {
    return "storage_unavailable"
  }

  // 3. Fallos en escritura/transacción
  if (
    name === "TransactionInactiveError" ||
    name === "ReadOnlyError" ||
    name === "ConstraintError" ||
    name === "AbortError" ||
    name === "UnknownError" ||
    /abort/i.test(name) ||
    /abort/i.test(message) ||
    /transaction/i.test(name) ||
    /transacción/i.test(message)
  ) {
    return "write_failed"
  }

  return "unknown"
}

function openScanDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new ScanStorageError("storage_unavailable", "IndexedDB no está disponible en este entorno."))
      return
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        const err = request.error || new Error("Error abriendo la base de escaneos.")
        const failure = classifyStorageError(err)
        reject(new ScanStorageError(failure, "Error abriendo la base de datos de escaneos.", err))
      }
      request.onblocked = () => {
        reject(new ScanStorageError("storage_unavailable", "La base de datos de escaneos está bloqueada."))
      }
    } catch (e) {
      const failure = classifyStorageError(e)
      reject(new ScanStorageError(failure, "No se pudo acceder a IndexedDB.", e))
    }
  })
}

function assertUserId(userId: string): string {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Authenticated userId is required")
  }
  return userId.trim()
}

function sanitizeIdPart(raw: string): string {
  return raw.trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "scan"
}

export function newScanDocumentId(kind: ScanDocumentKind): string {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${kind}_${stamp}_${random}`
}

function ownerScopedKey(ownerUserId: string, id: string): string {
  return `${assertUserId(ownerUserId)}:${sanitizeIdPart(id)}`
}

function toSummary(record: ScanDocumentRecord): ScanDocumentSummary {
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    pageCount: record.pageCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function assertKind(kind: unknown): ScanDocumentKind {
  if (!isScanDocumentKind(kind)) {
    throw new Error(`Clase de documento inválida. Válidas: ${SCAN_DOCUMENT_KINDS.join(", ")}`)
  }
  return kind
}

/** Guarda (o reemplaza) un documento escaneado del usuario. Devuelve su id. */
export async function saveScanDocument(
  ownerUserId: string,
  input: SaveScanDocumentInput
): Promise<ScanDocumentSummary> {
  const user = assertUserId(ownerUserId)
  const kind = assertKind(input.kind)
  const id = sanitizeIdPart(input.id ?? newScanDocumentId(kind))
  const key = ownerScopedKey(user, id)

  if (typeof window === "undefined" || !window.indexedDB) {
    throw new ScanStorageError("storage_unavailable", "IndexedDB no está disponible en este entorno.")
  }
  if (!input.blob || input.blob.size === 0) {
    throw new ScanStorageError("write_failed", "El documento escaneado está vacío.")
  }

  const now = Date.now()
  let bytes: ArrayBuffer
  try {
    bytes = await input.blob.arrayBuffer()
  } catch (err) {
    throw new ScanStorageError("write_failed", "No se pudieron leer los bytes del documento.", err)
  }

  if (bytes.byteLength === 0) {
    throw new ScanStorageError("write_failed", "El documento escaneado no contiene bytes válidos.")
  }

  const record: ScanDocumentRecord = {
    key,
    id,
    ownerUserId: user,
    kind,
    name: input.name,
    mimeType: input.blob.type || "application/pdf",
    fileSize: input.blob.size,
    pageCount: Math.max(1, Math.floor(input.pageCount)),
    createdAt: input.createdAt ?? now,
    updatedAt: new Date(now).toISOString(),
    bytes,
  }

  const db = await openScanDatabase()
  await new Promise<void>((resolve, reject) => {
    let completed = false
    try {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const putRequest = store.put(record)

      putRequest.onerror = (e) => {
        const targetRequest = e.target as IDBRequest | null
        const err = putRequest.error || targetRequest?.error || e
        const failure = classifyStorageError(err || putRequest.error)
        if (!completed) {
          completed = true
          try { db.close() } catch {}
          reject(new ScanStorageError(failure, "Error al escribir el documento en el almacenamiento.", err))
        }
      }

      tx.oncomplete = () => {
        if (!completed) {
          completed = true
          try { db.close() } catch {}
          resolve()
        }
      }

      tx.onerror = () => {
        if (!completed) {
          completed = true
          const err = tx.error || new Error("Error en transacción")
          const failure = classifyStorageError(err)
          try { db.close() } catch {}
          reject(new ScanStorageError(failure, "Error en la transacción de almacenamiento.", err))
        }
      }

      tx.onabort = () => {
        if (!completed) {
          completed = true
          const err = tx.error || new Error("Transacción abortada")
          const failure = classifyStorageError(err)
          try { db.close() } catch {}
          reject(new ScanStorageError(failure, "Transacción de almacenamiento abortada.", err))
        }
      }
    } catch (error) {
      if (!completed) {
        completed = true
        try { db.close() } catch {}
        const failure = classifyStorageError(error)
        reject(new ScanStorageError(failure, "Error iniciando la transacción de almacenamiento.", error))
      }
    }
  })

  return toSummary(record)
}

/** Lista los escaneos del usuario (sin cargar los blobs). */
export async function listScanDocuments(ownerUserId: string): Promise<ScanDocumentSummary[]> {
  const user = assertUserId(ownerUserId)
  if (typeof window === "undefined" || !window.indexedDB) return []

  try {
    const db = await openScanDatabase()
    return await new Promise<ScanDocumentSummary[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const request = tx.objectStore(STORE_NAME).getAll()
        request.onsuccess = () => {
          db.close()
          const records = ((request.result || []) as ScanDocumentRecord[])
            .filter((record) => record.ownerUserId === user)
            .map(toSummary)
            .sort((a, b) => b.createdAt - a.createdAt)
          resolve(records)
        }
        request.onerror = () => {
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

/** Recupera el registro completo (con blob) validando el propietario. */
export async function getScanDocument(ownerUserId: string, id: string): Promise<ScanDocumentRecord | null> {
  const user = assertUserId(ownerUserId)
  if (typeof window === "undefined" || !window.indexedDB) return null

  try {
    const db = await openScanDatabase()
    return await new Promise<ScanDocumentRecord | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const request = tx.objectStore(STORE_NAME).get(ownerScopedKey(user, id))
        request.onsuccess = () => {
          db.close()
          const record = request.result as ScanDocumentRecord | undefined
          if (!record || record.ownerUserId !== user || !record.bytes) {
            resolve(null)
            return
          }
          resolve(record)
        }
        request.onerror = () => {
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

/** Recupera el archivo PDF del escaneo (listo para visor/compartir/imprimir). */
export async function getScanDocumentFile(ownerUserId: string, id: string): Promise<File | null> {
  const record = await getScanDocument(ownerUserId, id)
  if (!record) return null
  return new File([record.bytes], record.name, { type: record.mimeType || "application/pdf" })
}

export async function hasScanDocument(ownerUserId: string, id: string): Promise<boolean> {
  return (await getScanDocument(ownerUserId, id)) !== null
}

/** Elimina un escaneo del usuario. Devuelve true si existía y se borró. */
export async function deleteScanDocument(ownerUserId: string, id: string): Promise<boolean> {
  const user = assertUserId(ownerUserId)
  if (typeof window === "undefined" || !window.indexedDB) return false

  try {
    const db = await openScanDatabase()
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        const key = ownerScopedKey(user, id)
        const getRequest = store.get(key)
        let existed = false
        getRequest.onsuccess = () => {
          const record = getRequest.result as ScanDocumentRecord | undefined
          existed = Boolean(record && record.ownerUserId === user)
          if (existed) store.delete(key)
        }
        tx.oncomplete = () => {
          db.close()
          resolve(existed)
        }
        tx.onerror = () => {
          db.close()
          resolve(false)
        }
      } catch {
        db.close()
        resolve(false)
      }
    })
  } catch {
    return false
  }
}

/** Elimina todos los escaneos del usuario (solo pruebas/limpieza explícita). */
export async function deleteAllScanDocuments(ownerUserId: string): Promise<number> {
  const summaries = await listScanDocuments(ownerUserId)
  let deleted = 0
  for (const summary of summaries) {
    if (await deleteScanDocument(ownerUserId, summary.id)) deleted++
  }
  return deleted
}

export const SCAN_DOCUMENT_STORAGE = {
  DB_NAME,
  STORE_NAME,
} as const
