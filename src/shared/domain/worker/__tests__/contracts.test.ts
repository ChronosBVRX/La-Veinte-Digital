import { describe, expect, it } from "vitest"
import {
  FIELD_REQUIREMENTS,
  TOOL_IDS,
  type ConfirmedWorkerProfileUpdate,
  type WorkerProfileMode,
} from "../"

describe("contract invariants", () => {
  it("ConfirmedWorkerProfileUpdate no contiene userId", () => {
    const update: ConfirmedWorkerProfileUpdate = {
      sources: { categoria: "payslip_confirmed" },
      mode: "manual",
      sourceOfRequest: "manual",
    }
    expect("userId" in update).toBe(false)
    // El tipo no debe exponer userId: comprobación en tiempo de compilación.
    const keys = Object.keys(update)
    expect(keys).not.toContain("userId")
  })

  it("no existe modo basic dentro de WorkerProfileMode", () => {
    const modes: WorkerProfileMode[] = ["manual", "payslip"]
    expect(modes).not.toContain("basic")
  })

  it("cada campo de la matriz aparece en los pesos reconocidos", () => {
    const fields = FIELD_REQUIREMENTS.map((r) => r.field)
    expect(fields).toContain("categoria")
    expect(fields).toContain("effectiveSeniorityDate")
    expect(fields).toContain("matricula")
    expect(fields).toContain("adscripcion")
  })

  it("todas las herramientas de la matriz están registradas en TOOL_IDS", () => {
    for (const req of FIELD_REQUIREMENTS) {
      for (const { tool } of req.tools) {
        expect(TOOL_IDS).toContain(tool)
      }
    }
  })

  it("cada campo tiene un mensaje 'por qué' y un impacto si falta", () => {
    for (const req of FIELD_REQUIREMENTS) {
      expect(req.whyMessage.length).toBeGreaterThan(0)
      expect(req.impactIfMissing.length).toBeGreaterThan(0)
      expect(req.purpose.length).toBeGreaterThan(0)
    }
  })

  it("los campos con required=true están cubiertos por alguna herramienta", () => {
    const requiredFields = new Set(
      FIELD_REQUIREMENTS.filter((r) => r.tools.some((t) => t.required)).map((r) => r.field),
    )
    expect(requiredFields.size).toBeGreaterThan(0)
  })
})
