import type { PayrollProjection, CalculatedPayrollConcept } from "./types"
import { CLAUSE_63_BIS_C_DAYS } from "./types"
import { getImpactMatrixEffectiveAt, type ConceptImpactRule } from "../data/repercussion-matrix"

/**
 * Análisis de IMPACTO POR ANTIGÜEDAD (transitivo).
 *
 * Separa cuatro tipos de efecto para que "Más antigüedad" no presente solo el
 * delta quincenal:
 *
 *   A. DIRECT     — conceptos incluidos que cambian en la quincena ordinaria.
 *   B. INDIRECT   — prestaciones cuya base integra un concepto que cambió
 *                   (según repercussion-matrix, transitivamente). Se marcan
 *                   como "recalcular cuando corresponda"; JAMÁS suman al
 *                   bruto quincenal ni muestran importes inventados.
 *   C. MILESTONES — próximos saltos de la tabla 63 Bis c (días), generados
 *                   desde la tabla, nunca interpolados.
 *   D. UNCHANGED  — conceptos incluidos idénticos en ambos escenarios.
 *
 * Toda relación indirecta exige `regulation_verified` en la matriz; las
 * relaciones condicionales/pendientes NO se reportan como impacto.
 */

export interface DirectSeniorityImpact {
  code: string
  name: string
  before: number
  after: number
  delta: number
}

export interface IndirectSeniorityImpact {
  code: string
  name: string
  /** Códigos changed que alimentan directamente esta prestación. */
  causeCodes: string[]
  /** Cadena causal estructurada, p. ej. ["seniority", "022", "029"]. */
  impactPath: string[]
  evidence: { documentId: string; reference: string }
  recalculateWhenApplicable: true
}

export interface SeniorityMilestone {
  year: number
  days: number
  factorDeltaDays: number
  notes: { note: string; reference: string }[]
}

export interface SeniorityImpactMetrics {
  ordinaryGrossBefore: number
  ordinaryGrossAfter: number
  quincenalDelta: number
}

export interface SeniorityImpactReport {
  direct: DirectSeniorityImpact[]
  indirect: IndirectSeniorityImpact[]
  unchanged: string[]
  milestones: SeniorityMilestone[]
  metrics: SeniorityImpactMetrics
  baselineYears: number
  targetYears: number
}

/** Nombres de targets de matriz sin regla implementada (fuente: referencias legales de la propia matriz). */
const KNOWN_TARGET_NAMES: Record<string, string> = {
  "029": "Prima Vacacional",
  "048": "Ayuda Cultural",
  "030": "Prima Dominical",
  "107": "Aguinaldo",
  "108": "Compensación Cl. 107",
  "111": "Compensación Cl. 107",
  "152": "Compensación Cl. 107",
}

/**
 * Hitos documentados que NO son del concepto 022. Registro conservador:
 * solo entradas con evidencia en el repo. Sin regla de pago implementada,
 * se presentan como contexto pendiente de confirmación — nunca con cifras.
 */
export const SENIORITY_MILESTONE_NOTES: Record<number, { note: string; reference: string }[]> = {
  20: [
    {
      note: "Tramo de días de vacaciones para 20 o más años de servicio (aplica cuando correspondan vacaciones, no en la quincena ordinaria)",
      reference: "Tabla de vacaciones CCT/LFT — campo twentyYearsOrMoreDays capturado por el importador de tarjetón; regla de pago pendiente en el motor",
    },
  ],
}

const cents = (v: number) => Math.round(v * 100)

function includedConcepts(p: PayrollProjection): Map<string, CalculatedPayrollConcept> {
  const m = new Map<string, CalculatedPayrollConcept>()
  for (const c of [...p.earnings, ...p.probableConcepts]) m.set(c.code, c)
  return m
}

/**
 * Cierre transitivo sobre filas de matriz (genérico): devuelve cada target
 * alcanzable desde los códigos changed junto con su impactPath.
 * Solo atraviesa relaciones `regulation_verified`.
 */
