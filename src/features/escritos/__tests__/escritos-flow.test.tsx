// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosEditor } from "../components/EscritosEditor"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("Flujo UI del Generador de Escritos", () => {
  it("EscritosForm: valida que no se genere si faltan hechos y petición", () => {
    const onGenerate = vi.fn()
    const onUpdateDraft = vi.fn()
    const draft = createEmptyEscritoDraftV2("usr_test", "solicitud", {
      hechos: "",
      peticion: "",
    })

    render(
      <EscritosForm
        userId="usr_test"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={onGenerate}
        isGenerating={false}
      />
    )

    const submitBtn = screen.getByRole("button", { name: /Redactar borrador con IA/i })
    fireEvent.click(submitBtn)

    expect(onGenerate).not.toHaveBeenCalled()
    expect(screen.getByText(/Por favor describe los hechos o lo que solicitas/i)).toBeDefined()
  })

  it("EscritosForm: permite seleccionar tipo de escrito y desplegar opciones avanzadas", () => {
    const onGenerate = vi.fn()
    const onUpdateDraft = vi.fn()
    const draft = createEmptyEscritoDraftV2("usr_test", "solicitud")

    render(
      <EscritosForm
        userId="usr_test"
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={onGenerate}
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
    expect(screen.getByText(/Asunto formal del oficio/i)).toBeDefined()
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

    // Verifica advertencia visible
    expect(
      screen.getByText(/Borrador generado sin fuentes normativas verificadas/i)
    ).toBeDefined()

    // Botón avanzar
    const previewBtn = screen.getByRole("button", { name: /Ver vista previa y firmar/i })
    fireEvent.click(previewBtn)
    expect(onGoToPreview).toHaveBeenCalledTimes(1)
  })
})
