// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { useWebCamera } from "../hooks/useWebCamera"
import { ScanCaptureStep } from "../components/ScanCaptureStep"
import { ScanCornerEditor } from "../components/ScanCornerEditor"
import { DocumentScannerReview } from "../components/DocumentScannerReview"
import type { AnalysisImage } from "../services/web-document-scanner"
import type { ScanPage } from "../types/scanner-types"

function createMockRaster(width = 800, height = 600): AnalysisImage {
  const data = new Uint8ClampedArray(width * height * 4)
  return {
    raster: {
      width,
      height,
      data,
    },
    scaleToSource: 1,
  }
}

function mockPage(id: string): ScanPage {
  return {
    id,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    previewUrl: `blob:preview-${id}`,
    width: 800,
    height: 1100,
    filter: "original",
    rotation: 0,
    engine: "web",
  }
}

import type { UseWebCameraResult } from "../hooks/useWebCamera"

function createMockCamera(overrides?: Partial<UseWebCameraResult>): UseWebCameraResult {
  return {
    status: "ready",
    error: null,
    permanentlyDenied: false,
    attachVideo: vi.fn(),
    start: vi.fn().mockResolvedValue(true),
    stop: vi.fn(),
    capture: vi.fn().mockResolvedValue({
      ok: true,
      blob: new Blob(["img"], { type: "image/jpeg" }),
      width: 1280,
      height: 720,
    }),
    ...overrides,
  }
}

describe("useWebCamera: Robustez de fotogramas y captura", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("capture antes de videoWidth/videoHeight válidos no falla silenciosamente y devuelve error controlado", async () => {
    function TestCameraComponent({ onCaptureResult }: { onCaptureResult: (res: unknown) => void }) {
      const camera = useWebCamera()
      return (
        <div>
          <video
            ref={(el) => {
              camera.attachVideo(el)
            }}
          />
          <button
            onClick={async () => {
              const res = await camera.capture()
              onCaptureResult(res)
            }}
          >
            Capturar
          </button>
        </div>
      )
    }

    let result: unknown = null
    render(<TestCameraComponent onCaptureResult={(res) => (result = res)} />)

    const btn = screen.getByRole("button", { name: "Capturar" })
    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(result).not.toBeNull()
    })

    const captureRes = result as { ok: boolean; error?: string }
    expect(captureRes.ok).toBe(false)
    expect(captureRes.error).toContain("No pudimos obtener la foto")
  })

  it("capture exitoso cuando el video tiene dimensiones válidas", async () => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(new Blob(["fake-image"], { type: "image/jpeg" }))
    }

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    function TestCameraReadyComponent({ onCaptureResult }: { onCaptureResult: (res: unknown) => void }) {
      const camera = useWebCamera()
      return (
        <div>
          <video
            ref={(el) => {
              if (el) {
                Object.defineProperty(el, "videoWidth", { value: 1280, configurable: true })
                Object.defineProperty(el, "videoHeight", { value: 720, configurable: true })
                Object.defineProperty(el, "readyState", { value: 4, configurable: true })
              }
              camera.attachVideo(el)
            }}
          />
          <button
            onClick={async () => {
              const res = await camera.capture()
              onCaptureResult(res)
            }}
          >
            Capturar
          </button>
        </div>
      )
    }

    let result: unknown = null
    render(<TestCameraReadyComponent onCaptureResult={(res) => (result = res)} />)

    const btn = screen.getByRole("button", { name: "Capturar" })
    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(result).not.toBeNull()
    })

    const captureRes = result as { ok: boolean; blob?: Blob; width?: number; height?: number }
    expect(captureRes.ok).toBe(true)
    expect(captureRes.blob).toBeDefined()
    expect(captureRes.width).toBe(1280)
    expect(captureRes.height).toBe(720)

    HTMLCanvasElement.prototype.toBlob = originalToBlob
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })
})

