// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosEditor } from "../components/EscritosEditor"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("Flujo UI del Generador de Escritos", () => {
  it("EscritosForm: valida con mensaje amistoso si falta destinatario", () => {
    const onGenerate = vi.fn()
    const onUpdateDraft = vi.fn()
    const draft = createEmptyEscritoDraftV2("usr_test", "solicitud", {
      destino: { cargo: "", nombre: "" },
      hechos: "Hechos de prueba...",
      peticion: "Petición de prueba...",
    })

    render(
      <EscritosForm
        userId="usr_test"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={onGenerate}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    const submitBtn = screen.getByRole("button", { name: /Ayúdame a redactarlo con IA/i })
    fireEvent.click(submitBtn)

    expect(onGenerate).not.toHaveBeenCalled()
    expect(screen.getByText(/Por favor especifica a quién va dirigido el escrito/i)).toBeDefined()
  })

  it("EscritosForm: permite seleccionar tipo de escrito, toggle de fundamentación y opciones avanzadas", () => {
    const onGenerate = vi.fn()
    const onUpdateDraft = vi.fn()
    const draft = createEmptyEscritoDraftV2("usr_test", "solicitud", {
      incluirFundamentos: true,
    })

    render(
      <EscritosForm
        userId="usr_test"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={onGenerate}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Seleccionar Queja
    const quejaBtn = screen.getByRole("button", { name: /Queja/i })
    fireEvent.click(quejaBtn)
    expect(onUpdateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "queja" })
    )

    // Desplegar opciones avanzadas
    const advancedToggle = screen.getByRole("button", { name: /Opciones avanzadas/i })
    fireEvent.click(advancedToggle)
    expect(screen.getByText(/Título de referencia interna/i)).toBeDefined()

    // Toggle de checkbox fundamentación
    const check = screen.getByLabelText(/Fundamentar con normas y cláusulas del Contrato Colectivo/i)
    fireEvent.click(check)
    expect(onUpdateDraft).toHaveBeenCalledWith({ incluirFundamentos: false })
  })

  it("EscritosEditor: renderiza advertencias de fuentes y permite avanzar a la vista previa", () => {
    const onUpdateDraft = vi.fn()
    const onSaveDraft = vi.fn()
    const onGoToPreview = vi.fn()
    const onBackToForm = vi.fn()

    const draft = createEmptyEscritoDraftV2("usr_test", "solicitud", {
      cuerpo: "Texto del borrador generado formalmente.",
      generationMode: "ai_without_sources",
    })

    render(
      <EscritosEditor
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onSaveDraft={onSaveDraft}
        onGoToPreview={onGoToPreview}
        onBackToForm={onBackToForm}
      />
    )

    // Verifica indicador visible
    expect(
      screen.getByText(/Redactado con IA/i)
    ).toBeDefined()

    // Botón avanzar
    const previewBtn = screen.getByRole("button", { name: /Ver vista previa y firmar/i })
    fireEvent.click(previewBtn)
    expect(onGoToPreview).toHaveBeenCalledTimes(1)
  })
})
