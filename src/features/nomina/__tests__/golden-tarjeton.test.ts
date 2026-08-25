import { describe, it, expect } from "vitest"
import { calculateProjection } from "../lib/engine"
import { simulateScenario, compareProjections } from "../../simulador-nomina/services/simulate"
import { formatProjectionAudit } from "../lib/audit"
import type { CalculatedPayrollConcept, EmployeePayrollProfile, PayPeriod, PayrollProjection, ProjectionMode } from "../lib/types"
import {
  GOLDEN_PERIOD,
  GOLDEN_CATEGORY,
  GOLDEN_SENIORITY,
  GOLDEN_EXPECTED_BASELINE,
  GOLDEN_PERTURBATION_CATEGORY,
  GOLDEN_PERTURBATION_JULY_ANCHOR,
  buildGoldenProfile,
} from "./fixtures/tarjeton-golden"

/**
 * PRUEBAS MAESTRAS — TARJETÓN REAL 2A-AGO-2026 (verdad de terreno IMSS).
 *
 * El motor DEBE reconstruir $14,256.87 de percepciones a centavo EXACTO
 * (tolerancia $0.01), sin conceptos condicionales inflando los totales.
 * Regresión histórica: la lectura anual del 022 inyectaba ~$47k fantasma en
 * possibleGross y la portada del simulador mostraba $51,869.93 contra un
 * tarjetón real de $14,256.87.
 */

const TOLERANCE = 0.01

function runProjection(overrides?: {
  period?: PayPeriod
  category?: Partial<typeof GOLDEN_CATEGORY>
  mode?: ProjectionMode
  profile?: EmployeePayrollProfile
  seniorityYears?: number
}): PayrollProjection {
  const { period = GOLDEN_PERIOD, category, mode = "assisted", profile = buildGoldenProfile(), seniorityYears } = overrides ?? {}
  const seniority = seniorityYears === undefined ? GOLDEN_SENIORITY : {
    ...GOLDEN_SENIORITY,
    years: seniorityYears,
    totalDays: Math.round(seniorityYears * 365),
  }
  const result = calculateProjection({
    profile,
    category: category ? { ...GOLDEN_CATEGORY, ...category } as typeof GOLDEN_CATEGORY : GOLDEN_CATEGORY,
    period,
    seniority,
    incidents: [],
    recurringConcepts: [],
    mode,
  })
  return result.projection
}

function conceptMap(projection: PayrollProjection): Map<string, CalculatedPayrollConcept> {
  const map = new Map<string, CalculatedPayrollConcept>()
  for (const c of [
    ...projection.earnings,
    ...projection.probableConcepts,
    ...projection.conditionalConcepts,
    ...projection.excludedConcepts,
  ]) {
    map.set(c.code, c)
  }
  return map
}

/** Suma de TODAS las percepciones incluidas (high + probable), como la nómina real. */
function totalPercepcionesIncluidas(projection: PayrollProjection): number {
  return [...projection.earnings, ...projection.probableConcepts].reduce((s, c) => s + c.amount, 0)
}

