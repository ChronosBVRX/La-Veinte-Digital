// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CommitmentForm } from "../components/CommitmentForm"

describe("CommitmentForm: altas autorizadas y captura específica", () => {
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

  it("ofrece únicamente los cinco tipos autorizados y retira deporte y cambio de turno de nuevas altas", () => {
    renderForm()

    expect(screen.getByRole("button", { name: /Tiempo extra/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Falta injustificada/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Reclamación pendiente/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /TxT/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Recordatorio general/i })).toBeDefined()

    // Deporte y cambio de turno NO se deben ofrecer en altas
    expect(screen.queryByRole("button", { name: /Deporte/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Cambio de turno/i })).toBeNull()
  })

  it("1. tiempo extra solicita fecha, turno, horas y persona que autorizó", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Tiempo extra/i }))

    fireEvent.change(screen.getByLabelText(/Fecha del tiempo extra/i), { target: { value: "2026-09-20" } })
    fireEvent.change(screen.getByLabelText(/Turno/i), { target: { value: "morning" } })
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: "16:00" } })
    fireEvent.change(screen.getByLabelText(/Hora de término/i), { target: { value: "20:00" } })
    fireEvent.change(screen.getByLabelText(/Persona que autorizó/i), { target: { value: "Dra. Hernández" } })
    fireEvent.change(screen.getByLabelText(/Observaciones/i), { target: { value: "Cubre guardia de urgencias" } })

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y programar/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "overtime",
      notes: "Cubre guardia de urgencias",
      details: expect.objectContaining({
        shift: "morning",
        authorizedBy: "Dra. Hernández",
      }),
    }))
  })

  it("2. falta injustificada calcula quincena automáticamente y no requiere horario", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Falta injustificada/i }))

    expect(screen.queryByLabelText(/Hora de inicio/i)).toBeNull()
    expect(screen.queryByLabelText(/Hora de término/i)).toBeNull()

    // 18 de septiembre = 2ª quincena
    fireEvent.change(screen.getByLabelText(/Fecha de la falta/i), { target: { value: "2026-09-18" } })
    fireEvent.change(screen.getByLabelText(/Turno afectado/i), { target: { value: "afternoon" } })
    fireEvent.change(screen.getByLabelText(/Servicio o área/i), { target: { value: "Urgencias" } })
    fireEvent.change(screen.getByLabelText(/Motivo u observaciones/i), { target: { value: "Pase médico extemporáneo" } })

    // Comprueba el panel de cálculo automático
    expect(screen.getByText(/2ª quincena/i)).toBeDefined()

    // Falta injustificada guarda directamente desde details sin paso reminder
    fireEvent.click(screen.getByRole("button", { name: /Guardar registro/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "falta_injustificada",
      service: "Urgencias",
      notes: "Pase médico extemporáneo",
      details: expect.objectContaining({
        allDay: true,
        affectedShift: "afternoon",
        affectedFortnight: "2ª quincena",
      }),
      reminder: { dayBefore: false, hoursBefore: false, atStart: false },
    }))
  })

  it("3. reclamación pendiente registra datos de solicitud y seguimiento", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Reclamación pendiente/i }))

    fireEvent.change(screen.getByLabelText(/¿Qué estás reclamando\?/i), { target: { value: "Pago de tiempo extra" } })
    fireEvent.change(screen.getByLabelText(/Fecha de la solicitud/i), { target: { value: "2026-09-10" } })
    fireEvent.change(screen.getByLabelText(/Folio/i), { target: { value: "REC-2026-004" } })
    fireEvent.change(screen.getByLabelText(/Persona, área o departamento con quien se da seguimiento/i), { target: { value: "Nóminas delegación" } })
    fireEvent.change(screen.getByLabelText(/Fecha para volver a recordarlo/i), { target: { value: "2026-09-18" } })
    fireEvent.change(screen.getByLabelText(/Hora del recordatorio/i), { target: { value: "11:00" } })
    fireEvent.change(screen.getByLabelText(/Estado de la reclamación/i), { target: { value: "en_seguimiento" } })
    fireEvent.change(screen.getByLabelText(/Notas/i), { target: { value: "Llevar copia de tarjeta de asistencia" } })

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar seguimiento/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "no_pagado",
      title: "Pago de tiempo extra",
      notes: "Llevar copia de tarjeta de asistencia",
      details: expect.objectContaining({
        claimFiledDate: "2026-09-10",
        claimReference: "REC-2026-004",
        responsibleArea: "Nóminas delegación",
        claimStatus: "en_seguimiento",
      }),
      reminder: { dayBefore: true, hoursBefore: false, atStart: true },
    }))
  })

  it("4. TxT guarda sustitución, turno, horas y estatus de pago", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /TxT/i }))

    fireEvent.change(screen.getByLabelText(/Fecha de la sustitución/i), { target: { value: "2026-09-22" } })
    fireEvent.change(screen.getByLabelText(/Persona a quien vas a sustituir/i), { target: { value: "Enf. Juan Morales" } })
    fireEvent.change(screen.getByLabelText(/Turno/i), { target: { value: "night" } })
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: "21:00" } })
    fireEvent.change(screen.getByLabelText(/Hora de término/i), { target: { value: "07:00" } })
    fireEvent.change(screen.getByLabelText(/¿Ya se pagó\?/i), { target: { value: "pendiente" } })
    fireEvent.change(screen.getByLabelText(/Área de servicio/i), { target: { value: "Terapia Intensiva" } })
    fireEvent.change(screen.getByLabelText(/Lugar de adscripción/i), { target: { value: "HGZ 83" } })

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y programar/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "txt_substitution",
      substituteWorkerName: "Enf. Juan Morales",
      service: "Terapia Intensiva",
      workplace: "HGZ 83",
      details: expect.objectContaining({
        shift: "night",
        paidStatus: "pendiente",
      }),
    }))
  })

  it("5. recordatorio general permite configurar fecha/hora, prioridad, repetición y notificación", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Recordatorio general/i }))

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: "Cita en escalafón para entrega de tarjetones" } })
    fireEvent.change(screen.getByLabelText(/Fecha del evento/i), { target: { value: "2026-09-25" } })
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: "10:30" } })
    fireEvent.change(screen.getByLabelText(/Fecha recordatorio/i), { target: { value: "2026-09-25" } })
    fireEvent.change(screen.getByLabelText(/Hora recordatorio/i), { target: { value: "09:00" } })
    fireEvent.change(screen.getByLabelText(/Ubicación/i), { target: { value: "Sindicato Sección XX" } })
    fireEvent.change(screen.getByLabelText(/Prioridad/i), { target: { value: "urgente" } })
    fireEvent.change(screen.getByLabelText(/Repetición/i), { target: { value: "monthly" } })

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y programar/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "general_reminder",
      title: "Cita en escalafón para entrega de tarjetones",
      workplace: "Sindicato Sección XX",
      details: expect.objectContaining({
        priority: "urgente",
        recurrence: "monthly",
        notificationsEnabled: true,
        reminderAt: "2026-09-25T09:00:00",
      }),
      reminder: { dayBefore: true, hoursBefore: false, atStart: false },
    }))
  })

  it("desactiva recordatorios si el usuario desmarca la opción de notificación", () => {
    const { onSave } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Recordatorio general/i }))

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: "Revisar correo institucional" } })
    fireEvent.change(screen.getByLabelText(/Fecha del evento/i), { target: { value: "2026-09-26" } })
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: "12:00" } })

    // Desactivar notificación
    const notifCheckbox = screen.getByLabelText(/Activar notificación en la fecha\/hora configurada/i)
    fireEvent.click(notifCheckbox)

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    fireEvent.click(screen.getByRole("button", { name: /Guardar y programar/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "general_reminder",
      details: expect.objectContaining({
        notificationsEnabled: false,
      }),
      reminder: { dayBefore: false, hoursBefore: false, atStart: false },
    }))
  })

  it("mantiene el foco al escribir de corrido en un campo de texto (teclado móvil no debe cerrarse)", () => {
    // Regresión: cada letra re-renderiza el formulario; el modal compartido
    // no debe reinicializar su autofocus ni robar el foco del campo activo.
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: /Recordatorio general/i }))

    const titleInput = screen.getByLabelText(/Título/i) as HTMLInputElement
    titleInput.focus()
    expect(document.activeElement).toBe(titleInput)

    // Escribe letra por letra, como un usuario real (rAF está stubbed síncrono
    // en este archivo, así que un robo de foco ocurriría de inmediato).
    const texto = "Este es un texto completo de prueba"
    let acumulado = ""
    for (const letra of texto) {
      acumulado += letra
      fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: acumulado } })
    }

    const finalInput = screen.getByLabelText(/Título/i) as HTMLInputElement
    expect(finalInput.value).toBe(texto)
    expect(document.activeElement).toBe(finalInput)
  })
})
