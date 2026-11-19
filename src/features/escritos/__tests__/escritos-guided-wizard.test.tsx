// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { EscritosGuidedWizard } from "../components/EscritosGuidedWizard"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("EscritosGuidedWizard: UX Clara de Destinatario (Elegir Comité vs Escribir Delegado)", () => {
  it("muestra claramente los 2 modos: 'Comité Seccional (Escoger)' y 'Mi Delegado / Local (Escribir)'", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "", nombre: "" },
    })

    render(
      <EscritosGuidedWizard
        userId="usr-1"
        draft={draft}
        onUpdateDraft={vi.fn()}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Comprobamos la presencia de las dos pestañas explícitas
    expect(screen.getByRole("tab", { name: /Comité Seccional/i })).toBeDefined()
    expect(screen.getByRole("tab", { name: /Mi Delegado \/ Local/i })).toBeDefined()

    // Subtítulos orientadores que diferencian escoger vs escribir
    expect(screen.getByText(/Escoger de la lista oficial/i)).toBeDefined()
    expect(screen.getByText(/Escribir nombre y cargo/i)).toBeDefined()
  })

  it("en modo Comité Seccional permite elegir a un integrante oficial con 1 solo toque", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "", nombre: "" },
    })
    const onUpdate = vi.fn()

    render(
      <EscritosGuidedWizard
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdate}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Tarjeta del Secretario General visible directamente
    const simbadBtn = screen.getByRole("button", { name: /Dr\. Simbad Solorio Vargas/i })
    expect(simbadBtn).toBeDefined()

    fireEvent.click(simbadBtn)
    expect(onUpdate).toHaveBeenCalledWith({
      destino: { cargo: "Secretaría General", nombre: "Dr. Simbad Solorio Vargas" },
    })
  })

  it("en modo Mi Delegado / Local muestra campos directos de texto y sugerencias rápidas", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "", nombre: "" },
    })
    const onUpdate = vi.fn()

    render(
      <EscritosGuidedWizard
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdate}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    // Cambiamos a la pestaña de escribir delegado
    const manualTab = screen.getByRole("tab", { name: /Mi Delegado \/ Local/i })
    fireEvent.click(manualTab)

    // Verificamos que los inputs de escritura aparecen en pantalla
    const cargoInput = screen.getByLabelText(/Cargo o representación sindical/i)
    const nombreInput = screen.getByLabelText(/Nombre del destinatario/i)
    expect(cargoInput).toBeDefined()
    expect(nombreInput).toBeDefined()

    // Verificamos sugerencias rápidas a 1 toque
    const chipDelegado = screen.getByRole("button", { name: /\+ Delegado Sindical/i })
    expect(chipDelegado).toBeDefined()
    fireEvent.click(chipDelegado)
    expect(onUpdate).toHaveBeenCalledWith({
      destino: { cargo: "Delegado Sindical", nombre: "" },
    })
  })

  it("muestra banner de destinatario configurado y permite limpiarlo", () => {
    const draft = createEmptyEscritoDraftV2("usr-1", "solicitud", {
      destino: { cargo: "Secretaría de Trabajo", nombre: "A.U.O. Sergio A. González González" },
    })
    const onUpdate = vi.fn()

    render(
      <EscritosGuidedWizard
        userId="usr-1"
        draft={draft}
        onUpdateDraft={onUpdate}
        onGenerate={vi.fn()}
        onManualEdit={vi.fn()}
        isGenerating={false}
      />
    )

    expect(screen.getByText(/Destinatario configurado:/i)).toBeDefined()
    expect(screen.getAllByText(/A\.U\.O\. Sergio A\. González González/i).length).toBeGreaterThanOrEqual(1)

    const limpiarBtn = screen.getByRole("button", { name: /Limpiar selección/i })
    fireEvent.click(limpiarBtn)
    expect(onUpdate).toHaveBeenCalledWith({
      destino: { cargo: "", nombre: "" },
    })
  })
})
