import { describe, it, expect } from "vitest"
import { calculateProjection } from "../lib/engine"
import { analyzeSeniorityImpact, traceIndirectTargets, SENIORITY_MILESTONE_NOTES } from "../lib/seniority-impact"
import { CLAUSE_63_BIS_C_DAYS } from "../lib/types"
import type { ConceptImpactRule } from "../../nomina/data/repercussion-matrix"
import {
  GOLDEN_PERIOD,
  GOLDEN_CATEGORY,
  GOLDEN_SENIORITY,
  GOLDEN_EXPECTED_BASELINE,
  buildGoldenProfile,
} from "./fixtures/tarjeton-golden"

/**
 * TESTS DEL SIMULADOR DE IMPACTO POR ANTIGÜEDAD (transitivo).
 *
 * A direct-022 · B indirectos por matriz · C periódicos no inflan quincena
 * D/E 029/048 marcables · F no-dependiente unchanged · G condicional no
 * activable por años · H transitividad genérica · I regresión 4→41.
 */

function run(years?: number) {
  return calculateProjection({
    profile: buildGoldenProfile(),
    category: GOLDEN_CATEGORY,
    period: GOLDEN_PERIOD,
    seniority: years === undefined ? GOLDEN_SENIORITY : { ...GOLDEN_SENIORITY, years, totalDays: Math.round(years * 365) },
    incidents: [],
    recurringConcepts: [],
  }).projection
}

describe("Impacto por antigüedad — 14→15 sobre tarjetón golden", () => {
  const report = analyzeSeniorityImpact(run(14), run(15))

  it("A) detecta 022 como DIRECT con delta +$119.54", () => {
    expect(report.direct.map((d) => d.code)).toEqual(["022"])
    const d022 = report.direct[0]
    expect(d022.before).toBeCloseTo(1972.41, 2)
    expect(d022.after).toBeCloseTo(2091.95, 2)
    expect(d022.delta).toBeCloseTo(119.54, 2)
  })

  it("B) prestaciones cuya base integra 022 aparecen como INDIRECT con impactPath", () => {
    const codes = report.indirect.map((i) => i.code)
    for (const expected of ["029", "048", "030", "107", "108", "111", "152"]) {
      expect(codes, `falta ${expected}`).toContain(expected)
    }
    const i029 = report.indirect.find((i) => i.code === "029")!
    expect(i029.impactPath).toEqual(["seniority", "022", "029"])
    expect(i029.evidence.reference).toContain("Cláusula 47")
    expect(i029.recalculateWhenApplicable).toBe(true)
    // Sin importes inventados:
    expect(JSON.stringify(i029)).not.toMatch(/"(before|after|delta|amount|importe)"\s*:/)
  })

  it("C) los indirectos NO incrementan la métrica quincenal ordinaria", () => {
    expect(report.metrics.ordinaryGrossBefore).toBeCloseTo(GOLDEN_EXPECTED_BASELINE.totalPercepciones, 2)
    expect(report.metrics.ordinaryGrossAfter).toBeCloseTo(14376.41, 2)
    expect(report.metrics.quincenalDelta).toBeCloseTo(119.54, 2)
    // La suma de deltas directos explica TODO el delta quincenal:
    const sumDirect = report.direct.reduce((s, d) => s + d.delta, 0)
    expect(sumDirect).toBeCloseTo(report.metrics.quincenalDelta, 2)
  })

  it("D/E) 029 y 048 marcados para recálculo (dependencia documental Cláusula 47)", () => {
    for (const code of ["029", "048"]) {
      const i = report.indirect.find((x) => x.code === code)
      expect(i, code).toBeDefined()
      expect(i!.recalculateWhenApplicable).toBe(true)
      expect(i!.evidence.documentId).toBe("cct-2025-2027")
    }
  })

  it("038 Vacaciones NO aparece: sin evidencia local no se inventa repercusión", () => {
    expect(report.indirect.some((i) => i.code === "038")).toBe(false)
  })

  it("F) conceptos sin dependencia de seniority/022 permanecen UNCHANGED", () => {
    for (const code of ["002", "011", "020", "032", "033", "050", "054", "072"]) {
      expect(report.unchanged, code).toContain(code)
    }
    expect(report.direct.some((d) => report.unchanged.includes(d.code))).toBe(false)
  })

  it("G) condicionales no se vuelven elegibles por aumentar años", () => {
    const p20 = run(20)
    for (const conditional of ["057", "058", "061", "062", "078", "083", "013"]) {
      const included = [...p20.earnings, ...p20.probableConcepts].some((c) => c.code === conditional)
      expect(included, `${conditional} no debe activarse por antigüedad sola`).toBe(false)
    }
  })

  it("H) hitos futuros generados desde la tabla (16→114d, 20→150d; sin interpolación)", () => {
    const m16 = report.milestones.find((m) => m.year === 16)!
    expect(m16.days).toBe(114)
    expect(m16.factorDeltaDays).toBe(9)
    const m20 = report.milestones.find((m) => m.year === 20)!
    expect(m20.days).toBe(150)
    expect(SENIORITY_MILESTONE_NOTES[20]).toBeDefined()
  })
})

