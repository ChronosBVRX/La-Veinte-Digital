// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach } from "vitest"
import {
  deleteAllScanDocuments,
  deleteScanDocument,
  getScanDocument,
  getScanDocumentFile,
  hasScanDocument,
  listScanDocuments,
  newScanDocumentId,
  saveScanDocument,
  SCAN_DOCUMENT_STORAGE,
} from "@/shared/services/scan-document-storage"

const USER_A = "user-a-uuid"
const USER_B = "user-b-uuid"

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

describe("scan-document-storage: aislamiento por usuario", () => {
  it("el escenario A→B→A no filtra documentos entre cuentas", async () => {
    // Usuario A escanea su INE.
    const ineA = await saveScanDocument(USER_A, {
      kind: "ine",
      name: "INE 2026-09-14.pdf",
      pageCount: 1,
      blob: pdfBlob("ine-de-A"),
    })

    // Usuario B inicia sesión: no puede ver el INE de A.
    const listB = await listScanDocuments(USER_B)
    expect(listB).toHaveLength(0)
    expect(await getScanDocument(USER_B, ineA.id)).toBeNull()
    expect(await getScanDocumentFile(USER_B, ineA.id)).toBeNull()
    expect(await hasScanDocument(USER_B, ineA.id)).toBe(false)

    // Usuario B guarda su propio documento.
    await saveScanDocument(USER_B, {
      kind: "documento",
      name: "Contrato B.pdf",
      pageCount: 3,
      blob: pdfBlob("documento-de-B"),
    })

    // Usuario A vuelve: solo ve el suyo.
    const listA = await listScanDocuments(USER_A)
    expect(listA).toHaveLength(1)
    expect(listA[0].kind).toBe("ine")
    expect(listA[0].name).toBe("INE 2026-09-14.pdf")

    const fileA = await getScanDocumentFile(USER_A, ineA.id)
    expect(fileA).not.toBeNull()
    expect(fileA!.name).toBe("INE 2026-09-14.pdf")
    expect(await fileA!.text()).toBe("ine-de-A")

    const listBFinal = await listScanDocuments(USER_B)
    expect(listBFinal).toHaveLength(1)
    expect(listBFinal[0].name).toBe("Contrato B.pdf")
  })

  it("el mismo id lógico de dos usuarios no se sobrescribe", async () => {
    await saveScanDocument(USER_A, {
      id: "documento_compartido",
      kind: "documento",
      name: "A.pdf",
      pageCount: 1,
      blob: pdfBlob("contenido-a"),
    })
    await saveScanDocument(USER_B, {
      id: "documento_compartido",
      kind: "documento",
      name: "B.pdf",
      pageCount: 1,
      blob: pdfBlob("contenido-b"),
    })

    const fileA = await getScanDocumentFile(USER_A, "documento_compartido")
    const fileB = await getScanDocumentFile(USER_B, "documento_compartido")
    expect(await fileA!.text()).toBe("contenido-a")
    expect(await fileB!.text()).toBe("contenido-b")
  })

  it("B no puede borrar el documento de A", async () => {
    const doc = await saveScanDocument(USER_A, {
      kind: "documento",
      name: "A.pdf",
      pageCount: 1,
      blob: pdfBlob("contenido-a"),
    })
    expect(await deleteScanDocument(USER_B, doc.id)).toBe(false)
    expect(await hasScanDocument(USER_A, doc.id)).toBe(true)
  })

  it("exige userId autenticado", async () => {
    await expect(
      saveScanDocument("", { kind: "documento", name: "x.pdf", pageCount: 1, blob: pdfBlob("x") })
    ).rejects.toThrow()
    await expect(listScanDocuments("  ")).rejects.toThrow()
    await expect(getScanDocument("", "x")).rejects.toThrow()
  })
})

describe("scan-document-storage: operaciones básicas", () => {
  it("guarda, lista y elimina conservando el blob", async () => {
    const saved = await saveScanDocument(USER_A, {
      kind: "documento",
      name: "Escaneo.pdf",
      pageCount: 2,
      blob: pdfBlob("pdf-bytes"),
    })
    expect(saved.id).toMatch(/^documento_/)
    expect(saved.fileSize).toBeGreaterThan(0)

    const list = await listScanDocuments(USER_A)
    expect(list).toHaveLength(1)
    expect(list[0].pageCount).toBe(2)
    expect(list[0].mimeType).toBe("application/pdf")

    expect(await deleteScanDocument(USER_A, saved.id)).toBe(true)
    expect(await listScanDocuments(USER_A)).toHaveLength(0)
  })

  it("rechaza blobs vacíos y clases inválidas", async () => {
    await expect(
      saveScanDocument(USER_A, { kind: "documento", name: "x.pdf", pageCount: 1, blob: new Blob([]) })
    ).rejects.toThrow()
    await expect(
      saveScanDocument(USER_A, {
        kind: "pasaporte" as never,
        name: "x.pdf",
        pageCount: 1,
        blob: pdfBlob("x"),
      })
    ).rejects.toThrow()
  })

  it("deleteAllScanDocuments solo afecta al usuario indicado", async () => {
    await saveScanDocument(USER_A, { kind: "documento", name: "a.pdf", pageCount: 1, blob: pdfBlob("a") })
    await saveScanDocument(USER_A, { kind: "ine", name: "b.pdf", pageCount: 1, blob: pdfBlob("b") })
    await saveScanDocument(USER_B, { kind: "documento", name: "c.pdf", pageCount: 1, blob: pdfBlob("c") })

    expect(await deleteAllScanDocuments(USER_A)).toBe(2)
    expect(await listScanDocuments(USER_A)).toHaveLength(0)
    expect(await listScanDocuments(USER_B)).toHaveLength(1)
  })

  it("ordena por fecha de creación descendente", async () => {
    await saveScanDocument(USER_A, {
      kind: "documento",
      name: "viejo.pdf",
      pageCount: 1,
      blob: pdfBlob("1"),
      createdAt: 1000,
    })
    await saveScanDocument(USER_A, {
      kind: "documento",
      name: "nuevo.pdf",
      pageCount: 1,
      blob: pdfBlob("2"),
      createdAt: 2000,
    })
    const list = await listScanDocuments(USER_A)
    expect(list.map((d) => d.name)).toEqual(["nuevo.pdf", "viejo.pdf"])
  })

  it("newScanDocumentId produce ids seguros y únicos", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newScanDocumentId("documento")))
    expect(ids.size).toBe(50)
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
})