export function traceIndirectTargets(
  changedCodes: string[],
  rows: ConceptImpactRule[],
): Map<string, { path: string[]; viaLast: string; evidence: { documentId: string; reference: string } }> {
  const bySource = new Map<string, ConceptImpactRule[]>()
  for (const r of rows) {
    if (r.verificationStatus !== "regulation_verified") continue
    if (!bySource.has(r.sourceConceptCode)) bySource.set(r.sourceConceptCode, [])
    bySource.get(r.sourceConceptCode)!.push(r)
  }

  const results = new Map<string, { path: string[]; viaLast: string; evidence: { documentId: string; reference: string } }>()
  const queue: { code: string; path: string[] }[] = changedCodes.map((c) => ({ code: c, path: [c] }))
  const visited = new Set<string>(changedCodes)

  while (queue.length > 0) {
    const { code, path } = queue.shift()!
    for (const rel of bySource.get(code) ?? []) {
      const t = rel.targetConceptCode
      if (visited.has(t)) continue
      visited.add(t)
      results.set(t, {
        path: [...path, t],
        viaLast: code,
        evidence: { documentId: rel.sourceDocument, reference: rel.sourceReference },
      })
      queue.push({ code: t, path: [...path, t] })
    }
  }
  return results
}

export function analyzeSeniorityImpact(
  baseline: PayrollProjection,
  target: PayrollProjection,
  options?: { asOfDate?: string },
): SeniorityImpactReport {
  const asOfDate = options?.asOfDate ?? target.period.endDate
  const baseMap = includedConcepts(baseline)
  const targetMap = includedConcepts(target)

  // ── A) DIRECT + UNCHANGED ──
  const direct: DirectSeniorityImpact[] = []
  const unchanged: string[] = []
  const changedCodes: string[] = []
  for (const [code, before] of baseMap) {
    const after = targetMap.get(code)
    if (!after) continue
    if (cents(after.amount) !== cents(before.amount)) {
      changedCodes.push(code)
      direct.push({
        code,
        name: before.name,
        before: before.amount,
        after: after.amount,
        delta: Math.round((after.amount - before.amount) * 100) / 100,
      })
    } else {
      unchanged.push(code)
    }
  }

  // ── B) INDIRECT (transitivo, solo regulation_verified) ──
  const indirect: IndirectSeniorityImpact[] = []
  if (changedCodes.length > 0) {
    const matrix = getImpactMatrixEffectiveAt(asOfDate)
    const traced = traceIndirectTargets(changedCodes, matrix)
    for (const [code, info] of traced) {
      // Si el target tiene regla propia y ya fue calculado/capturado arriba,
      // no es un impacto "cuando corresponda": es parte del diff directo.
      if (baseMap.has(code) || targetMap.has(code)) continue
      indirect.push({
        code,
        name: KNOWN_TARGET_NAMES[code] ?? `Concepto ${code}`,
        causeCodes: [info.viaLast],
        impactPath: ["seniority", ...info.path],
        evidence: info.evidence,
        recalculateWhenApplicable: true,
      })
    }
    indirect.sort((a, b) => a.code.localeCompare(b.code))
  }

  // ── C) HITOS futuros desde la tabla 63 Bis c ──
  const baselineYears = Math.floor(baseline.seniorityAtPeriodEnd.years)
  const targetYears = Math.floor(target.seniorityAtPeriodEnd.years)
  const milestones: SeniorityMilestone[] = []
  let prevDays = CLAUSE_63_BIS_C_DAYS[targetYears]
  for (let y = targetYears + 1; y <= 40; y++) {
    const days = CLAUSE_63_BIS_C_DAYS[y]
    if (days === undefined) break
    milestones.push({
      year: y,
      days,
      factorDeltaDays: days - (prevDays ?? days),
      notes: SENIORITY_MILESTONE_NOTES[y] ?? [],
    })
    prevDays = days
  }

  return {
    direct,
    indirect,
    unchanged: unchanged.sort(),
    milestones,
    metrics: {
      ordinaryGrossBefore: baseline.totals.possibleGross,
      ordinaryGrossAfter: target.totals.possibleGross,
      quincenalDelta: Math.round((target.totals.possibleGross - baseline.totals.possibleGross) * 100) / 100,
    },
    baselineYears,
    targetYears,
  }
}
