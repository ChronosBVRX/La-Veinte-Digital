// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach } from "vitest"
import {
  classifyStorageError,
  ScanStorageError,
  saveScanDocument,
  getScanDocument,
  SCAN_DOCUMENT_STORAGE,
} from "@/shared/services/scan-document-storage"

const USER = "user-test-storage-hardening"

function pdfBlob(content: string): Blob {
  return new Blob([new TextEncoder().encode(content)], { type: "application/pdf" })
}

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(SCAN_DOCUMENT_STORAGE.DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe("classifyStorageError", () => {
  it("clasifica QuotaExceededError como quota_exceeded", () => {
    const error = new DOMException("The quota has been exceeded.", "QuotaExceededError")
    expect(classifyStorageError(error)).toBe("quota_exceeded")
  })

  it("clasifica NS_ERROR_DOM_QUOTA_REACHED (Firefox) como quota_exceeded", () => {
    const error = { name: "NS_ERROR_DOM_QUOTA_REACHED", message: "Quota reached" }
    expect(classifyStorageError(error)).toBe("quota_exceeded")
  })

  it("clasifica DOMException con code 22 como quota_exceeded", () => {
    const error = { code: 22, message: "Storage full" }
    expect(classifyStorageError(error)).toBe("quota_exceeded")
  })

  it("clasifica mensajes con 'quota exceeded' como quota_exceeded", () => {
    const error = new Error("Device storage quota exceeded during write")
    expect(classifyStorageError(error)).toBe("quota_exceeded")
  })

  it("clasifica SecurityError e InvalidStateError como storage_unavailable", () => {
    expect(classifyStorageError(new DOMException("Access denied", "SecurityError"))).toBe("storage_unavailable")
    expect(classifyStorageError(new DOMException("Database closed", "InvalidStateError"))).toBe("storage_unavailable")
  })

  it("clasifica ConstraintError y AbortError como write_failed", () => {
    expect(classifyStorageError(new DOMException("Key already exists", "ConstraintError"))).toBe("write_failed")
    expect(classifyStorageError(new DOMException("Transaction aborted", "AbortError"))).toBe("write_failed")
  })

  it("clasifica errores no reconocidos o valores primitivos como unknown", () => {
    expect(classifyStorageError(new Error("Something went wrong"))).toBe("unknown")
    expect(classifyStorageError("error en texto")).toBe("unknown")
    expect(classifyStorageError(null)).toBe("unknown")
    expect(classifyStorageError(undefined)).toBe("unknown")
  })
})

describe("ScanStorageError", () => {
  it("crea una instancia correcta con tipo y mensaje", () => {
    const orig = new Error("Original")
    const err = new ScanStorageError("quota_exceeded", "Memoria llena", orig)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ScanStorageError)
    expect(err.failure).toBe("quota_exceeded")
    expect(err.message).toBe("Memoria llena")
    expect(err.cause).toBe(orig)
  })
})

describe("saveScanDocument con hardening", () => {
  it("rechaza archivos con blob de 0 bytes lanzando ScanStorageError(write_failed)", async () => {
    const emptyBlob = new Blob([], { type: "application/pdf" })
    await expect(
      saveScanDocument(USER, {
        kind: "documento",
        name: "vacio.pdf",
        pageCount: 1,
        blob: emptyBlob,
      })
    ).rejects.toThrowError(ScanStorageError)
  })

  it("guarda exitosamente un PDF válido esperando la transacción completa", async () => {
    const blob = pdfBlob("Contenido PDF válido")
    const doc = await saveScanDocument(USER, {
      kind: "documento",
      name: "Documento Valido.pdf",
      pageCount: 2,
      blob,
    })

    expect(doc.id).toBeDefined()
    expect(doc.fileSize).toBe(blob.size)
    expect(doc.kind).toBe("documento")

    const stored = await getScanDocument(USER, doc.id)
    expect(stored).not.toBeNull()
    expect(stored?.fileSize).toBe(blob.size)
  })
})