describe("Golden tarjetón real 2A-AGO-2026 — reconstrucción exacta", () => {
  it("cada concepto coincide con el tarjetón a $0.01 (incluye truncamientos 032/033)", () => {
    const projection = runProjection({ mode: "baseline" })
    const concepts = conceptMap(projection)
    const failures: string[] = []

    for (const [code, expected] of Object.entries(GOLDEN_EXPECTED_BASELINE.concepts)) {
      const c = concepts.get(code)
      if (!c) {
        failures.push(`${code}: el concepto no aparece en la proyección`)
        continue
      }
      if (Math.abs(c.amount - expected) > TOLERANCE) {
        failures.push(`${code}: esperado $${expected.toFixed(2)}, obtenido $${c.amount.toFixed(2)}`)
      }
      if (!c.included && expected > 0) {
        failures.push(`${code}: con importe real ${expected} pero excluido de la proyección`)
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Desviaciones contra el tarjetón real:\n${failures.join("\n")}\n\nAuditoría:\n${formatProjectionAudit(projection)}`
      )
    }
  })

  it("TOTAL PERCEPCIONES = $14,256.87 exacto; SIN inflación condicional", () => {
    const projection = runProjection({ mode: "baseline" })
    expect(totalPercepcionesIncluidas(projection)).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 1)
    expect(projection.totals.confirmedGross).toBeGreaterThan(0)
    // REGRESIÓN CLAVE: el bucket condicional debe estar VACÍO.
    // La portada del simulador jamás debe recibir importes de conceptos
    // condicionales/anuales fantasma.
    expect(projection.conditionalConcepts).toHaveLength(0)
    expect(projection.totals.possibleGross).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 1)
    expect(projection.totals.possibleGross).toBeCloseTo(projection.totals.confirmedGross, 2)
  })

  it("los truncamientos del IMSS se reproducen: 032=$1721.37 y 033=$1147.58 (no .38/.59)", () => {
    const projection = runProjection({ mode: "assisted" })
    const concepts = conceptMap(projection)
    expect(concepts.get("032")!.amount).toBe(1721.37)
    expect(concepts.get("033")!.amount).toBe(1147.58)
    expect(concepts.get("022")!.amount).toBe(1972.41)
  })

  it("modo assisted (quincena actual = quincena del tarjetón) también reconstruye el total", () => {
    const projection = runProjection({ mode: "assisted" })
    expect(totalPercepcionesIncluidas(projection)).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 1)
    expect(projection.totals.possibleGross).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 1)
  })
})

describe("Perturbación: cambio de categoría → descendientes recalculados con truncamiento", () => {
  it("todos los dependientes de la base usan fórmula vigente, nunca el ancla histórico", () => {
    const projection = runProjection({
      category: GOLDEN_PERTURBATION_CATEGORY.category,
    })
    const concepts = conceptMap(projection)
    const failures: string[] = []

    for (const [code, expected] of Object.entries(GOLDEN_PERTURBATION_CATEGORY.mustRecompute)) {
      const c = concepts.get(code)
      if (!c) {
        failures.push(`${code}: el concepto no aparece`)
        continue
      }
      if (Math.abs(c.amount - (expected as number)) > TOLERANCE) {
        failures.push(`${code}: esperado recalculado $${Number(expected).toFixed(2)}, obtenido $${c.amount.toFixed(2)}`)
      }
      if (c.source === "last_payslip") {
        failures.push(`${code}: conservó importe histórico pese al cambio de categoría`)
      }
      if (c.resolutionAudit && c.resolutionAudit.dependencyStatus === "unchanged") {
        failures.push(`${code}: auditoría 'unchanged' tras cambiar categoría`)
      }
    }
    for (const [code, expected] of Object.entries(GOLDEN_PERTURBATION_CATEGORY.mustStayFixed)) {
      const c = concepts.get(code)
      if (!c || Math.abs(c.amount - (expected as number)) > TOLERANCE) {
        failures.push(`${code}: fijo debía permanecer en $${Number(expected).toFixed(2)}`)
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Descendientes mal invalidados:\n${failures.join("\n")}\n\nAuditoría:\n${formatProjectionAudit(projection)}`
      )
    }
  })
})

describe("Regresión ventana 055: ancla de julio vale CERO en agosto", () => {
  it("055 excluido fuera de la 2ª quincena de julio aunque exista ancla histórica", () => {
    const profile = buildGoldenProfile()
    profile.recurringConcepts = [
      ...profile.recurringConcepts,
      {
        conceptCode: GOLDEN_PERTURBATION_JULY_ANCHOR.syntheticAnchor.code,
        appearsNormally: false,
        lastAmount: GOLDEN_PERTURBATION_JULY_ANCHOR.syntheticAnchor.amount,
        source: "last_payslip",
        firstSeenAt: "2026-07-31",
        lastSeenAt: "2026-07-31",
        confirmed: true,
        occurrenceType: "periodic",
        eligibilityPersistence: "period_scoped",
      },
    ]
    // Proyectar AGOSTO con ancla de julio presente:
    const result = calculateProjection({
      profile,
      category: GOLDEN_CATEGORY,
      period: GOLDEN_PERTURBATION_JULY_ANCHOR.augustPeriod,
      seniority: GOLDEN_SENIORITY,
      incidents: [],
      recurringConcepts: [],
    })
    const concepts = conceptMap(result.projection)
    const c055 = concepts.get("055")
    expect(c055).toBeDefined()
    expect(c055!.amount).toBe(0)
    expect(c055!.included).toBe(false)
    if (c055!.resolutionAudit) {
      expect(c055!.resolutionAudit.selectedSource).toBe("zero")
      expect(c055!.resolutionAudit.reason).toBe("no_elegible_ahora")
      expect(c055!.resolutionAudit.anchorInTargetPeriod).toBe(false)
    }
    // Y el total NO se infla con el fondo de ahorro:
    expect(result.projection.totals.possibleGross).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 1)
  })
})


