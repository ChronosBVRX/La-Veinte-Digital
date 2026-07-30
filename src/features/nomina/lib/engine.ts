import type {
  PayrollRule, PayrollRuleContext, PayrollProjection,
  CalculatedPayrollConcept, EmployeePayrollProfile,
  ResolvedSalaryCategory, PayPeriod, SeniorityResult,
  PayrollIncident, RecurringConceptOverride,
} from "./types"
import {
  rule002, rule011, rule020, rule022, rule054, rule055, rule050,
} from "./rules"

export function getAllRules(): PayrollRule[] {
  return [rule002, rule011, rule020, rule022, rule054, rule055, rule050]
}

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

  for (const rule of rules) {
    const visited = new Set<string>()
    const stack = [rule.id]

    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) {
        errors.push(`Dependencia circular: ${[...visited, current].join(" -> ")}`)
        break
      }
      visited.add(current)
      const r = ruleMap.get(current)
      if (r) {
        for (const dep of r.dependencies) {
          if (ruleMap.has(dep)) {
            stack.push(dep)
          }
        }
      }
    }
  }

  return errors
}

export function getUnresolvedConcepts(
  rules: PayrollRule[],
  profile: EmployeePayrollProfile
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

export function calculateProjection(
  profile: EmployeePayrollProfile,
  category: ResolvedSalaryCategory,
  period: PayPeriod,
  seniority: SeniorityResult,
  incidents: PayrollIncident[],
  recurringConcepts: RecurringConceptOverride[]
): PayrollProjection {
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

  const earnings: CalculatedPayrollConcept[] = []
  const deductions: CalculatedPayrollConcept[] = []

  for (const concept of calculatedConcepts.values()) {
    if (concept.type === "earning" && concept.included) {
      earnings.push(concept)
    } else if (concept.type === "deduction" && concept.included) {
      deductions.push(concept)
    }

    if (!concept.included && concept.source !== "salary_table") {
      unresolvedConcepts.push(concept.code)
    }
  }

  const totalEarnings = earnings.reduce((s, c) => s + c.amount, 0)
  const totalDeductions = deductions.reduce((s, c) => s + c.amount, 0)
  const estimatedNet = totalEarnings - totalDeductions

  const confirmedCount = earnings.filter((c) => c.confidence === "high").length
  const totalCount = earnings.length + deductions.length
  const confidenceLevel: "high" | "medium" | "low" =
    totalCount === 0 ? "low" :
    confirmedCount / totalCount >= 0.7 ? "high" :
    confirmedCount / totalCount >= 0.4 ? "medium" :
    "low"

  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: profile.userId,
    generatedAt: new Date().toISOString(),
    period,
    category,
    seniorityAtPeriodEnd: seniority,
    earnings,
    deductions,
    totalEarnings,
    totalDeductions,
    estimatedNet,
    confidence: confidenceLevel,
    warnings,
    unresolvedConcepts,
    requiredConfirmations,
    mode: "assisted",
    snapshot: {
      categorySnapshot: category,
      ruleVersions: Object.fromEntries(rules.map((r) => [r.id, r.version])),
      profileSnapshot: { ...profile },
    },
  }
}

export function validateNoNaN(concept: CalculatedPayrollConcept): boolean {
  if (!Number.isFinite(concept.amount)) return false
  for (const step of concept.calculationSteps) {
    if (!Number.isFinite(step.value)) return false
  }
  return true
}
