// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DocumentPreviewModal } from "../DocumentPreviewModal"
import type { LibraryDocumentEntry } from "../../services/catalog"

const mockCctDoc: LibraryDocumentEntry = {
  id: "CCT-IMSS-SNTSS-2025-2027",
  title: "Contrato Colectivo de Trabajo 2025-2027",
  type: "collective_agreement",
  key: "CCT 2025-2027",
  validity: "CURRENT",
  category: "cct",
  organization: ["IMSS", "SNTSS"],
  url: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
}

const mockProcedureDoc: LibraryDocumentEntry = {
  id: "PROC-ENFERMERIA-TRIAGE",
  title: "Procedimiento de atención de enfermería en triage y urgencias",
  type: "procedure",
  key: "PROC-ENF-001",
  validity: "CURRENT",
  category: "flujos-clinicos",
  organization: ["IMSS"],
}

describe("DocumentPreviewModal - Modal Intermedio Pedagógico", () => {
  it("no se renderiza si isOpen es falso", () => {
    const { container } = render(
      <DocumentPreviewModal
        doc={mockCctDoc}
        isOpen={false}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("muestra el título, estado de vigencia, qué contiene y para quién aplica", () => {
    render(
      <DocumentPreviewModal
        doc={mockCctDoc}
        isOpen={true}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
      />
    )

    // Badges y clave
    expect(screen.getByText("🟢 VIGENTE")).toBeTruthy()
    expect(screen.getByText("CCT 2025-2027")).toBeTruthy()

    // Encabezados obligatorios solicitados por el usuario
    expect(screen.getByText("¿Qué contiene este documento?")).toBeTruthy()
    expect(screen.getByText("¿Para quién aplica?")).toBeTruthy()

    // Verificación de contenido específico
    expect(screen.getByText(/El Contrato Colectivo de Trabajo es el documento más importante/i)).toBeTruthy()
    expect(screen.getByText(/Trabajadores de base/i)).toBeTruthy()
  })

  it("sintetiza correctamente qué contiene y para quién aplica para documentos sin ficha previa", () => {
    render(
      <DocumentPreviewModal
        doc={mockProcedureDoc}
        isOpen={true}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
      />
    )

    expect(screen.getByText("¿Qué contiene este documento?")).toBeTruthy()
    expect(screen.getByText("¿Para quién aplica?")).toBeTruthy()
    expect(screen.getByText(/Personal de enfermería/i)).toBeTruthy()
  })

  it("llama a onOpenReader cuando se pulsa el botón 'Abrir documento en el lector'", () => {
    const handleOpenReader = vi.fn()
    const handleClose = vi.fn()

    render(
      <DocumentPreviewModal
        doc={mockCctDoc}
        isOpen={true}
        onClose={handleClose}
        onOpenReader={handleOpenReader}
      />
    )

    const openBtn = screen.getByTitle("Abrir documento en el lector oficial interactivo")
    fireEvent.click(openBtn)

    expect(handleOpenReader).toHaveBeenCalledWith(mockCctDoc)
    expect(handleClose).toHaveBeenCalled()
  })

  it("llama a onClose cuando se pulsa 'Volver al catálogo' o el botón de cierre X", () => {
    const handleClose = vi.fn()

    render(
      <DocumentPreviewModal
        doc={mockCctDoc}
        isOpen={true}
        onClose={handleClose}
        onOpenReader={vi.fn()}
      />
    )

    const returnBtn = screen.getByTitle("Regresar a la cuadrícula de documentos")
    fireEvent.click(returnBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)

    const closeBtn = screen.getByTitle("Cerrar ventana (Esc)")
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledTimes(2)
  })
})
