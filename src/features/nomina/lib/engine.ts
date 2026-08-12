/**
 * Motor de cálculo de nómina.
 *
 * ## Principios del motor de proyección
 *
 * **1. `referenceSnapshot` es inmutable durante toda la proyección.**
 * Se construye una sola vez al iniciar `calculateProjection()` a partir del perfil
 * y los anclas del último tarjetón. Ninguna regla debe modificarlo.
 *
 * **2. El snapshot solo contiene causas externas, nunca valores calculados.**
 * `referenceSnapshot` almacena antigüedad, categoría, versiones de tablas — no
 * importes de conceptos. Los importes van en `conceptAnchors`.
 *
 * **3. Si falta una causa histórica necesaria para comparar, `dependenciesStatus`
 * retorna `"unknown"`, no `"unchanged"`.**
 * La política para `unknown` depende de `ProjectionMode`: `strict` y `assisted`
 * conservan el ancla con advertencia; `exploratory` usa la fórmula marcada como
 * estimación.
 *
 * ## Criterio rector
 *
 * ```
 * Tarjetón → anclas + snapshot
 *              ↓
 *     ¿cambió alguna dependencia?
 *      ├── no  → conserva ancla
 *      ├── sí  → aplica regla vigente
 *      └── ?   → política según modo
 *
 * En paralelo:
 *   importe real vs fórmula → discrepancia → warning (nunca modifica importe)
 * ```
 */
import type {
  PayrollRule, PayrollRuleContext, PayrollProjection,
  CalculatedPayrollConcept, EmployeePayrollProfile,
  ResolvedSalaryCategory, PayPeriod, SeniorityResult,
  PayrollIncident, RecurringConceptOverride,
  ProjectionMode, ConceptAnchor, PayrollReferenceSnapshot,
} from "./types"
import { evaluateEligibilityForConcept, type EligibilityResult } from "./eligibility"
import { buildPendingQuestions, type ConditionalPayrollQuestion } from "./question-engine"
import { calculateProjectionTotals, validateProjectionTotals } from "./totals"
import { getAllRules } from "./rules"
import { reconstructEffectiveDate, calculateSeniority } from "./seniority"
import { getFixedAmount } from "../data/fixed-concept-amounts"
import { CLAUSE_63_BIS_C_DAYS } from "./types"

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

  // Construir mapa de anclas desde el último tarjetón real.
  // Solo conceptos recurring, periodic y variable se usan como evidencia de elegibilidad.
  // Los one_time se guardan en el historial pero NO se proyectan automáticamente.
  const conceptAnchors = new Map<string, ConceptAnchor>()
  for (const rc of profile.recurringConcepts) {
    if (!rc.confirmed || rc.lastAmount === undefined || !rc.lastSeenAt) continue
    if (rc.occurrenceType === "one_time") continue
    conceptAnchors.set(rc.conceptCode, {
      amount: rc.lastAmount,
      date: rc.lastSeenAt,
      occurrenceType: rc.occurrenceType,
      eligibilityPersistence: rc.eligibilityPersistence,
    })
  }

  // Construir instantánea de referencia para comparar causas externas.
  let referenceSnapshot: PayrollReferenceSnapshot | undefined
  if (conceptAnchors.size > 0) {
    // Determinar fecha de referencia: la más reciente entre todas las anclas
    const anchorDates = Array.from(conceptAnchors.values()).map((a) => a.date).filter(Boolean)
    const refDate = anchorDates.length > 0
      ? anchorDates.sort().reverse()[0]
      : period.endDate

    // Antigüedad en el momento del tarjetón
    let refSeniority: { years: number; months: number; days: number }
    if (profile.displayedSeniorityAtLastPayslip) {
      const se = profile.displayedSeniorityAtLastPayslip
      refSeniority = { years: se.years, months: se.months, days: se.days }
    } else if (profile.effectiveSeniorityDate) {
      const sr = calculateSeniority(profile.effectiveSeniorityDate, refDate)
      refSeniority = { years: sr.years, months: sr.months, days: sr.days }
    } else {
      refSeniority = { years: seniority.years, months: seniority.months, days: seniority.days }
    }

    // Versiones de tablas fijas
    const fixedTableVersions: Record<string, string> = {}
    const entry020 = getFixedAmount("020", refDate)
    if (entry020) {
      fixedTableVersions["020"] = entry020.version ?? "default"
    }

    referenceSnapshot = {
      date: refDate,
      categoryId: category.categoryId,
      seniority: refSeniority,
      salaryTableVersion: category.salaryTableVersion,
      fixedTableVersions,
    }
  }

  const ctx: PayrollRuleContext = {
    profile,
    category,
    period,
    seniority,
    incidents,
    confirmedRecurringConcepts: recurringConcepts,
    calculatedConcepts,
    conceptAnchors,
    mode,
    referenceSnapshot,
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
      const message = e instanceof Error ? e.message : "error desconocido"
      warnings.push(`Error calculando regla ${rule.id}: ${message}`)
      // Una excepción de regla deja el concepto sin resolver: baja la
      // confianza de la proyección y exige revisión/confirmación manual.
      unresolvedConcepts.push(rule.id)
      requiredConfirmations.push(rule.id)
    }
  }

  const allConcepts = Array.from(calculatedConcepts.values())

  // Detección de anomalías: discrepancia entre importe ancla y cálculo actual.
  for (const concept of allConcepts) {
    const anchor = conceptAnchors.get(concept.code)
    if (!anchor || !concept.included || concept.amount === 0) continue
    const delta = Math.abs(concept.amount - anchor.amount)
    // Umbral: 0.5% de diferencia o al menos $0.50 para ignorar redondeo.
    const threshold = Math.max(anchor.amount * 0.005, 0.50)
    if (delta > threshold) {
      const dir = concept.amount > anchor.amount ? "superior" : "inferior"
      warnings.push(
        `${concept.code}: El importe calculado (${concept.amount.toFixed(2)}) es ${dir} al comprobado en tarjetón (${anchor.amount.toFixed(2)}). Diferencia: ${delta.toFixed(2)}`
      )
    }
  }

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

