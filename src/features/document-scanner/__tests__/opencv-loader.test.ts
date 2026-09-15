// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  loadOpenCv,
  retryOpenCv,
  canRetryOpenCv,
  hasOpenCvFailed,
  isOpenCvLoaded,
  resetOpenCvCacheForTests,
  type OpenCvModule,
} from "../lib/opencv-loader"

function mockCvModule(): OpenCvModule {
  return {
    Mat: class {} as unknown as OpenCvModule["Mat"],
    MatVector: class {} as unknown as OpenCvModule["MatVector"],
    matFromImageData: vi.fn(),
    matFromArray: vi.fn(),
    cvtColor: vi.fn(),
    GaussianBlur: vi.fn(),
    Canny: vi.fn(),
    findContours: vi.fn(),
    contourArea: vi.fn(),
    approxPolyDP: vi.fn(),
    arcLength: vi.fn(),
    isContourConvex: vi.fn(),
    CV_8UC1: 0,
    CV_8UC3: 16,
    CV_32FC2: 13,
    COLOR_RGBA2GRAY: 6,
    RETR_LIST: 1,
    CHAIN_APPROX_SIMPLE: 1,
  }
}

beforeEach(() => {
  resetOpenCvCacheForTests()
  delete (window as { cv?: unknown }).cv
  document.querySelectorAll("script[data-scanner-opencv]").forEach((s) => s.remove())
})

afterEach(() => {
  resetOpenCvCacheForTests()
  delete (window as { cv?: unknown }).cv
  document.querySelectorAll("script[data-scanner-opencv]").forEach((s) => s.remove())
})

describe("opencv-loader", () => {
  it("indica correctamente que OpenCV no está cargado al inicio", () => {
    expect(isOpenCvLoaded()).toBe(false)
    expect(hasOpenCvFailed()).toBe(false)
    expect(canRetryOpenCv()).toBe(false)
  })

  it("deduplica llamadas concurrentes retornando la misma promesa", () => {
    const p1 = loadOpenCv()
    const p2 = loadOpenCv()
    expect(p1).toBe(p2)
  })

  it("registra fallo si los scripts fallan al cargar y habilita un único reintento", async () => {
    // Interceptar appendChild para disparar onerror en los scripts agregados
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => {
          node.onerror?.(new Event("error") as unknown as string)
        }, 0)
      }
      return node
    })

    const result = await loadOpenCv()
    expect(result).toBeNull()
    expect(isOpenCvLoaded()).toBe(false)
    expect(hasOpenCvFailed()).toBe(true)
    expect(canRetryOpenCv()).toBe(true)

    appendSpy.mockRestore()
  })

  it("permite un único reintento con retryOpenCv y no entra en bucle infinito", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => {
          node.onerror?.(new Event("error") as unknown as string)
        }, 0)
      }
      return node
    })

    // Primer intento fallido
    await loadOpenCv()
    expect(canRetryOpenCv()).toBe(true)

    // Reintento manual controlado
    const retryResult = await retryOpenCv()
    expect(retryResult).toBeNull()

    // Ya se agotó el reintento
    expect(canRetryOpenCv()).toBe(false)
    expect(hasOpenCvFailed()).toBe(true)

    // Intentos adicionales de reintento no ejecutan más llamadas
    const thirdAttempt = await retryOpenCv()
    expect(thirdAttempt).toBeNull()
    expect(canRetryOpenCv()).toBe(false)

    appendSpy.mockRestore()
  })

  it("resuelve exitosamente si el script carga y expone el módulo usable", async () => {
    const mockCv = mockCvModule()
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => {
          ;(window as unknown as { cv: OpenCvModule }).cv = mockCv
          node.onload?.(new Event("load"))
        }, 0)
      }
      return node
    })

    const result = await loadOpenCv()
    expect(result).toBe(mockCv)
    expect(isOpenCvLoaded()).toBe(true)
    expect(hasOpenCvFailed()).toBe(false)
    expect(canRetryOpenCv()).toBe(false)

    appendSpy.mockRestore()
  })
})
