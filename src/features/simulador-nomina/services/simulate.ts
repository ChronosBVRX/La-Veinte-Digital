import type { EmployeePayrollProfile, ResolvedSalaryCategory, SeniorityResult, PayrollProjection } from "@/features/nomina/lib/types"
import { calculateProjection } from "@/features/nomina/lib/engine"

export type ScenarioType = "category_change" | "seniority_bump"

export interface SimulationScenario {
  type: ScenarioType
  label: string
  description: string
  targetCategoryName?: string
  targetSeniorityYears?: number
}

export interface ConceptDelta {
  code: string
  name: string
  baselineAmount: number
  scenarioAmount: number
  delta: number
  nature: string
  appeared: boolean
  disappeared: boolean
}

export interface SimulationResult {
  baselineProjection: PayrollProjection
  scenarioProjection: PayrollProjection
  baselineNet: number
  scenarioNet: number
  netDelta: number
  netDeltaPercent: number
  conceptDeltas: ConceptDelta[]
  increasedConcepts: ConceptDelta[]
  decreasedConcepts: ConceptDelta[]
  newConcepts: ConceptDelta[]
  removedConcepts: ConceptDelta[]
}

function buildConceptMap(projection: PayrollProjection): Map<string, number> {
  const map = new Map<string, number>()
  for (const c of projection.earnings) map.set(c.code, c.amount)
  for (const c of projection.probableConcepts) map.set(c.code, c.amount)
  return map
}

function buildConceptNameMap(projection: PayrollProjection): Map<string, string> {
  const map = new Map<string, string>()
  const all = [...projection.earnings, ...projection.probableConcepts, ...projection.conditionalConcepts]
  for (const c of all) map.set(c.code, c.name)
  return map
}

export function compareProjections(
  baseline: PayrollProjection,
  scenario: PayrollProjection
): SimulationResult {
  const baselineMap = buildConceptMap(baseline)
  const scenarioMap = buildConceptMap(scenario)
  const nameMap = buildConceptNameMap(baseline)
  for (const [code, name] of buildConceptNameMap(scenario)) {
    if (!nameMap.has(code)) nameMap.set(code, name)
  }

  const allCodes = new Set([...baselineMap.keys(), ...scenarioMap.keys()])

  const conceptDeltas: ConceptDelta[] = []
  const baselineTotal = baseline.totalEarnings
  const scenarioTotal = scenario.totalEarnings
  const baselineNet = baseline.totals.possibleGross
  const scenarioNet = scenario.totals.possibleGross

  for (const code of allCodes) {
    const baselineAmount = baselineMap.get(code) ?? 0
    const scenarioAmount = scenarioMap.get(code) ?? 0
    const appeared = baselineAmount === 0 && scenarioAmount > 0
    const disappeared = baselineAmount > 0 && scenarioAmount === 0

    conceptDeltas.push({
      code,
      name: nameMap.get(code) ?? code,
      baselineAmount,
      scenarioAmount,
      delta: scenarioAmount - baselineAmount,
      nature: "earning",
      appeared,
      disappeared,
    })
  }

  conceptDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const netDelta = scenarioNet - baselineNet
  const netDeltaPercent = baselineNet > 0 ? Math.round((netDelta / baselineNet) * 1000) / 10 : 0

  return {
    baselineProjection: baseline,
    scenarioProjection: scenario,
    baselineNet,
    scenarioNet,
    netDelta,
    netDeltaPercent,
    conceptDeltas,
    increasedConcepts: conceptDeltas.filter((c) => c.delta > 0 && !c.appeared),
    decreasedConcepts: conceptDeltas.filter((c) => c.delta < 0 && !c.disappeared),
    newConcepts: conceptDeltas.filter((c) => c.appeared),
    removedConcepts: conceptDeltas.filter((c) => c.disappeared),
  }
}

interface MinimalCategory {
  categoryId: string
  categoryName: string
  biweeklyBaseSalary: number
  workdayHours: number
  sourceRecordId: string
}

export function simulateScenario(
  baselineProjection: PayrollProjection,
  scenario: SimulationScenario,
  profile: EmployeePayrollProfile,
  salaryCategories: MinimalCategory[]
): { projection: PayrollProjection; explanation: string[] } | { error: string } {
  if (!profile) return { error: "Perfil no disponible para simular." }

  const explanations: string[] = []

  if (scenario.type === "category_change" && scenario.targetCategoryName) {
    const target = salaryCategories.find(
      (c) => c.categoryName === scenario.targetCategoryName
    )
    if (!target) return { error: `Categoría "${scenario.targetCategoryName}" no encontrada.` }

    profile.categoryId = target.categoryId
    profile.categoryName = target.categoryName
    if (target.workdayHours === 6 || target.workdayHours === 6.5 || target.workdayHours === 8 || target.workdayHours === 12) {
      profile.workdayHours = target.workdayHours
    }

    explanations.push(
      `Cambio de categoría: ${baselineProjection.category.categoryName} → ${target.categoryName}`
    )
    explanations.push(
      `Sueldo base quincenal: $${baselineProjection.category.biweeklyBaseSalary.toLocaleString("es-MX")} → $${target.biweeklyBaseSalary.toLocaleString("es-MX")}`
    )

    const period = baselineProjection.period
    const seniority = baselineProjection.seniorityAtPeriodEnd
    const result = calculateProjection({
      profile,
      category: target as ResolvedSalaryCategory,
      period,
      seniority,
      incidents: [],
      recurringConcepts: [],
    })

    return { projection: result.projection, explanation: explanations }
  }

  if (scenario.type === "seniority_bump" && scenario.targetSeniorityYears) {
    const period = baselineProjection.period
    const seniority: SeniorityResult = {
      ...baselineProjection.seniorityAtPeriodEnd,
      years: scenario.targetSeniorityYears,
      months: 0,
      days: 0,
      totalDays: scenario.targetSeniorityYears * 365,
    }

    explanations.push(
      `Antigüedad simulada: ${baselineProjection.seniorityAtPeriodEnd.years} → ${scenario.targetSeniorityYears} años`
    )
    if (scenario.targetSeniorityYears >= 5 && baselineProjection.seniorityAtPeriodEnd.years < 5) {
      explanations.push("Con 5+ años de antigüedad, aplica Ayuda de Renta por Antigüedad (022)")
    }

    const result = calculateProjection({
      profile,
      category: baselineProjection.category,
      period,
      seniority,
      incidents: [],
      recurringConcepts: [],
    })

    return { projection: result.projection, explanation: explanations }
  }

  return { error: "Tipo de escenario no soportado." }
}
