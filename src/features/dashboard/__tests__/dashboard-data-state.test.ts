import { describe, it, expect } from "vitest"
import {
  describeSupabaseError,
  resolveDashboardProfile,
  resolvePayslipPresence,
} from "../lib/dashboard-data-state"

describe("resolveDashboardProfile", () => {
  it("caso 1: consulta correcta con perfil devuelve nombre y datos confirmados", () => {
    const state = resolveDashboardProfile({
      data: {
        full_name: "Ana López Ramírez",
        matricula: "81123456",
        categoria: "ENFERMERA GENERAL",
        antiguedad: "12 años",
      },
      error: null,
    })

    expect(state.presence).toBe("present")
    expect(state.fullName).toBe("Ana López Ramírez")
    expect(state.matricula).toBe("81123456")
    expect(state.hasCategoria).toBe(true)
    expect(state.hasAntiguedad).toBe(true)
  })

  it("caso 2: consulta correcta sin perfil permite fallback (ausencia real)", () => {
    const state = resolveDashboardProfile({ data: null, error: null })

    expect(state.presence).toBe("absent")
    expect(state.fullName).toBeNull()
    expect(state.matricula).toBeNull()
    expect(state.hasCategoria).toBe(false)
    expect(state.hasAntiguedad).toBe(false)
  })

  it("caso 3: error de consulta NO se interpreta como perfil inexistente", () => {
    const state = resolveDashboardProfile({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    })

    expect(state.presence).toBe("unknown")
    expect(state.presence).not.toBe("absent")
    expect(state.fullName).toBeNull()
    expect(state.hasCategoria).toBeNull()
    expect(state.hasAntiguedad).toBeNull()
  })

  it("perfil con campos vacíos se reporta como presente con datos ausentes", () => {
    const state = resolveDashboardProfile({
      data: { full_name: null, matricula: "   ", categoria: "", antiguedad: null },
      error: null,
    })

    expect(state.presence).toBe("present")
    expect(state.fullName).toBeNull()
    expect(state.matricula).toBeNull()
    expect(state.hasCategoria).toBe(false)
    expect(state.hasAntiguedad).toBe(false)
  })
})

describe("resolvePayslipPresence", () => {
  it("caso 4: count = 1 sin error → present", () => {
    expect(resolvePayslipPresence({ count: 1, error: null })).toBe("present")
  })

  it("caso 5: count = 0 sin error → absent (única evidencia válida de ausencia)", () => {
    expect(resolvePayslipPresence({ count: 0, error: null })).toBe("absent")
  })

  it("caso 6: count = null con error → unknown (nunca absent)", () => {
    const presence = resolvePayslipPresence({
      count: null,
      error: { code: "", message: "TypeError: fetch failed" },
    })

    expect(presence).toBe("unknown")
    expect(presence).not.toBe("absent")
  })

  it("count = null sin error → unknown (nunca absent)", () => {
    expect(resolvePayslipPresence({ count: null, error: null })).toBe("unknown")
  })

  it("count mayor a cero con cualquier error previo no niega la presencia", () => {
    expect(resolvePayslipPresence({ count: 3, error: null })).toBe("present")
  })

  it("un error siempre gana sobre un count reportado", () => {
    expect(resolvePayslipPresence({ count: 0, error: { code: "PGRST116" } })).toBe("unknown")
  })
})

describe("describeSupabaseError", () => {
  it("expone solo código y mensaje técnico", () => {
    expect(
      describeSupabaseError({ code: "42501", message: "permission denied", details: "no loggear" }),
    ).toEqual({ code: "42501", message: "permission denied" })
  })

  it("tolera valores no-objeto y campos vacíos", () => {
    expect(describeSupabaseError(null)).toEqual({ code: null, message: null })
    expect(describeSupabaseError("boom")).toEqual({ code: null, message: null })
    expect(describeSupabaseError({ code: "", message: "" })).toEqual({ code: null, message: null })
  })
})
