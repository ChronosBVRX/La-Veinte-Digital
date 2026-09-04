// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosResult } from "../components/EscritosResult"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("Generador de escritos: Flujo rediseñado y comprobaciones DOM", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("1. Botón 'Buscar en el directorio oficial' visible y clicable + dropdown redundante eliminado", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "", nombre: "" },
    })
    const onUpdateDraft = vi.fn()

    render(
      <EscritosForm
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Botón prominente de búsqueda oficial
    const buscarBtn = screen.getByRole("button", { name: /Buscar en el directorio oficial/i })
    expect(buscarBtn).toBeDefined()
    expect(buscarBtn.style.minHeight).toBe("46px")

    // Eliminación demostrada del dropdown masivo redundante
    expect(document.querySelector("select#escrito-destinatario")).toBeNull()

    // Clic en buscar debe abrir el modal de directorio
    fireEvent.click(buscarBtn)
    expect(screen.getByText(/Seleccionar Destinatario del Escrito/i)).toBeDefined()
    expect(screen.getByRole("tab", { name: /Directorio Oficial/i })).toBeDefined()
  })

  it("2. Visor del destinatario seleccionado mostrando: Nombre, Cargo y Órgano", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "Secretario de Trabajo", nombre: "A.U.O. Sergio A. González González" },
    })

    render(
      <EscritosForm
        userId="usr-1"
        draft={draft}
        onUpdateDraft={vi.fn()}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Nombre del destinatario
    expect(screen.getByText(/A\.U\.O\. Sergio A\. González González/i)).toBeDefined()

    // Cargo
    expect(screen.getByText(/Secretario de Trabajo/i)).toBeDefined()

    // Órgano / adscripción del catálogo oficial
    expect(screen.getByText(/Secretaría de Trabajo/i)).toBeDefined()
  })

  it("3. Botón 'Cambiar' reabre el directorio y botón 'Quitar' limpia la selección", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "Secretario de Trabajo", nombre: "A.U.O. Sergio A. González González" },
    })
    const onUpdateDraft = vi.fn()

    render(
      <EscritosForm
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    const cambiarBtn = screen.getByRole("button", { name: /Cambiar/i })
    const quitarBtn = screen.getByRole("button", { name: /Quitar/i })
    expect(cambiarBtn).toBeDefined()
    expect(quitarBtn).toBeDefined()

    // Clic en Cambiar abre el directorio
    fireEvent.click(cambiarBtn)
    expect(screen.getByText(/Seleccionar Destinatario del Escrito/i)).toBeDefined()

    // Clic en Quitar limpia la selección
    fireEvent.click(quitarBtn)
    expect(onUpdateDraft).toHaveBeenCalledWith({
      destino: { cargo: "", nombre: "" },
    })
  })

  it("4. Modo manual intacto: alternancia y captura manual de cargo y nombre", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "", nombre: "" },
    })
    const onUpdateDraft = vi.fn()

    render(
      <EscritosForm
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    const manualToggleBtn = screen.getByRole("button", { name: /O escribir destinatario manualmente/i })
    expect(manualToggleBtn).toBeDefined()

    fireEvent.click(manualToggleBtn)

    // El modal abre directamente en la pestaña manual
    expect(screen.getByText(/Seleccionar Destinatario del Escrito/i)).toBeDefined()

    // Los campos manuales deben aparecer
    const cargoInput = screen.getByLabelText(/Cargo o puesto del destinatario/i)
    const nombreInput = screen.getByLabelText(/Nombre del destinatario/i)
    expect(cargoInput).toBeDefined()
    expect(nombreInput).toBeDefined()

    fireEvent.change(cargoInput, { target: { value: "Jefe de Personal" } })
    fireEvent.change(nombreInput, { target: { value: "Dr. López" } })

    const aplicarBtn = screen.getByRole("button", { name: /Aplicar destinatario/i })
    fireEvent.click(aplicarBtn)

    expect(onUpdateDraft).toHaveBeenCalledWith({
      destino: { cargo: "Jefe de Personal", nombre: "Dr. López" },
    })
  })

  it("5. Acciones posteriores en resultado intactas (exportar/compartir, imprimir, firmar, guardar)", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      titulo: "Solicitud de Vacaciones",
      cuerpo: "Por medio de la presente solicito formalmente...",
      destino: { cargo: "Secretario de Trabajo", nombre: "A.U.O. Sergio A. González González" },
    })

    const onSaveDraft = vi.fn()
    const onBackToEditor = vi.fn()

    render(
      <EscritosResult
        userId="usr-1"
        draft={draft}
        onUpdateDraft={vi.fn()}
        onSaveDraft={onSaveDraft}
        onBackToEditor={onBackToEditor}
      />
    )

    // Acciones presentes tanto en cabecera como en barra inferior
    expect(screen.getByRole("button", { name: /Volver al editor/i })).toBeDefined()
    const guardarBtns = screen.getAllByRole("button", { name: /Guardar en mis documentos/i })
    expect(guardarBtns.length).toBeGreaterThanOrEqual(1)
    const imprimirBtns = screen.getAllByRole("button", { name: /Imprimir/i })
    expect(imprimirBtns.length).toBeGreaterThanOrEqual(1)
    const compartirBtns = screen.getAllByRole("button", { name: /Compartir/i })
    expect(compartirBtns.length).toBeGreaterThanOrEqual(1)

    // Inserción de firma digitalizada
    expect(screen.getByRole("button", { name: /Insertar firma digitalizada/i })).toBeDefined()

    // Clic en guardar
    fireEvent.click(guardarBtns[0])
    expect(onSaveDraft).toHaveBeenCalled()
  })
})
