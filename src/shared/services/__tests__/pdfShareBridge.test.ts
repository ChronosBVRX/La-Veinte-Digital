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
