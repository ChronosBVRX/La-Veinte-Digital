// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CommitmentForm } from "../components/CommitmentForm"

describe("CommitmentForm: campos específicos por registro", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const renderForm = () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<CommitmentForm open onClose={onClose} onSave={onSave} userId="user-1" />)
    return { onSave, onClose }
  }

  it("ofrece únicamente los cuatro registros principales y retira cambio de turno", () => {
    renderForm()

    expect(screen.getByRole("button", { name: /Tiempo extra/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Deporte/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Falta injustificada/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Reclamación pendiente/i })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Cambio de turno/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Sustitución TxT/i })).toBeNull()
  })

  it("tiempo extra solicita horario, lugar, servicio y autorización", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Tiempo extra/i }))

    fireEvent.change(screen.getByLabelText(/Fecha del tiempo extra/i), { target: { value: "2026-09-20" } })
    fireEvent.change(screen.getByLabelText(/Inicio/i), { target: { value: "16:00" } })
    fireEvent.change(screen.getByLabelText(/Término/i), { target: { value: "20:00" } })
    fireEvent.change(screen.getByLabelText(/Área o servicio/i), { target: { value: "Rayos X" } })
    fireEvent.change(screen.getByLabelText(/Unidad o centro de trabajo/i), { target: { value: "HGR 1" } })
    fireEvent.change(screen.getByLabelText(/Quién autorizó/i), { target: { value: "Jefatura" } })
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y recordarme/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "overtime",
      service: "Rayos X",
      workplace: "HGR 1",
      details: { authorizedBy: "Jefatura" },
    }))
  })

  it("deporte guarda actividad, modalidad, horario y lugar", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Deporte/i }))

    fireEvent.change(screen.getByLabelText(/Actividad deportiva/i), { target: { value: "Fútbol" } })
    fireEvent.change(screen.getByLabelText(/Cómo usarás el tiempo/i), { target: { value: "early_departure" } })
    fireEvent.change(screen.getByLabelText(/^Fecha/i), { target: { value: "2026-09-21" } })
    fireEvent.change(screen.getByLabelText(/Inicio/i), { target: { value: "18:00" } })
    fireEvent.change(screen.getByLabelText(/Término/i), { target: { value: "20:00" } })
    fireEvent.change(screen.getByLabelText(/Lugar/i), { target: { value: "Unidad deportiva" } })
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y recordarme/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "sport",
      title: "Deporte: Fútbol",
      workplace: "Unidad deportiva",
      details: { activity: "Fútbol", sportModality: "early_departure" },
    }))
  })

  it("falta injustificada es un registro de día completo sin recordatorios ni horario", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Falta injustificada/i }))

    expect(screen.queryByLabelText(/Inicio/i)).toBeNull()
    expect(screen.queryByLabelText(/Término/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/Fecha de la falta/i), { target: { value: "2026-09-18" } })
    fireEvent.change(screen.getByLabelText(/Turno afectado/i), { target: { value: "afternoon" } })
    fireEvent.change(screen.getByLabelText(/Qué ocurrió/i), { target: { value: "No se reconoció el justificante" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar registro/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "falta_injustificada",
      notes: "No se reconoció el justificante",
      details: { allDay: true, affectedShift: "afternoon" },
      reminder: { dayBefore: false, hoursBefore: false, atStart: false },
    }))
  })

  it("reclamación pendiente separa presentación y próximo seguimiento", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Reclamación pendiente/i }))

    fireEvent.change(screen.getByLabelText(/Qué estás reclamando/i), { target: { value: "Pago de tiempo extra" } })
    fireEvent.change(screen.getByLabelText(/Fecha en que presentaste/i), { target: { value: "2026-09-15" } })
    fireEvent.change(screen.getByLabelText(/Folio u oficio/i), { target: { value: "OF-123" } })
    fireEvent.change(screen.getByLabelText(/Con quién darás seguimiento/i), { target: { value: "Nómina" } })
    fireEvent.change(screen.getByLabelText(/Próxima fecha de seguimiento/i), { target: { value: "2026-09-22" } })
    fireEvent.change(screen.getByLabelText(/Hora para recordarte/i), { target: { value: "10:00" } })
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar seguimiento/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "no_pagado",
      title: "Pago de tiempo extra",
      details: {
        claimFiledDate: "2026-09-15",
        claimReference: "OF-123",
        responsibleArea: "Nómina",
      },
      reminder: { dayBefore: true, hoursBefore: false, atStart: true },
    }))
  })
})
