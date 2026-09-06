import { describe, it, expect } from "vitest"
import { validateCommitmentInput } from "../services/commitments-validation"

describe("commitments-validation: Seguridad y reglas de negocio en capa de servicio", () => {
  it("rechaza registros sin tipo o sin user_id", () => {
    const noType = validateCommitmentInput({ user_id: "user-1", start_at: "2026-09-10T10:00:00Z" })
    expect(noType.ok).toBe(false)
    expect(noType.errors).toContain("El tipo de registro es obligatorio.")

    const noUser = validateCommitmentInput({ type: "overtime", start_at: "2026-09-10T10:00:00Z" })
    expect(noUser.ok).toBe(false)
    expect(noUser.errors).toContain("El identificador de usuario (user_id) es obligatorio.")
  })

  it("rechaza altas directas con tipos no autorizados (sport, shift_change, etc.)", () => {
    const sport = validateCommitmentInput({
      type: "sport",
      user_id: "user-1",
      start_at: "2026-09-10T10:00:00Z",
    })
    expect(sport.ok).toBe(false)
    expect(sport.errors[0]).toContain("no está permitido para nuevas altas")

    const shiftChange = validateCommitmentInput({
      type: "shift_change",
      user_id: "user-1",
      start_at: "2026-09-10T10:00:00Z",
    })
    expect(shiftChange.ok).toBe(false)
    expect(shiftChange.errors[0]).toContain("no está permitido para nuevas altas")
  })

  it("valida campos obligatorios para tiempo extra", () => {
    const incomplete = validateCommitmentInput({
      type: "overtime",
      user_id: "user-1",
      start_at: "2026-09-10T10:00:00Z",
      // Faltan end_at, shift y authorizedBy
    })
    expect(incomplete.ok).toBe(false)
    expect(incomplete.errors.some((e) => e.includes("hora de término"))).toBe(true)
    expect(incomplete.errors.some((e) => e.includes("turno"))).toBe(true)
    expect(incomplete.errors.some((e) => e.includes("autorizó"))).toBe(true)

    const complete = validateCommitmentInput({
      type: "overtime",
      user_id: "user-1",
      start_at: "2026-09-10T10:00:00Z",
      end_at: "2026-09-10T18:00:00Z",
      details: {
        shift: "morning",
        authorizedBy: "Dra. Hernández",
      },
    })
    expect(complete.ok).toBe(true)
    expect(complete.errors).toHaveLength(0)
  })

  it("valida campos obligatorios para falta injustificada", () => {
    const missingShift = validateCommitmentInput({
      type: "falta_injustificada",
      user_id: "user-1",
      start_at: "2026-09-10T00:00:00Z",
      details: {},
    })
    expect(missingShift.ok).toBe(false)
    expect(missingShift.errors.some((e) => e.includes("turno afectado"))).toBe(true)

    const validFalta = validateCommitmentInput({
      type: "falta_injustificada",
      user_id: "user-1",
      start_at: "2026-09-10T00:00:00Z",
      details: {
        affectedShift: "afternoon",
      },
    })
    expect(validFalta.ok).toBe(true)
  })

  it("valida campos obligatorios para reclamación pendiente (no_pagado)", () => {
    const invalid = validateCommitmentInput({
      type: "no_pagado",
      user_id: "user-1",
      start_at: "2026-09-10T10:00:00Z",
      // Falta title y claimFiledDate
      details: {},
    })
    expect(invalid.ok).toBe(false)
    expect(invalid.errors.some((e) => e.includes("concepto o qué estás reclamando"))).toBe(true)
    expect(invalid.errors.some((e) => e.includes("fecha de presentación"))).toBe(true)

    const validClaim = validateCommitmentInput({
      type: "no_pagado",
      user_id: "user-1",
      title: "Pago de concepto 037 guardia festiva",
      start_at: "2026-09-15T11:00:00Z",
      details: {
        claimFiledDate: "2026-09-01",
        claimStatus: "en_seguimiento",
      },
    })
    expect(validClaim.ok).toBe(true)
  })

  it("valida campos obligatorios para sustitución TxT", () => {
    const missing = validateCommitmentInput({
      type: "txt_substitution",
      user_id: "user-1",
      start_at: "2026-09-10T14:00:00Z",
      details: {},
    })
    expect(missing.ok).toBe(false)
    expect(missing.errors.some((e) => e.includes("vas a sustituir"))).toBe(true)
    expect(missing.errors.some((e) => e.includes("turno"))).toBe(true)
    expect(missing.errors.some((e) => e.includes("hora de término"))).toBe(true)

    const validTxt = validateCommitmentInput({
      type: "txt_substitution",
      user_id: "user-1",
      start_at: "2026-09-10T14:00:00Z",
      end_at: "2026-09-10T21:30:00Z",
      substitute_worker_name: "Juan Carlos Pérez",
      details: {
        affectedShift: "afternoon",
        paidStatus: "si",
      },
    })
    expect(validTxt.ok).toBe(true)
  })

  it("valida campos obligatorios para recordatorio general", () => {
    const missingTitle = validateCommitmentInput({
      type: "general_reminder",
      user_id: "user-1",
      start_at: "2026-09-10T09:00:00Z",
      title: "",
    })
    expect(missingTitle.ok).toBe(false)
    expect(missingTitle.errors.some((e) => e.includes("título del recordatorio"))).toBe(true)

    const validReminder = validateCommitmentInput({
      type: "general_reminder",
      user_id: "user-1",
      title: "Entrega de documentos de escalafón",
      start_at: "2026-09-10T09:00:00Z",
      details: {
        priority: "importante",
        recurrence: "none",
      },
    })
    expect(validReminder.ok).toBe(true)
  })
})
