// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  sharePdfViaNativeBridge,
  isNativePdfShareSupported,
} from "../pdfShareBridge"

describe("pdfShareBridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    delete (window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
    delete (window as unknown as { __laveintePdfShareCallback?: unknown }).__laveintePdfShareCallback
  })

  afterEach(() => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    delete (window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
    delete (window as unknown as { __laveintePdfShareCallback?: unknown }).__laveintePdfShareCallback
  })

  it("isNativePdfShareSupported returns true when window.laVeintePdfBridge is present", () => {
    expect(isNativePdfShareSupported()).toBe(false)

    window.LaVeinteApp = {
      isNativeApp: () => true,
    } as unknown as typeof window.LaVeinteApp

    window.laVeintePdfBridge = {
      postMessage: vi.fn(),
    }

    expect(isNativePdfShareSupported()).toBe(true)
  })

  it("rejects non-PDF files without %PDF- header", async () => {
    window.LaVeinteApp = {
      isNativeApp: () => true,
    } as unknown as typeof window.LaVeinteApp
    window.laVeintePdfBridge = { postMessage: vi.fn() }

    const fakeTextFile = new File(["NOT_A_PDF_CONTENT"], "document.pdf", { type: "application/pdf" })
    const result = await sharePdfViaNativeBridge(fakeTextFile)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("INVALID_PDF")
    }
  })

  it("handles fragmented flow and resolves with success JSON contract", async () => {
    const postedMessages: Array<Record<string, unknown>> = []

    window.LaVeinteApp = {
      isNativeApp: () => true,
    } as unknown as typeof window.LaVeinteApp

    window.laVeintePdfBridge = {
      postMessage: vi.fn((msgStr: string) => {
        const parsed = JSON.parse(msgStr) as Record<string, unknown>
        postedMessages.push(parsed)

        if (parsed.action === "start") {
          setTimeout(() => {
            window.__laveintePdfShareCallback?.({
              ok: true,
              status: "ready",
              transferId: parsed.transferId,
            })
          }, 0)
        }

        if (parsed.action === "commit") {
          setTimeout(() => {
            window.__laveintePdfShareCallback?.({
              ok: true,
              status: "chooser_opened",
              transferId: parsed.transferId,
              fileName: "test.pdf",
              byteLength: 20,
              sha256: parsed.sha256,
            })
          }, 0)
        }
      }),
    }

    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4, 0xc5, 0xd8, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])
    const validPdfFile = new File([pdfContent], "test.pdf", { type: "application/pdf" })

    const res = await sharePdfViaNativeBridge(validPdfFile, "test.pdf")

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.status).toBe("chooser_opened")
      expect(res.fileName).toBe("test.pdf")
      expect(res.byteLength).toBe(20)
    }

    expect(postedMessages.some((m) => m.action === "start")).toBe(true)
    expect(postedMessages.some((m) => m.action === "chunk")).toBe(true)
    expect(postedMessages.some((m) => m.action === "commit")).toBe(true)
  })
})

// ── shareGeneratedPdf — función centralizada ────────────────────────────────

import { shareGeneratedPdf, isRunningInNativeApp } from "../pdfShareBridge"

// Mínimo PDF válido (%PDF- + %%EOF)
const MIN_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])

function makeNativeWindow(opts: { hasBridge: boolean }) {
  const win = window as unknown as {
    LaVeinteApp?: unknown
    laVeintePdfBridge?: unknown
    __laveintePdfShareCallback?: unknown
  }
  win.LaVeinteApp = {
    isNativeApp: () => true,
    checkForUpdate: vi.fn(),
  }
  if (opts.hasBridge) {
    win.laVeintePdfBridge = {
      postMessage: vi.fn((msgStr: string) => {
        const parsed = JSON.parse(msgStr) as Record<string, unknown>
        if (parsed.action === "start") {
          setTimeout(() => {
            ;(window as unknown as { __laveintePdfShareCallback?: (r: unknown) => void }).__laveintePdfShareCallback?.({ ok: true, status: "ready", transferId: parsed.transferId })
          }, 0)
        }
        if (parsed.action === "commit") {
          setTimeout(() => {
            ;(window as unknown as { __laveintePdfShareCallback?: (r: unknown) => void }).__laveintePdfShareCallback?.({ ok: true, status: "chooser_opened", transferId: parsed.transferId, fileName: "escrito.pdf", byteLength: MIN_PDF.byteLength, sha256: parsed.sha256 })
          }, 0)
        }
      }),
    }
  }
}

function clearNativeWindow() {
  const win = window as unknown as {
    LaVeinteApp?: unknown
    laVeintePdfBridge?: unknown
    __laveintePdfShareCallback?: unknown
  }
  delete win.LaVeinteApp
  delete win.laVeintePdfBridge
  delete win.__laveintePdfShareCallback
}

describe("shareGeneratedPdf", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearNativeWindow()
  })
  afterEach(() => {
    clearNativeWindow()
  })

  it("app nativa CON puente → status ok al compartir PDF válido", async () => {
    makeNativeWindow({ hasBridge: true })
    const file = new File([MIN_PDF], "escrito.pdf", { type: "application/pdf" })
    const result = await shareGeneratedPdf(file, "escrito.pdf")
    expect(result.status).toBe("ok")
  })

  it("app nativa SIN puente → status update_required, llama checkForUpdate, NO usa blob:", async () => {
    makeNativeWindow({ hasBridge: false })
    // Aseguramos que NO hay createElement llamado
    const createSpy = vi.spyOn(document, "createElement")
    const file = new File([MIN_PDF], "escrito.pdf", { type: "application/pdf" })
    const result = await shareGeneratedPdf(file, "escrito.pdf")
    expect(result.status).toBe("update_required")
    expect("message" in result && result.message).toMatch(/actualiza/i)
    // checkForUpdate fue llamado
    const app = (window as unknown as { LaVeinteApp: { checkForUpdate: ReturnType<typeof vi.fn> } }).LaVeinteApp
    expect(app.checkForUpdate).toHaveBeenCalledTimes(1)
    // createElement("a") NO fue llamado
    expect(createSpy).not.toHaveBeenCalledWith("a")
  })

  it("app nativa SIN puente → NUNCA ejecuta <a download>", async () => {
    makeNativeWindow({ hasBridge: false })
    const clickSpy = vi.fn()
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = document.createElement.call(document, "a")
        a.click = clickSpy
        return a
      }
      return document.createElement.call(document, tag)
    })
    const file = new File([MIN_PDF], "escrito.pdf", { type: "application/pdf" })
    await shareGeneratedPdf(file, "escrito.pdf")
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it("navegador web sin Web Share API → descarga mediante blob: + <a download>", async () => {
    // Aseguramos que NO estamos en contexto nativo
    clearNativeWindow()
    // Eliminamos navigator.share si existe
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true, writable: true })

    const clickSpy = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = originalCreate("a")
        Object.defineProperty(a, "click", { value: clickSpy, writable: true })
        return a
      }
      return originalCreate(tag)
    })

    const file = new File([MIN_PDF], "escrito.pdf", { type: "application/pdf" })
    const result = await shareGeneratedPdf(file, "escrito.pdf")
    expect(result.status).toBe("ok")
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it("isRunningInNativeApp devuelve false cuando no hay LaVeinteApp", () => {
    expect(isRunningInNativeApp()).toBe(false)
  })

  it("isRunningInNativeApp devuelve true cuando LaVeinteApp.isNativeApp() === true", () => {
    ;(window as unknown as { LaVeinteApp: unknown }).LaVeinteApp = { isNativeApp: () => true }
    expect(isRunningInNativeApp()).toBe(true)
  })
})

