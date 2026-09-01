// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { DestinatarioResumen } from "../components/DestinatarioResumen"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosEditor } from "../components/EscritosEditor"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("Componentes de UI del Generador de Escritos (DestinatarioResumen, Form y Editor)", () => {
  it("DestinatarioResumen renderiza de forma compacta con los datos oficiales y botón de cambio", () => {
    const handleChange = vi.fn()
    render(
      <DestinatarioResumen
        destino={{
          cargo: "Secretario General",
          nombre: "Dr. Simbad Solorio Vargas",
        }}
        onChangeRequest={handleChange}
      />
    )

    expect(screen.getByText(/Dr\. Simbad Solorio Vargas/i)).toBeDefined()
    expect(screen.getByText(/Secretario General/i)).toBeDefined()
    expect(screen.getByText(/Comité Ejecutivo Seccional XX Michoacán/i)).toBeDefined()

    const cambiarBtn = screen.getByRole("button", { name: /Cambiar/i })
    expect(cambiarBtn).toBeDefined()
    fireEvent.click(cambiarBtn)
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it("DestinatarioResumen indica discretamente cuando es un destinatario manual", () => {
    render(
      <DestinatarioResumen
        destino={{
          cargo: "Director HGZ No. 1",
          nombre: "Dr. Roberto Gómez",
        }}
      />
    )

    expect(screen.getByText(/Dr\. Roberto Gómez/i)).toBeDefined()
    expect(screen.getByText(/Director HGZ No\. 1/i)).toBeDefined()
    expect(screen.getByText(/Destinatario manual/i)).toBeDefined()
  })

  it("EscritosForm expone los dos modos: 'Ayúdame a redactarlo con IA' y 'Quiero escribirlo manualmente'", () => {
    const draft = createEmptyEscritoDraftV2("user-123")
    draft.destino = { cargo: "Secretario de Trabajo", nombre: "A.U.O. Sergio A. González González" }
    draft.hechos = "Notas de prueba de los antecedentes ocurridos."
    draft.peticion = "Solicitud de prueba."

    const onGenerate = vi.fn()
    const onManualEdit = vi.fn()
    const onUpdate = vi.fn()

    render(
      <EscritosForm
        userId="user-123"
        draft={draft}
        onUpdateDraft={onUpdate}
        onGenerate={onGenerate}
        onManualEdit={onManualEdit}
        isGenerating={false}
      />
    )

    const btnAi = screen.getByRole("button", { name: /Ayúdame a redactarlo con IA/i })
    const btnManual = screen.getByRole("button", { name: /Quiero escribirlo manualmente/i })

    expect(btnAi).toBeDefined()
    expect(btnManual).toBeDefined()

    // Clic en modo manual no invoca onGenerate
    fireEvent.click(btnManual)
    expect(onManualEdit).toHaveBeenCalledTimes(1)
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it("EscritosForm muestra banner amigable ante fallo de IA ofreciendo reintentar o modo manual", () => {
    const draft = createEmptyEscritoDraftV2("user-123")
    draft.destino = { cargo: "Secretario General", nombre: "Dr. Simbad Solorio Vargas" }
    const onRetry = vi.fn()
    const onManual = vi.fn()

    render(
      <EscritosForm
        userId="user-123"
        draft={draft}
        onUpdateDraft={vi.fn()}
        onGenerate={vi.fn()}
        onManualEdit={onManual}
        isGenerating={false}
        generationError="La redacción inteligente no está disponible en este momento."
        onRetryAI={onRetry}
      />
    )

    expect(screen.getAllByText(/La redacción inteligente no está disponible en este momento/i).length).toBeGreaterThan(0)

    const btnRetry = screen.getByRole("button", { name: /Reintentar con IA/i })
    const btnContinueManual = screen.getByRole("button", { name: /Continuar en modo manual/i })

    expect(btnRetry).toBeDefined()
    expect(btnContinueManual).toBeDefined()

    fireEvent.click(btnRetry)
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(btnContinueManual)
    expect(onManual).toHaveBeenCalledTimes(1)
  })

  it("EscritosEditor muestra el visor compacto y los indicadores discretos de modo", () => {
    const draft = createEmptyEscritoDraftV2("user-123")
    draft.cuerpo = "Cuerpo de prueba en el editor."
    draft.destino = { cargo: "Secretario General", nombre: "Dr. Simbad Solorio Vargas" }
    draft.generationMode = "ai_with_sources"
    draft.fuentes = [
      { documento: "CCT 2025-2027", version: "VIGENTE", fragmento: "Cláusula 40" },
    ]

    render(
      <EscritosEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        onSaveDraft={vi.fn()}
        onGoToPreview={vi.fn()}
        onBackToForm={vi.fn()}
      />
    )

    expect(screen.getByText(/Dr\. Simbad Solorio Vargas/i)).toBeDefined()
    expect(screen.getByText(/Redactado con IA y fuentes verificadas/i)).toBeDefined()
    expect(screen.getByText(/1 norma citada/i)).toBeDefined()
  })
})
