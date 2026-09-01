// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { DestinatarioResumen } from "../components/DestinatarioResumen"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosEditor } from "../components/EscritosEditor"
import { DestinatarioSelectorModal } from "../components/DestinatarioSelectorModal"
import { EscritosProposalModal } from "../components/EscritosProposalModal"
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

    const onBackToForm = vi.fn()

    render(
      <EscritosEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        onSaveDraft={vi.fn()}
        onGoToPreview={vi.fn()}
        onBackToForm={onBackToForm}
      />
    )

    expect(screen.getByText(/Dr\. Simbad Solorio Vargas/i)).toBeDefined()
    expect(screen.getByText(/Redactado con IA y fuentes verificadas/i)).toBeDefined()
    expect(screen.getByText(/1 norma citada/i)).toBeDefined()

    // Cambiar destinatario desde el editor regresa al formulario sin perder el borrador
    const btnCambiar = screen.getByRole("button", { name: /Cambiar/i })
    fireEvent.click(btnCambiar)
    expect(onBackToForm).toHaveBeenCalledTimes(1)
  })

  it("DestinatarioSelectorModal oculta categorías vacías y no muestra comités delegacionales sin datos", () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <DestinatarioSelectorModal
        isOpen={true}
        onClose={onClose}
        currentDestino={{ cargo: "", nombre: "" }}
        onSelectDestino={onSelect}
      />
    )

    // Secciones oficiales con integrantes deben ser visibles
    expect(screen.getAllByText(/Comité Ejecutivo/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Secretarías/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Comisiones/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Subcomisiones/i).length).toBeGreaterThan(0)

    // La categoría comités delegacionales (con 0 elementos) debe estar oculta
    expect(screen.queryByText(/Comités Delegacionales/i)).toBeNull()
  })

  it("DestinatarioSelectorModal permite capturar y aplicar un destinatario manual", () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <DestinatarioSelectorModal
        isOpen={true}
        onClose={onClose}
        currentDestino={{ cargo: "", nombre: "" }}
        onSelectDestino={onSelect}
        initialTab="manual"
      />
    )

    const cargoInput = screen.getByLabelText(/Cargo o puesto del destinatario/i)
    const nombreInput = screen.getByLabelText(/Nombre del destinatario/i)

    fireEvent.change(cargoInput, { target: { value: "Director HGZ No. 83" } })
    fireEvent.change(nombreInput, { target: { value: "Dr. Manuel Torres" } })

    const aplicarBtn = screen.getByRole("button", { name: /Aplicar destinatario/i })
    fireEvent.click(aplicarBtn)

    expect(onSelect).toHaveBeenCalledWith({
      cargo: "Director HGZ No. 83",
      nombre: "Dr. Manuel Torres",
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("EscritosProposalModal permite comparar propuesta, aceptar y rechazar", () => {
    const onAccept = vi.fn()
    const onDiscard = vi.fn()

    render(
      <EscritosProposalModal
        isOpen={true}
        title="Propuesta de redacción formal"
        description="Ajuste de registro institucional"
        originalText="Texto original con errores"
        proposedText="Texto formalmente pulido y corregido."
        onAccept={onAccept}
        onDiscard={onDiscard}
      />
    )

    expect(screen.getByText(/Propuesta de redacción formal/i)).toBeDefined()
    expect(screen.getByText(/Texto original con errores/i)).toBeDefined()
    expect(screen.getByText(/Texto formalmente pulido y corregido\./i)).toBeDefined()

    const btnAccept = screen.getByRole("button", { name: /Aplicar propuesta/i })
    fireEvent.click(btnAccept)
    expect(onAccept).toHaveBeenCalledTimes(1)

    const btnDiscard = screen.getByRole("button", { name: /Descartar cambios/i })
    fireEvent.click(btnDiscard)
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })
})
