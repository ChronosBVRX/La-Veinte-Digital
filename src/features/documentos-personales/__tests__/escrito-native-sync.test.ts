// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { savePdfToNativeDocs, setNativeDocsOwner } from "@/shared/services/pdfShareBridge"
import {
  syncEscritoBlobToNative,
  deleteNativeEscritoCopies,
} from "@/features/documentos-personales/services/escrito-native-sync"

function pdfBytes(): Blob {
  return new Blob(["%PDF-1.4 test"], { type: "application/pdf" })
}

describe("Respaldo offline de escritos (puente nativo)", () => {
  const originalLaVeinteApp = window.LaVeinteApp

  beforeEach(() => {
    vi.useFakeTimers()
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
  })

  afterEach(() => {
    vi.useRealTimers()
    window.LaVeinteApp = originalLaVeinteApp
    vi.restoreAllMocks()
  })

  it("fuera de la app nativa no hace nada y no lanza", async () => {
    await expect(
      savePdfToNativeDocs(pdfBytes(), { escritoId: "esc_1", title: "T" })
    ).resolves.toMatchObject({ ok: false, code: "UNSUPPORTED" })
    expect(() => setNativeDocsOwner("user_1")).not.toThrow()
    expect(() => syncEscritoBlobToNative(pdfBytes(), {
      escritoId: "esc_1",
      title: "T",
      ownerId: "user_1",
    })).not.toThrow()
    expect(() => deleteNativeEscritoCopies("esc_1")).not.toThrow()
  })

  it("rechaza escritos sin id y archivos vacíos sin tocar el puente", async () => {
    window.LaVeinteApp = {
      isNativeApp: () => true,
      sendPdfShareMessage: vi.fn(() => true),
      laVeintePdfBridge: undefined,
    } as unknown as LaVeinteNativeApp
    // jsdom no implementa laVeintePdfBridge; el guard isNativePdfShareSupported exige canal.
    await expect(
      savePdfToNativeDocs(pdfBytes(), { escritoId: "  " })
    ).resolves.toMatchObject({ ok: false, code: "INVALID_REQUEST" })
    await expect(
      savePdfToNativeDocs(new Blob([], { type: "application/pdf" }), { escritoId: "esc_1" })
    ).resolves.toMatchObject({ ok: false, code: "INVALID_PDF" })
  })

  it("rechaza contenido que no es PDF antes de enviar", async () => {
    window.LaVeinteApp = {
      isNativeApp: () => true,
    } as unknown as LaVeinteNativeApp
    ;(window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge = {
      postMessage: () => {},
    }
    try {
      const notPdf = new Blob(["hola mundo"], { type: "application/pdf" })
      await expect(
        savePdfToNativeDocs(notPdf, { escritoId: "esc_1" })
      ).resolves.toMatchObject({ ok: false, code: "INVALID_PDF" })
    } finally {
      delete (window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
    }
  })
})