describe("traceIndirectTargets — transitividad genérica (H)", () => {
  const row = (s: string, t: string): ConceptImpactRule => ({
    sourceConceptCode: s,
    targetConceptCode: t,
    effectiveFrom: "2025-01-01",
    verificationStatus: "regulation_verified",
    sourceDocument: "test-doc",
    sourceReference: "ref",
  })
  const pendingRow = (s: string, t: string): ConceptImpactRule => ({ ...row(s, t), verificationStatus: "pending_validation" })

  it("seniority → A → B se descubre aunque B no declare nada directamente", () => {
    const rows = [row("A", "B"), row("B", "C"), row("C", "D")]
    const traced = traceIndirectTargets(["A"], rows)
    expect(traced.get("C")!.path).toEqual(["A", "B", "C"])
    expect(traced.get("D")!.path).toEqual(["A", "B", "C", "D"])
  })

  it("relaciones pending_validation NUNCA generan impacto", () => {
    const traced = traceIndirectTargets(["A"], [pendingRow("A", "X")])
    expect(traced.size).toBe(0)
  })
})

describe("Regresión completa 4→41 — tabla contractual como única verdad (I)", () => {
  const base = 3937.64 + 3234.77 // 002+011 golden
  const t2 = (v: number) => Math.floor((v + Number.EPSILON) * 100) / 100

  it("cada año produce trunc(base×días/360); transiciones coinciden con saltos de días", () => {
    let prevAmount: number | null = null
    for (let y = 5; y <= 40; y++) {
      const days = CLAUSE_63_BIS_C_DAYS[y]
      expect(days, `tabla debe tener ${y}`).toBeDefined()
      const p = run(y)
      const c022 = [...p.earnings, ...p.probableConcepts].find((c) => c.code === "022")
      expect(c022, `${y}`).toBeDefined()
      expect(c022!.amount, `año ${y}: trunc(${base}×${days}/360)`).toBe(t2((base * days!) / 360))
      if (prevAmount !== null && days! > CLAUSE_63_BIS_C_DAYS[y - 1]!) {
        // El delta de la transición proviene EXCLUSIVAMENTE del salto de días:
        const dayJump = days! - CLAUSE_63_BIS_C_DAYS[y - 1]!
        expect(Math.round((c022!.amount - prevAmount) * 100)).toBe(Math.round(((base * dayJump) / 360) * 100))
      }
      prevAmount = c022!.amount
    }
  })

  it("<5 años excluye; >40 años exige confirmación sin máximo silencioso", () => {
    const p4 = run(4)
    const c022_4 = [...p4.earnings, ...p4.probableConcepts, ...p4.excludedConcepts].find((c) => c.code === "022")!
    expect(c022_4.included).toBe(false)

    const p41 = run(41)
    const c022_41 = [...p41.earnings, ...p41.probableConcepts, ...p41.excludedConcepts].find((c) => c.code === "022")!
    expect(c022_41.warnings.some((w) => w.includes("fuera de la tabla"))).toBe(true)
    expect(c022_41.confidence).toBe("requires_confirmation")
  })

  it("hitos clave: 15→16 (+179.31) y 19→20 (+179.31) usan tramos reales", () => {
    const a022 = (years: number) =>
      analyzeSeniorityImpact(run(years), run(years + 1)).direct.find((d) => d.code === "022")!.delta
    expect(a022(15)).toBeCloseTo(179.31, 2)
    expect(a022(19)).toBeCloseTo(179.31, 2)
    expect(a022(14)).toBeCloseTo(119.54, 2)
  })
})
