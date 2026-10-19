// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PdfViewer } from "../PdfViewer"

// Mock de fetch y loadPdfDocument
vi.mock("@/shared/lib/pdfjs-client", () => ({
  loadPdfDocument: vi.fn(async () => ({
    pdf: {
      numPages: 10,
      getPage: vi.fn(async (num: number) => ({
        pageNumber: num,
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => ({ promise: Promise.resolve() }),
        getTextContent: async () => ({
          items: [
            {
              str: "Cláusula 89 del Contrato Colectivo",
              transform: [1, 0, 0, 1, 50, 700],
              width: 120,
              height: 14,
            },
          ],
        }),
      })),
    },
    loadingTask: {
      destroy: vi.fn(),
    },
  })),
}))

vi.mock("@/features/documentos-personales/services/normativa-boveda", () => ({
  saveNormativaToVault: vi.fn(),
  isNormativaInVault: vi.fn(() => false),
}))

describe("PdfViewer - Lector Comercial con Búsqueda y Zoom", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async () => {
      // Simular buffer de PDF válido (%PDF)
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "application/pdf",
          "X-Normativa-Format": "pdf",
        }),
        arrayBuffer: async () => pdfHeader.buffer,
      } as unknown as Response
    })
  })

  it("renderiza la barra de herramientas completa con botones de búsqueda, zoom y bóveda", async () => {
    render(
      <PdfViewer
        documentId="CCT-2025-2027"
        title="Contrato Colectivo 2025-2027"
        keyLabel="CCT"
        category="cct"
      />
    )

    // Debe mostrar controles principales
    await waitFor(() => {
      expect(screen.getByTitle("Buscar palabras o cláusulas en el documento (Ctrl+F)")).toBeTruthy()
      expect(screen.getByTitle("Alejar (Zoom -)")).toBeTruthy()
      expect(screen.getByTitle("Acercar (Zoom +)")).toBeTruthy()
      expect(screen.getByTitle("Restablecer zoom al 130%")).toBeTruthy()
      expect(screen.getByTitle("Guardar en tu Bóveda de Documentos")).toBeTruthy()
    })
  })

  it("permite abrir y cerrar el panel de búsqueda comercial", async () => {
    render(
      <PdfViewer
        documentId="CCT-2025-2027"
        title="Contrato Colectivo 2025-2027"
      />
    )

    await waitFor(() => {
      expect(screen.getByTitle("Buscar palabras o cláusulas en el documento (Ctrl+F)")).toBeTruthy()
    })

    const searchBtn = screen.getByTitle("Buscar palabras o cláusulas en el documento (Ctrl+F)")
    fireEvent.click(searchBtn)

    // El input de búsqueda debe aparecer
    const input = screen.getByPlaceholderText("Buscar palabra o frase (ej. vacaciones, cláusula 89)...") as HTMLInputElement
    expect(input).toBeTruthy()

    // Escribir texto de búsqueda
    fireEvent.change(input, { target: { value: "clausula 89" } })
    expect(input.value).toBe("clausula 89")

    // Cerrar búsqueda
    const closeBtn = screen.getByTitle("Cerrar búsqueda (Esc)")
    fireEvent.click(closeBtn)

    expect(screen.queryByPlaceholderText("Buscar palabra o frase (ej. vacaciones, cláusula 89)...")).toBeNull()
  })

  it("soporta controles interactivos de zoom in y zoom out", async () => {
    render(
      <PdfViewer
        documentId="CCT-2025-2027"
        title="Contrato Colectivo 2025-2027"
      />
    )

    await waitFor(() => {
      expect(screen.getByTitle("Restablecer zoom al 130%").textContent).toBe("130%")
    })

    const zoomInBtn = screen.getByTitle("Acercar (Zoom +)")
    fireEvent.click(zoomInBtn)

    await waitFor(() => {
      expect(screen.getByTitle("Restablecer zoom al 130%").textContent).toBe("150%")
    })

    const zoomOutBtn = screen.getByTitle("Alejar (Zoom -)")
    fireEvent.click(zoomOutBtn)

    await waitFor(() => {
      expect(screen.getByTitle("Restablecer zoom al 130%").textContent).toBe("130%")
    })
  })

  it("permite abrir el popover para ir directamente a un número de página", async () => {
    render(
      <PdfViewer
        documentId="CCT-2025-2027"
        title="Contrato Colectivo 2025-2027"
      />
    )

    await waitFor(() => {
      expect(screen.getByTitle("Clic para ir directamente a un número de página")).toBeTruthy()
    })

    const pageJumpBtn = screen.getByTitle("Clic para ir directamente a un número de página")
    fireEvent.click(pageJumpBtn)

    // Debe desplegar el input de número de página
    expect(screen.getByPlaceholderText("1 - 10")).toBeTruthy()
  })
})