describe("Escenario Más antigüedad — tabla contractual 63 Bis c (días ÷ 360)", () => {
  // Base real: 002+011 = 7,172.41 · factor = días/360
  const CASES = [
    { target: 15, days: 105, expected022: 2091.95, expectedGross: 14376.41 },
    { target: 16, days: 114, expected022: 2271.26, expectedGross: 14555.72 },
    { target: 20, days: 150, expected022: 2988.50, expectedGross: 15272.96 },
  ] as const

  for (const c of CASES) {
    it(`${14}→${c.target}: 022=$${c.expected022.toFixed(2)} y gross=$${c.expectedGross.toFixed(2)}`, () => {
      const projection = runProjection({ seniorityYears: c.target })
      const c022 = conceptMap(projection).get("022")!

      expect(c022.amount).toBeCloseTo(c.expected022, 2)
      expect(totalPercepcionesIncluidas(projection)).toBeCloseTo(c.expectedGross, 2)
      expect(projection.totals.possibleGross).toBeCloseTo(c.expectedGross, 2)
      // El ancla NO congela el valor cuando cambió la dependencia antigüedad:
      expect(c022.source).toBe("contract_rule")
      if (c022.resolutionAudit) {
        expect(c022.resolutionAudit.anchorValue).toBe(1972.41)
        expect(c022.resolutionAudit.dependencyStatus).toBe("changed")
        expect(c022.resolutionAudit.selectedSource).toBe("formula")
        expect(c022.resolutionAudit.selectedValue).toBeCloseTo(c.expected022, 2)
      }
    })
  }

  it("14.8 años usa años COMPLETADOS (factor 99/360) — nunca 270 días", () => {
    const projection = runProjection({ seniorityYears: 14.8 })
    const c022 = conceptMap(projection).get("022")!
    expect(c022.amount).toBe(1972.41)
    expect(projection.totals.possibleGross).toBeCloseTo(14256.87, 2)
  })

  it("14→41 (fuera de tabla): exige confirmación SIN máximo silencioso", () => {
    const projection = runProjection({ seniorityYears: 41 })
    const c022 = conceptMap(projection).get("022")!
    expect(c022.warnings.some((w) => w.includes("fuera de la tabla"))).toBe(true)
    expect(c022.confidence).toBe("requires_confirmation")
    // Ancla presente → se repite marcada; jamás 270 días:
    expect(c022.resolutionAudit?.formulaComputable).toBe(false)
    if (c022.resolutionAudit) expect(c022.resolutionAudit.reason).toContain("sin_formula")
  })

  it("14→14 conserva el ancla (dependencias idénticas)", () => {
    const projection = runProjection({ seniorityYears: 14 })
    const c022 = conceptMap(projection).get("022")!
    expect(c022.amount).toBe(1972.41)
    expect(c022.source).toBe("last_payslip")
    expect(c022.resolutionAudit?.reason).toBe("dependencias_iguales_valor_persiste")
  })

  it("<5 años: excluido y en cero", () => {
    const projection = runProjection({ seniorityYears: 4 })
    const c022 = conceptMap(projection).get("022")!
    expect(c022.included).toBe(false)
    expect(c022.amount).toBe(0)
  })

  it("producto completo simulateScenario: baseline inmutable y delta +$119.54 para 14→15", async () => {
    const profile = buildGoldenProfile()
    const baselineProj = runProjection({})
    const profileBefore = JSON.stringify(profile)

    const sim = simulateScenario(
      baselineProj,
      {
        type: "seniority_bump",
        label: "Más antigüedad",
        description: "15 años totales",
        targetSeniorityYears: 15,
      },
      profile,
      [],
    )
    expect("error" in sim).toBe(false)
    if ("error" in sim) throw new Error(sim.error)

    // Inmutabilidad: ni el perfil ni el baseline mutaron.
    expect(JSON.stringify(profile)).toBe(profileBefore)
    expect(baselineProj.seniorityAtPeriodEnd.years).toBe(14)
    expect(sim.projection.seniorityAtPeriodEnd.years).toBe(15)

    const comparison = compareProjections(baselineProj, sim.projection)
    expect(comparison.scenarioGross).toBeCloseTo(14376.41, 2)
    expect(comparison.grossDelta).toBeCloseTo(119.54, 2)
    const d022 = comparison.conceptDeltas.find((d) => d.code === "022")!
    expect(d022.delta).toBeCloseTo(119.54, 2)
  })
})