describe("ScanCaptureStep: Feedback inmediato y prevención de doble tap", () => {
  it("muestra estado Capturando de inmediato al pulsar el disparador", async () => {
    const onCapture = vi.fn()

    const mockCam = createMockCamera({
      capture: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        blob: new Blob(["image-data"], { type: "image/jpeg" }),
        width: 1280,
        height: 720,
      }), 60))),
    })

    render(
      <ScanCaptureStep
        title="Escanea el documento"
        hint="Centra la hoja"
        cameraOverride={mockCam}
        onCapture={onCapture}
      />
    )

    const shutter = screen.getByRole("button", { name: "Capturar" })
    fireEvent.click(shutter)

    // En el mismo instante del tap cambia la etiqueta accesible a "Capturando…"
    expect(screen.getByRole("button", { name: "Capturando…" })).toBeDefined()
  })

  it("bloquea doble tap para no disparar dos capturas simultáneas", async () => {
    const onCapture = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)))
    const mockCam = createMockCamera({
      capture: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        blob: new Blob(["image-data"], { type: "image/jpeg" }),
        width: 1280,
        height: 720,
      }), 150))),
    })

    render(
      <ScanCaptureStep
        title="Escanea el documento"
        cameraOverride={mockCam}
        onCapture={onCapture}
      />
    )

    const shutter = screen.getByRole("button", { name: "Capturar" })
    fireEvent.click(shutter)
    fireEvent.click(shutter)
    fireEvent.click(shutter)

    // Solo se debe iniciar una vez
    expect(shutter.getAttribute("aria-label")).toBe("Capturando…")
    expect(mockCam.capture).toHaveBeenCalledTimes(1)
  })

  it("un error en captura no cierra la cámara y muestra un mensaje visible", async () => {
    const mockCam = createMockCamera({
      capture: vi.fn().mockResolvedValue({
        ok: false,
        error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
      }),
    })

    render(
      <ScanCaptureStep
        title="Escanea el documento"
        cameraOverride={mockCam}
        onCapture={vi.fn()}
      />
    )

    const shutter = screen.getByRole("button", { name: "Capturar" })
    await act(async () => {
      fireEvent.click(shutter)
    })

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
      expect(screen.getByText(/No pudimos obtener la foto/i)).toBeDefined()
    })
    expect(mockCam.stop).not.toHaveBeenCalled()
  })

  it("muestra mensajes de estado durante el análisis ('Procesando foto…' y 'Detectando bordes…')", () => {
    const { rerender } = render(
      <ScanCaptureStep
        title="Escanea el documento"
        processingPhase="processing"
        onCapture={vi.fn()}
      />
    )

    expect(screen.getByText("Procesando foto…")).toBeDefined()

    rerender(
      <ScanCaptureStep
        title="Escanea el documento"
        processingPhase="detecting"
        onCapture={vi.fn()}
      />
    )

    expect(screen.getByText("Detectando bordes…")).toBeDefined()
  })
})

describe("ScanCornerEditor: Geometría contenida en el viewport y alineación de handles", () => {
  it("muestra mensaje amable si no se detectaron bordes automáticos", () => {
    const analysis = createMockRaster(800, 600)
    render(
      <ScanCornerEditor
        analysis={analysis}
        detected={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRedetect={vi.fn()}
      />
    )

    expect(screen.getByText(/No detectamos bien los bordes/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Aplicar recorte/i })).toBeDefined()
  })

  it("mantiene intacta la relación de aspecto del raster y posiciona los 4 handles exactamente", () => {
    const analysis = createMockRaster(1200, 1600)
    render(
      <ScanCornerEditor
        analysis={analysis}
        detected={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRedetect={vi.fn()}
      />
    )

    const handles = [
      screen.getByRole("button", { name: "Esquina 1" }),
      screen.getByRole("button", { name: "Esquina 2" }),
      screen.getByRole("button", { name: "Esquina 3" }),
      screen.getByRole("button", { name: "Esquina 4" }),
    ]

    expect(handles.length).toBe(4)

    // Comprobar que los handles están expresados porcentualmente respecto a las dimensiones del raster
    handles.forEach((h) => {
      expect(h.style.left).toMatch(/%$/)
      expect(h.style.top).toMatch(/%$/)
    })
  })

  it("la barra inferior contiene Cancelar y Aplicar recorte siempre accesibles", () => {
    const analysis = createMockRaster(800, 600)
    render(
      <ScanCornerEditor
        analysis={analysis}
        detected={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRedetect={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Aplicar recorte" })).toBeDefined()
    expect(screen.getByRole("button", { name: /Automático/i })).toBeDefined()
    expect(screen.getByRole("button", { name: "Reiniciar" })).toBeDefined()
  })
})

describe("DocumentScannerReview: Barra inferior persistente/sticky en móvil", () => {
  it("mantiene el botón de acción principal 'Enviar a imprimir' visible con barra fija", () => {
    const pages = [mockPage("p1"), mockPage("p2"), mockPage("p3")]
    render(
      <DocumentScannerReview
        mode="document"
        intent="print"
        pages={pages}
        busy={false}
        error={null}
        saveToDocuments={false}
        nativeEngine={false}
        onToggleSave={vi.fn()}
        onChangeFilter={vi.fn()}
        onRotate={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onAddPage={vi.fn()}
        onRetake={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    const cta = screen.getByRole("button", { name: "Enviar a imprimir" })
    expect(cta).toBeDefined()
    // Comprobar que el contenedor padre del botón tiene position sticky
    const parentBar = cta.closest("div")
    expect(parentBar?.style.position).toBe("sticky")
    expect(parentBar?.style.bottom).toBe("0px")
  })
})
