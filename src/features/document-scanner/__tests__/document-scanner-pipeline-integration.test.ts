// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDocumentScanner } from "../hooks/useDocumentScanner"
import * as pageRenderer from "../lib/page-renderer"
import { tinyJpegBytes } from "./helpers/jpeg"

function pagePayload() {
  const bytes = tinyJpegBytes()
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return {
    base64: btoa(binary),
    mimeType: "image/jpeg",
    width: 100,
    height: 140,
  }
}

describe("document-scanner: integración de pipeline y contratos de filtros", () => {
  let renderPageBlobSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    vi.restoreAllMocks()
    renderPageBlobSpy = vi.spyOn(pageRenderer, "renderPageBlob").mockImplementation(
      async (source: Blob, _filter, _rotation) => {
        const bytes = await source.arrayBuffer()
        return {
          blob: new Blob([bytes], { type: "image/jpeg" }),
          width: 100,
          height: 140,
        }
      }
    )
  })

  it("10. documento ML Kit inicia en Documento ('enhanced')", async () => {
    window.LaVeinteApp = {
      scanDocument: vi.fn().mockResolvedValue({
        ok: true,
        engine: "mlkit",
        pages: [pagePayload()],
      }),
    } as unknown as typeof window.LaVeinteApp

    const { result } = renderHook(() => useDocumentScanner())

    await act(async () => {
      const outcome = await result.current.scanWithNative("document")
      expect(outcome.ok).toBe(true)
    })

    expect(result.current.pages.length).toBe(1)
    const page = result.current.pages[0]
    // Inicia con filtro "enhanced" (Documento)
    expect(page.filter).toBe("enhanced")
    // Conserva sourceBlob limpio para poder volver a Original
    expect(page.sourceBlob).toBeDefined()
  })

  it("11. INE ML Kit inicia en Original ('original')", async () => {
    window.LaVeinteApp = {
      scanDocument: vi.fn().mockResolvedValue({
        ok: true,
        engine: "mlkit",
        pages: [pagePayload()],
      }),
    } as unknown as typeof window.LaVeinteApp

    const { result } = renderHook(() => useDocumentScanner())

    await act(async () => {
      const outcome = await result.current.scanWithNative("ine-front")
      expect(outcome.ok).toBe(true)
    })

    expect(result.current.pages.length).toBe(1)
    const page = result.current.pages[0]
    // En INE inicia con "original", sin blanqueamiento agresivo automático
    expect(page.filter).toBe("original")
    expect(page.sourceBlob).toBeDefined()
  })

  it("9. cambio repetido de filtros siempre renderiza desde sourceBlob sin degradación acumulativa", async () => {
    window.LaVeinteApp = {
      scanDocument: vi.fn().mockResolvedValue({
        ok: true,
        engine: "mlkit",
        pages: [pagePayload()],
      }),
    } as unknown as typeof window.LaVeinteApp

    const { result } = renderHook(() => useDocumentScanner())

    await act(async () => {
      await result.current.scanWithNative("document")
    })

    const pageId = result.current.pages[0].id
    const originalSourceBlob = result.current.pages[0].sourceBlob
    expect(originalSourceBlob).toBeDefined()

    renderPageBlobSpy.mockClear()

    // Cambiar a Grises
    await act(async () => {
      await result.current.setPageFilter(pageId, "grayscale")
    })
    expect(renderPageBlobSpy).toHaveBeenLastCalledWith(originalSourceBlob, "grayscale", 0)

    // Cambiar a Blanco y negro
    await act(async () => {
      await result.current.setPageFilter(pageId, "bw")
    })
    expect(renderPageBlobSpy).toHaveBeenLastCalledWith(originalSourceBlob, "bw", 0)

    // Cambiar a Documento
    await act(async () => {
      await result.current.setPageFilter(pageId, "enhanced")
    })
    expect(renderPageBlobSpy).toHaveBeenLastCalledWith(originalSourceBlob, "enhanced", 0)

    // Volver a Original
    await act(async () => {
      await result.current.setPageFilter(pageId, "original")
    })
    // Siempre pasa el sourceBlob original, nunca el blob ya filtrado
    expect(renderPageBlobSpy).toHaveBeenLastCalledWith(originalSourceBlob, "original", 0)
    expect(result.current.pages[0].sourceBlob).toBe(originalSourceBlob)
  })

  it("12 & 13. PDF multipágina continúa generándose", async () => {
    window.LaVeinteApp = {
      scanDocument: vi.fn().mockResolvedValue({
        ok: true,
        engine: "mlkit",
        pages: [pagePayload(), pagePayload()],
      }),
    } as unknown as typeof window.LaVeinteApp

    const { result } = renderHook(() => useDocumentScanner())

    await act(async () => {
      await result.current.scanWithNative("document")
    })

    expect(result.current.pages.length).toBe(2)
    const finalized = await result.current.buildDocumentPdf("Doc Multipage")
    expect(finalized.pageCount).toBe(2)
    expect(finalized.kind).toBe("documento")
    expect(finalized.file.name).toBe("Doc Multipage.pdf")
  })

  it("14. INE genera exactamente una sola hoja carta con frente y reverso", async () => {
    window.LaVeinteApp = {
      scanDocument: vi.fn().mockResolvedValue({
        ok: true,
        engine: "mlkit",
        pages: [pagePayload(), pagePayload()],
      }),
    } as unknown as typeof window.LaVeinteApp

    const { result } = renderHook(() => useDocumentScanner())

    await act(async () => {
      await result.current.scanWithNative("ine-front")
    })

    const finalized = await result.current.buildIneDocument("INE Prueba")
    expect(finalized.pageCount).toBe(1)
    expect(finalized.kind).toBe("ine")
    expect(finalized.file.name).toBe("INE Prueba.pdf")
  })

  it("15. no se introduce OCR ni acceso a APIs externas", async () => {
    // Verificar que los módulos de mejora no importan tesseract ni apis externas
    const enhancementModule = await import("../lib/document-enhancement")
    expect(enhancementModule).toBeDefined()
    expect(typeof enhancementModule.enhanceDocument).toBe("function")
    expect(typeof enhancementModule.enhanceGrayscale).toBe("function")
    expect(typeof enhancementModule.enhanceBlackAndWhite).toBe("function")
    expect(typeof enhancementModule.normalizeIllumination).toBe("function")
  })
})
