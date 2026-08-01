import type {
  PayrollRule, PayrollRuleContext, PayrollProjection,
  CalculatedPayrollConcept, EmployeePayrollProfile,
  ResolvedSalaryCategory, PayPeriod, SeniorityResult,
  PayrollIncident, RecurringConceptOverride,
  ProjectionMode,
} from "./types"
import { evaluateEligibilityForConcept, type EligibilityResult } from "./eligibility"
import { buildPendingQuestions, type ConditionalPayrollQuestion } from "./question-engine"
import { calculateProjectionTotals, validateProjectionTotals } from "./totals"
import { getAllRules } from "./rules"

export function topologicalSort(rules: PayrollRule[]): PayrollRule[] {
  const visited = new Set<string>()
  const sorted: PayrollRule[] = []
  const visiting = new Set<string>()
  const ruleMap = new Map(rules.map((r) => [r.id, r]))

  function dfs(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Dependencia circular detectada: ${id}`)
    }
    visiting.add(id)
    const rule = ruleMap.get(id)
    if (rule) {
      for (const dep of rule.dependencies) {
        if (ruleMap.has(dep)) {
          dfs(dep)
        }
      }
      visited.add(id)
      visiting.delete(id)
      sorted.push(rule)
    }
  }

  for (const rule of rules) {
    if (!visited.has(rule.id)) {
      dfs(rule.id)
    }
  }

  return sorted
}

export function detectCircularDependencies(rules: PayrollRule[]): string[] {
  const ruleMap = new Map(rules.map((r) => [r.id, r]))
  const errors: string[] = []
  const state = new Map<string, "visiting" | "done">()
  const path: string[] = []

  function visit(id: string) {
    const s = state.get(id)
    if (s === "done") return
    if (s === "visiting") {
      const cycleStart = path.indexOf(id)
      errors.push(`Dependencia circular: ${[...path.slice(cycleStart), id].join(" -> ")}`)
      return
    }
    state.set(id, "visiting")
    path.push(id)
    const rule = ruleMap.get(id)
    if (rule) {
      for (const dep of rule.dependencies) {
        if (ruleMap.has(dep)) {
          visit(dep)
        }
      }
    }
    path.pop()
    state.set(id, "done")
  }

  for (const rule of rules) {
    visit(rule.id)
  }

  return errors
}

export function getUnresolvedConcepts(
  rules: PayrollRule[],
  profile: EmployeePayrollProfile,
): string[] {
  return rules
    .filter((r) => {
      if (r.id === "054") {
        const hasCondition = profile.occupationalConditions.some(
          (c) => c.type === "radiation_non_medical" && c.enabled && c.permanentExposure
        )
        return !hasCondition
      }
      return false
    })
    .map((r) => r.id)
}

export interface PayrollProjectionInput {
  profile: EmployeePayrollProfile
  category: ResolvedSalaryCategory
  period: PayPeriod
  seniority: SeniorityResult
  incidents: PayrollIncident[]
  recurringConcepts: RecurringConceptOverride[]
  mode?: ProjectionMode
}

export interface PayrollProjectionResult {
  projection: PayrollProjection
  eligibilityResults: EligibilityResult[]
  questions: ConditionalPayrollQuestion[]
}

export function calculateProjection(input: PayrollProjectionInput): PayrollProjectionResult {
  const { profile, category, period, seniority, incidents, recurringConcepts, mode = "assisted" } = input

  const rules = getAllRules()
  const sorted = topologicalSort(rules)
  const calculatedConcepts = new Map<string, CalculatedPayrollConcept>()
  const warnings: string[] = []
  const unresolvedConcepts: string[] = []
  const requiredConfirmations: string[] = []

  const ctx: PayrollRuleContext = {
    profile,
    category,
    period,
    seniority,
    incidents,
    confirmedRecurringConcepts: recurringConcepts,
    calculatedConcepts,
  }

  for (const rule of sorted) {
    try {
      const result = rule.calculate(ctx)
      if (!validateNoNaN(result.concept)) {
        warnings.push(
          `Regla ${rule.id}: el concepto ${result.concept.code} contiene valores no numéricos; se omite.`
        )
        continue
      }
      calculatedConcepts.set(result.concept.code, result.concept)

      if (result.concept.warnings.length > 0) {
        warnings.push(...result.concept.warnings.map((w) => `${result.concept.code}: ${w}`))
      }
      if (result.concept.confidence === "requires_confirmation") {
        requiredConfirmations.push(result.concept.code)
      }
    } catch (e) {
      warnings.push(`Error calculando regla ${rule.id}: ${e instanceof Error ? e.message : "error desconocido"}`)
    }
  }

  const allConcepts = Array.from(calculatedConcepts.values())

  const earnings: CalculatedPayrollConcept[] = []
  const deductions: CalculatedPayrollConcept[] = []
  const probableConcepts: CalculatedPayrollConcept[] = []
  const conditionalConcepts: CalculatedPayrollConcept[] = []
  const excludedConcepts: CalculatedPayrollConcept[] = []

  for (const concept of allConcepts) {
    if (concept.type === "deduction") {
      if (concept.included) deductions.push(concept)
      else excludedConcepts.push(concept)
    } else if (concept.type === "earning") {
      if (concept.included && concept.confidence === "high") {
        earnings.push(concept)
      } else if (concept.included && concept.confidence === "medium") {
        probableConcepts.push(concept)
      } else if (!concept.included && concept.amount > 0) {
        conditionalConcepts.push(concept)
      } else if (!concept.included) {
        excludedConcepts.push(concept)
      }
    }

    if (!concept.included && concept.source !== "salary_table") {
      unresolvedConcepts.push(concept.code)
    }
  }

  const totals = calculateProjectionTotals(allConcepts)
  if (!validateProjectionTotals(totals)) {
    warnings.push("La proyección contiene totales no numéricos; los montos mostrados pueden ser incorrectos.")
  }

  const totalEarnings = earnings.reduce((s, c) => s + c.amount, 0)
  const totalDeductions = deductions.reduce((s, c) => s + c.amount, 0)
  const estimatedNet = totalEarnings - totalDeductions

  const confirmedCount = earnings.filter((c) => c.confidence === "high").length
  const totalCount = allConcepts.length
  let confidenceLevel: "high" | "medium" | "low" =
    totalCount === 0 ? "low" :
    confirmedCount / totalCount >= 0.7 ? "high" :
    confirmedCount / totalCount >= 0.4 ? "medium" :
    "low"

  if (unresolvedConcepts.length > 0 && confidenceLevel === "high") {
    confidenceLevel = "medium"
  }

  const projection: PayrollProjection = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: profile.userId,
    generatedAt: new Date().toISOString(),
    period,
    category,
    seniorityAtPeriodEnd: seniority,
    earnings,
    deductions,
    probableConcepts,
    conditionalConcepts,
    excludedConcepts,
    totals,
    totalEarnings,
    totalDeductions,
    estimatedNet,
    confidence: confidenceLevel,
    warnings,
    unresolvedConcepts,
    requiredConfirmations,
    mode,
    snapshot: {
      categorySnapshot: category,
      ruleVersions: Object.fromEntries(rules.map((r) => [r.id, r.version])),
      profileSnapshot: { ...profile },
    },
  }

  const eligibilityResults = allConcepts.map((c) =>
    evaluateEligibilityForConcept(c.code, profile, category, profile.recurringConcepts)
  )

  const questions = buildPendingQuestions(profile, eligibilityResults, profile.facts)

  return { projection, eligibilityResults, questions }
}

export function validateNoNaN(concept: CalculatedPayrollConcept): boolean {
  if (!Number.isFinite(concept.amount)) return false
  for (const step of concept.calculationSteps) {
    if (!Number.isFinite(step.value)) return false
  }
  return true
}
