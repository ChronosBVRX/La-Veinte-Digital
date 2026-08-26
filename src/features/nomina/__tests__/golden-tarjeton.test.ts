import { describe, it, expect } from "vitest"
import { calculateProjection } from "../lib/engine"
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
}): PayrollProjection {
  const { period = GOLDEN_PERIOD, category, mode = "assisted", profile = buildGoldenProfile() } = overrides ?? {}
  const result = calculateProjection({
    profile,
    category: category ? { ...GOLDEN_CATEGORY, ...category } as typeof GOLDEN_CATEGORY : GOLDEN_CATEGORY,
    period,
    seniority: GOLDEN_SENIORITY,
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
