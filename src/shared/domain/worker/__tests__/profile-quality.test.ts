import { describe, expect, it } from "vitest"
import {
  calculateProfileQuality,
  getMissingWorkerFields,
  getBenefitedTools,
  PROFILE_QUALITY_WEIGHTS_V1,
  validateQualityWeightsSum,
  FIELD_REQUIREMENTS,
} from "../"
import type { WorkerProfile, WorkerFieldName } from "../"

function profile(sources: Partial<Record<WorkerFieldName, WorkerProfile["sources"][WorkerFieldName]>>): WorkerProfile {
  return {
    userId: "user-1",
    mode: "manual",
    identity: {},
    situation: {},
    sources,
    updatedAt: "2026-01-01T00:00:00Z",
  }
}

describe("PROFILE_QUALITY_WEIGHTS_V1", () => {
  it("los pesos suman 100", () => {
    expect(validateQualityWeightsSum(PROFILE_QUALITY_WEIGHTS_V1)).toBe(true)
    const sum = Object.values(PROFILE_QUALITY_WEIGHTS_V1).reduce((a, b) => a + b, 0)
    expect(sum).toBe(100)
  })

  it("cubre los campos reconocidos del dominio", () => {
    const keys = Object.keys(PROFILE_QUALITY_WEIGHTS_V1)
    expect(keys).toContain("categoria")
    expect(keys).toContain("effectiveSeniorityDate")
    expect(keys).toContain("matricula")
  })
})

describe("calculateProfileQuality", () => {
  it("distingue payslip_confirmed, calculated, manual e inferred", () => {
    const q = calculateProfileQuality(
      profile({
        categoria: "payslip_confirmed",
        effectiveSeniorityDate: "payslip_confirmed",
        workdayHours: "calculated",
        employmentType: "manual",
        shift: "inferred",
      }),
      FIELD_REQUIREMENTS,
    )
    // 25 + 25 + 15*0.9 + 10*0.8 + 10*0.6 = 25+25+13.5+8+6 = 77.5 → 78
    expect(q.percent).toBeGreaterThanOrEqual(77)
    expect(q.percent).toBeLessThanOrEqual(78)
    expect(q.confirmedCount).toBe(2)
    expect(q.manualCount).toBe(1)
    expect(q.inferredCount).toBe(1)
  })

  it("un perfil sin fuentes tiene 0% y faltan campos requeridos", () => {
    const q = calculateProfileQuality(profile({}), FIELD_REQUIREMENTS)
    expect(q.percent).toBe(0)
    expect(q.confidence).toBe(0)
    expect(q.missingFields.length).toBeGreaterThan(0)
    expect(q.recommendations.length).toBe(q.missingFields.length)
  })

  it("un perfil completo con payslip_confirmed llega a 100%", () => {
    const q = calculateProfileQuality(
      profile({
        categoria: "payslip_confirmed",
        effectiveSeniorityDate: "payslip_confirmed",
        workdayHours: "payslip_confirmed",
        employmentType: "payslip_confirmed",
        shift: "payslip_confirmed",
        adscripcion: "payslip_confirmed",
        matricula: "payslip_confirmed",
      }),
      FIELD_REQUIREMENTS,
    )
    expect(q.percent).toBe(100)
    expect(q.confidence).toBe(1)
    expect(q.missingFields).toEqual([])
  })

  it("campos faltantes reducen la completitud", () => {
    const full = calculateProfileQuality(
      profile({
        categoria: "payslip_confirmed",
        effectiveSeniorityDate: "payslip_confirmed",
        workdayHours: "payslip_confirmed",
        employmentType: "payslip_confirmed",
        shift: "payslip_confirmed",
        adscripcion: "payslip_confirmed",
        matricula: "payslip_confirmed",
      }),
      FIELD_REQUIREMENTS,
    )
    const partial = calculateProfileQuality(
      profile({
        categoria: "payslip_confirmed",
        effectiveSeniorityDate: "payslip_confirmed",
        workdayHours: "payslip_confirmed",
        employmentType: "payslip_confirmed",
        shift: "payslip_confirmed",
        adscripcion: "payslip_confirmed",
      }),
      FIELD_REQUIREMENTS,
    )
    expect(partial.percent).toBeLessThan(full.percent)
  })
})

describe("getMissingWorkerFields", () => {
  it("devuelve los campos requeridos sin fuente", () => {
    const missing = getMissingWorkerFields(
      profile({ categoria: "payslip_confirmed" }),
      FIELD_REQUIREMENTS,
    )
    expect(missing).toContain("effectiveSeniorityDate")
    expect(missing).toContain("matricula")
    expect(missing).not.toContain("categoria")
  })
})

describe("getBenefitedTools", () => {
  it("solo beneficia herramientas cuyos campos requeridos están cubiertos", () => {
    const tools = getBenefitedTools(
      profile({
        categoria: "payslip_confirmed",
        effectiveSeniorityDate: "payslip_confirmed",
        workdayHours: "manual",
        employmentType: "manual",
      }),
      FIELD_REQUIREMENTS,
    )
    // aguinaldo y comparador requieren solo categoria → beneficiadas.
    expect(tools).toContain("aguinaldo")
    expect(tools).toContain("comparador")
    // vacaciones requiere effectiveSeniorityDate (cubierto) → beneficiada.
    expect(tools).toContain("vacaciones")
    // nomina requiere categoria + workdayHours + employmentType → cubierto.
    expect(tools).toContain("nomina")
    // prestaciones/timeline requieren antigüedad → cubierto.
    expect(tools).toContain("timeline")
  })

  it("no beneficia herramientas con requisitos faltantes", () => {
    const tools = getBenefitedTools(profile({}), FIELD_REQUIREMENTS)
    expect(tools).not.toContain("aguinaldo")
    expect(tools).not.toContain("vacaciones")
  })
})
