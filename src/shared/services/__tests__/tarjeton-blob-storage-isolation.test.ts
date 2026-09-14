// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach } from "vitest"
import {
  saveTarjetonPdfBlob,
  getTarjetonPdfBlob,
  findTarjetonPdfBlob,
  listAllTarjetonBlobs,
} from "@/shared/services/tarjeton-blob-storage"

const USER_A = "user-a-uuid"
const USER_B = "user-b-uuid"
const DB_NAME = "la_veinte_tarjeton_blobs_db"
const STORE_NAME = "tarjeton_files"

function pdfFile(name: string, content: string): File {
  return new File([new TextEncoder().encode(content)], name, { type: "application/pdf" })
}

async function seedLegacyRecordWithoutOwner(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" })
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put({
        key: "LEGACY_NO_OWNER",
        blob: pdfFile("legacy.pdf", "legacy"),
        fileName: "legacy.pdf",
        fileSize: 6,
        mimeType: "application/pdf",
        updatedAt: "2020-01-01T00:00:00Z",
      })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    req.onerror = () => reject(req.error)
  })
}

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
})

describe("IndexedDB de tarjetones aislada por usuario", () => {
  it("A y B guardan el mismo periodo sin sobrescribirse", async () => {
    await saveTarjetonPdfBlob(USER_A, "1A-SEP-2026", pdfFile("a.pdf", "contenido-a"), "a.pdf")
    await saveTarjetonPdfBlob(USER_B, "1A-SEP-2026", pdfFile("b.pdf", "contenido-b"), "b.pdf")

    const a = await getTarjetonPdfBlob(USER_A, "1A-SEP-2026")
    const b = await getTarjetonPdfBlob(USER_B, "1A-SEP-2026")

    expect(a?.name).toBe("a.pdf")
    expect(b?.name).toBe("b.pdf")
  })

  it("cada usuario lista solo sus PDFs", async () => {
    await saveTarjetonPdfBlob(USER_A, "PERIOD-A", pdfFile("a.pdf", "a"))
    await saveTarjetonPdfBlob(USER_B, "PERIOD-B", pdfFile("b.pdf", "b"))

    const listA = await listAllTarjetonBlobs(USER_A)
    const listB = await listAllTarjetonBlobs(USER_B)

    expect(listA.map((r) => r.fileName)).toEqual(["a.pdf"])
    expect(listB.map((r) => r.fileName)).toEqual(["b.pdf"])
  })

  it("el fallback 'último PDF' se limita al dueño", async () => {
    await saveTarjetonPdfBlob(USER_A, "PERIOD-A", pdfFile("a.pdf", "a"))
    await saveTarjetonPdfBlob(USER_B, "PERIOD-B", pdfFile("b.pdf", "b"))

    const fallbackA = await findTarjetonPdfBlob(USER_A, ["no-existe"])
    expect(fallbackA?.name).toBe("a.pdf")
  })

  it("los registros heredados sin ownerUserId no se devuelven", async () => {
    await seedLegacyRecordWithoutOwner()

    const legacyByKey = await getTarjetonPdfBlob(USER_A, "LEGACY_NO_OWNER")
    expect(legacyByKey).toBeNull()

    const list = await listAllTarjetonBlobs(USER_A)
    expect(list).toHaveLength(0)

    const fallback = await findTarjetonPdfBlob(USER_A, ["no-existe"])
    expect(fallback).toBeNull()
  })
})
