// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DocumentScannerReview } from "../components/DocumentScannerReview"
import type { ScanPage } from "../types/scanner-types"

function page(id: string): ScanPage {
  return {
    id,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    previewUrl: `blob:preview-${id}`,
    width: 100,
    height: 140,
    filter: "original",
    rotation: 0,
    engine: "mlkit",
  }
}

function baseProps(pages: ScanPage[]) {
  return {
    mode: "ine-front" as const,
    pages,
    busy: false,
    error: null,
    saveToDocuments: true,
    nativeEngine: true,
    onToggleSave: vi.fn(),
    onChangeFilter: vi.fn(),
    onRotate: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onAddPage: vi.fn(),
    onRetake: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  }
}

describe("DocumentScannerReview (INE)", () => {
  it("deshabilita guardar con una sola cara", () => {
    render(<DocumentScannerReview {...baseProps([page("a")])} />)
    const save = screen.getByRole("button", { name: /Guardar PDF/i }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it("habilita guardar con frente y reverso", () => {
    render(<DocumentScannerReview {...baseProps([page("a"), page("b")])} />)
    const save = screen.getByRole("button", { name: /Guardar PDF/i }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(screen.getByText("Frente")).toBeDefined()
    expect(screen.getByText("Reverso")).toBeDefined()
  })

  it("en INE no ofrece reordenar ni agregar páginas", () => {
    render(<DocumentScannerReview {...baseProps([page("a"), page("b")])} />)
    expect(screen.queryByRole("button", { name: /Mover arriba/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Mover abajo/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Agregar página/i })).toBeNull()
  })

  it("en documento normal ofrece agregar página y reordenar", () => {
    const props = { ...baseProps([page("a"), page("b")]), mode: "document" as const }
    render(<DocumentScannerReview {...props} />)
    expect(screen.getByRole("button", { name: /Agregar página/i })).toBeDefined()
    expect(screen.getAllByRole("button", { name: /Mover abajo/i }).length).toBe(2)
  })

  it("cancelar llama onCancel", () => {
    const props = baseProps([page("a"), page("b")])
    render(<DocumentScannerReview {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it("la casilla explica claramente si el documento se conservará", () => {
    const { rerender } = render(<DocumentScannerReview {...baseProps([page("a"), page("b")])} />)
    expect(screen.getByText(/se conservará en Documentos personales/i)).toBeDefined()

    rerender(<DocumentScannerReview {...baseProps([page("a"), page("b")])} saveToDocuments={false} />)
    expect(screen.getByText(/no se guardará en el dispositivo/i)).toBeDefined()
  })

  it("en INE sólo muestra el filtro Original para no degradar la identificación", () => {
    render(<DocumentScannerReview {...baseProps([page("a"), page("b")])} />)
    expect(screen.getAllByRole("button", { name: "Original" }).length).toBe(2)
    expect(screen.queryByRole("button", { name: "Documento" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Grises" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Blanco y negro" })).toBeNull()
  })
})

describe("DocumentScannerReview (Documento)", () => {
  it("en modo documento muestra los 4 filtros con etiquetas correctas", () => {
    const props = { ...baseProps([page("a")]), mode: "document" as const }
    render(<DocumentScannerReview {...props} />)
    expect(screen.getByRole("button", { name: "Original" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Documento" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Grises" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Blanco y negro" })).toBeDefined()
  })

  it("tocar la miniatura abre la vista previa ampliada y permite cambiar filtros", () => {
    const props = { ...baseProps([page("a")]), mode: "document" as const }
    render(<DocumentScannerReview {...props} />)

    // Al inicio no hay modal
    expect(screen.queryByRole("dialog", { name: "Vista previa ampliada" })).toBeNull()

    // Tocar la miniatura
    const thumb = screen.getByRole("button", { name: /Ver Página 1 en grande/i })
    fireEvent.click(thumb)

    // El modal de vista previa ampliada se abre
    const dialog = screen.getByRole("dialog", { name: "Vista previa ampliada" })
    expect(dialog).toBeDefined()

    // En el modal se pueden cambiar los filtros directamente en grande
    const docFilterBtn = dialog.querySelector("button[name='Documento']") || screen.getAllByRole("button", { name: "Documento" })[1]
    fireEvent.click(docFilterBtn)
    expect(props.onChangeFilter).toHaveBeenCalledWith("a", "enhanced")

    // Cerrar el modal con el botón X
    const closeBtn = screen.getByRole("button", { name: "Cerrar vista previa ampliada" })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole("dialog", { name: "Vista previa ampliada" })).toBeNull()
  })
})