export type DependencyStatus = "unchanged" | "changed" | "unknown"

function getSeniorityBracket(years: number): number {
  if (years < 5) return 0
  // La tabla CLAUSE_63_BIS_C_DAYS tiene entradas de 5 a 40
  return Math.min(years, 40)
}

/**
 * Determina el estado de las dependencias de un concepto respecto al tarjetón de referencia.
 *
 * Compara el valor actual de cada dependencia contra su valor ancla (del último tarjetón)
 * usando comparación exacta a centavos.
 *
 * Dependencias especiales:
 * - `"seniority"`: compara años de antigüedad actual vs ancla del concepto 022.
 * - `"fixedTable:XXX"`: compara importe fijo actual vs ancla del código XXX.
 *
 * - `"unchanged"`: todas las dependencias coinciden a nivel de centavos.
 * - `"changed"`: al menos una dependencia cambió.
 * - `"unknown"`: no se pudo verificar alguna dependencia (falta ancla o valor actual).
 */
export function dependenciesStatus(
  deps: string[],
  ctx: PayrollRuleContext,
): DependencyStatus {
  let unknown = false

  for (const dep of deps) {
    // Dependencia especial: antigüedad
    if (dep === "seniority") {
      const ref = ctx.referenceSnapshot
      if (!ref) { unknown = true; continue }
      const refYears = ref.seniority.years
      const currYears = ctx.seniority.years
      if (refYears !== currYears) return "changed"
      // También detectar si se cruzó un umbral de la tabla 63 Bis c
      const refBracket = getSeniorityBracket(refYears)
      const currBracket = getSeniorityBracket(currYears)
      if (refBracket !== currBracket) return "changed"
      continue
    }

    // Dependencia especial: tabla fija (ej. fixedTable:020)
    if (dep.startsWith("fixedTable:")) {
      const tableCode = dep.slice("fixedTable:".length)
      const ref = ctx.referenceSnapshot
      if (!ref) { unknown = true; continue }
      const refVersion = ref.fixedTableVersions[tableCode]
      if (!refVersion) { unknown = true; continue }
      const currentEntry = getFixedAmount(tableCode, ctx.period.endDate)
      if (!currentEntry) { unknown = true; continue }
      if (currentEntry.version !== refVersion) return "changed"
      continue
    }

    // Dependencia de concepto: comparar valor actual contra ancla a centavos
    const current = ctx.calculatedConcepts.get(dep)
    const anchor = ctx.conceptAnchors.get(dep)

    if (!current || !anchor) {
      unknown = true
      continue
    }

    const currentCents = Math.round(current.amount * 100)
    const anchorCents = Math.round(anchor.amount * 100)

    if (currentCents !== anchorCents) {
      return "changed"
    }
  }

  return unknown ? "unknown" : "unchanged"
}

/**
 * Resuelve el importe de un concepto con ancla, aplicando política según el modo.
 *
 * - `baseline`: siempre usa el anchor (el tarjetón es la verdad).
 * - `strict`: si `unknown`, conserva anchor con advertencia fuerte.
 * - `assisted`: si `unknown`, conserva anchor con advertencia de dato faltante.
 * - `exploratory`: si `unknown`, usa fórmula marcada como estimación.
 */
export function resolveWithAnchor(
  anchor: { amount: number } | undefined,
  formulaAmount: number,
  status: DependencyStatus,
  mode: ProjectionMode,
): { amount: number; warnings: string[] } {
  const warnings: string[] = []

  if (mode === "baseline" && anchor) {
    return { amount: anchor.amount, warnings }
  }

  if (status === "unchanged" && anchor) {
    return { amount: anchor.amount, warnings }
  }

  if (status === "changed") {
    return { amount: formulaAmount, warnings }
  }

  // status === "unknown"
  if (mode === "exploratory") {
    warnings.push("Importe estimado por fórmula — no se pudo verificar el estado anterior de las dependencias.")
    return { amount: formulaAmount, warnings }
  }

  // strict o assisted: conservar anchor, advertir
  if (anchor) {
    const severity = mode === "strict" ? "No se recomienda modificar sin evidencia." : "Verifica los datos del perfil para mejorar la precisión."
    warnings.push(`No se pudo verificar si las dependencias cambiaron. Se conserva el último importe comprobado. ${severity}`)
    return { amount: anchor.amount, warnings }
  }

  // Sin anchor y unknown: usar fórmula
  return { amount: formulaAmount, warnings }
}

/**
 * Versión booleana: `true` solo si `changed`. `unknown` se trata como `false`.
 */
export function dependenciesChanged(
  deps: string[],
  ctx: PayrollRuleContext,
): boolean {
  return dependenciesStatus(deps, ctx) === "changed"
}
