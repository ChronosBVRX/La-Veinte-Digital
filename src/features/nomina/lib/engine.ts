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
 * **3. Separación de tres preguntas que NUNCA se mezclan:**
 *   a) ¿El trabajador sigue teniendo DERECHO al concepto? → elegibilidad
 *      evaluada con evidencia ACTUAL; la existencia de un ancla NO otorga derecho.
 *   b) ¿La fórmula/base sigue siendo la misma? → dependencias expandidas
 *      transitivamente (`buildDependencyClosure`) comparadas a centavos.
 *   c) ¿El IMPORTE histórico sigue siendo reutilizable? → `resolveWithAnchor`:
 *      solo en `baseline` sobre el MISMO periodo, o con dependencias
 *      `"unchanged"` cuando la regla declara
 *      `valuePersistence: "while_dependencies_unchanged"`.
 *
 * **4. La incertidumbre nunca se convierte en certeza financiera.**
 * Si `dependenciesStatus` retorna `"unknown"`, el importe se recalcula con la
 * fórmula y se marca `requires_confirmation`; jamás se conserva silenciosamente
 * el importe histórico por falta de información.
 *
 * ## Criterio rector
 *
 * ```
 * Tarjetón → anclas + snapshot
 *              ↓
 *     ¿derecho vigente con evidencia actual?
 *      ├── no  → importe 0 (el ancla no revive derechos)
 *      └── sí  → ¿cambiaron las dependencias (cadena completa)?
 *                ├── sí      → fórmula vigente
 *                ├── unknown → fórmula + requiere confirmación
 *                └── no      → según valuePersistence de la regla
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
  ValuePersistence, ResolutionAudit, ResolutionSelectedSource,
} from "./types"
import { evaluateEligibilityForConcept, type EligibilityResult } from "./eligibility"
import { buildPendingQuestions, type ConditionalPayrollQuestion } from "./question-engine"
import { calculateProjectionTotals, validateProjectionTotals } from "./totals"
import { getAllRules } from "./rules"
import { calculateSeniority } from "./seniority"
import { getFixedAmount, FIXED_CONCEPT_AMOUNTS } from "../data/fixed-concept-amounts"

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

/**
 * Dependencias especiales que viajan con un concepto: si una regla depende de
 * "020" también debe vigilar la versión de su tabla fija; si depende de
 * "022", la antigüedad que define su derecho.
 */
const SPECIAL_DEPS: Record<string, string[]> = {
  "020": ["fixedTable:020"],
  "050": ["fixedTable:050"],
  "022": ["seniority"],
}

/**
 * Cierre transitivo del grafo de dependencias declarado por las reglas.
 * Para cada id de regla devuelve TODAS sus dependencias (directas e
 * indirectas), incluyendo las dependencias especiales asociadas.
 *
 * Esto evita falsos `"unchanged"` cuando la lista de dependencias directa de
 * una regla está incompleta: el cambio se detecta por toda la cadena causal,
 * no solo por los padres inmediatos.
 */
export function buildDependencyClosure(
  rules: PayrollRule[],
): Map<string, Set<string>> {
  const ruleIds = new Set(rules.map((r) => r.id))
  const ruleMap = new Map(rules.map((r) => [r.id, r]))
  const memo = new Map<string, Set<string>>()

  function close(id: string, stack: Set<string>): Set<string> {
    const cached = memo.get(id)
    if (cached) return cached
    if (stack.has(id)) return new Set()
    stack.add(id)
    const out = new Set<string>()
    const rule = ruleMap.get(id)
    if (rule) {
      for (const dep of rule.dependencies) {
        out.add(dep)
        for (const special of SPECIAL_DEPS[dep] ?? []) out.add(special)
        if (ruleIds.has(dep)) {
          for (const transitive of close(dep, stack)) out.add(transitive)
        }
      }
    }
    stack.delete(id)
    memo.set(id, out)
    return out
  }

  const result = new Map<string, Set<string>>()
  for (const rule of rules) {
    result.set(rule.id, close(rule.id, new Set()))
  }
  return result
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
  const dependencyClosure = buildDependencyClosure(sorted)
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

    // Versiones de TODAS las tablas de importes fijos versionadas.
    const fixedTableVersions: Record<string, string> = {}
    for (const code of Object.keys(FIXED_CONCEPT_AMOUNTS)) {
      const entry = getFixedAmount(code, refDate)
      if (entry) {
        fixedTableVersions[code] = entry.version ?? "default"
      }
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
    dependencyClosure,
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
      } else if (
        concept.included &&
        (concept.confidence === "medium" ||
         concept.confidence === "low" ||
         concept.confidence === "requires_confirmation")
      ) {
        // Incluidos con confianza media/baja/por-confirmar: probables,
        // nunca silenciosos ni huérfanos fuera de los totales.
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
 * Expande la lista de dependencias usando el cierre transitivo del grafo de
 * reglas (si está disponible en el contexto). Así, un cambio en cualquier
 * eslabón de la cadena causal invalida el ancla, no solo cambios en los
 * padres directos declarados.
 */
function expandDependencies(deps: string[], ctx: PayrollRuleContext): string[] {
  const closure = ctx.dependencyClosure
  if (!closure || closure.size === 0) return deps
  const out = new Set<string>()
  for (const dep of deps) {
    out.add(dep)
    const transitive = closure.get(dep)
    if (transitive) {
      for (const t of transitive) out.add(t)
    }
  }
  return Array.from(out)
}

/**
 * Determina el estado de las dependencias de un concepto respecto al tarjetón de referencia.
 *
 * Compara el valor actual de cada dependencia contra su valor ancla (del último tarjetón)
 * usando comparación exacta a centavos. Las dependencias se expanden transitivamente
 * cuando el contexto provee `dependencyClosure`.
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

  for (const dep of expandDependencies(deps, ctx)) {
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

    // Dependencia de concepto: comparar valor actual contra ancla a centavos.
    // Dependencia "en su caso" (p. ej. 013/057/058/061 para el 022): si NO
    // estaba en el tarjetón (sin ancla) y TAMPOCO está incluida ahora, esa
    // causa simplemente no aplica a este trabajador — no genera incertidumbre.
    const current = ctx.calculatedConcepts.get(dep)
    const anchor = ctx.conceptAnchors.get(dep)

    if (!anchor && !current?.included) continue
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

/** true si el ancla pertenece al mismo periodo quincenal que se proyecta. */
export function anchorCoversPeriod(
  anchor: ConceptAnchor,
  period: Pick<PayPeriod, "id" | "startDate" | "endDate">,
): boolean {
  if (anchor.sourcePeriodId) return anchor.sourcePeriodId === period.id
  return anchor.date >= period.startDate && anchor.date <= period.endDate
}

export interface ResolveWithAnchorArgs {
  /** Código del concepto (para auditoría). */
  conceptCode: string
  ruleId?: string
  /** Ancla del último tarjetón real, si existe. */
  anchor?: ConceptAnchor
  /** Importe que produce la fórmula vigente para el escenario ACTUAL. */
  formulaAmount: number
  /** false cuando la regla no tiene fórmula configurada (ej. 050 sin catálogo). */
  formulaComputable?: boolean
  /**
   * Elegibilidad evaluada con evidencia ACTUAL (hechos, condiciones,
   * recurrencia confirmada). NUNCA derivada de la existencia del ancla.
   */
  eligibleNow?: boolean
  status: DependencyStatus
  mode: ProjectionMode
  valuePersistence?: ValuePersistence
  period: Pick<PayPeriod, "id" | "startDate" | "endDate" | "label">
}

export interface AnchorResolution {
  amount: number
  warnings: string[]
  usedAnchor: boolean
  requiresConfirmation: boolean
  audit: ResolutionAudit
}

/**
 * Resuelve ancla-vs-fórmula bajo el contrato nuevo:
 *
 * 1. Sin ancla → fórmula (o cero si no hay fórmula computable).
 * 2. `baseline` SOLO reproduce el ancla si es el MISMO periodo; en otro
 *    periodo cae al flujo normal de proyección.
 * 3. La elegibilidad se evalúa con evidencia actual, independiente del ancla.
 *    Perder o no tener derecho ⇒ importe cero, nunca el histórico.
 * 4. Dependencias `"changed"` ⇒ jamás se conserva el importe histórico.
 * 5. Dependencias `"unknown"` ⇒ NUNCA equivale a certeza financiera: se
 *    recalcula con la fórmula y se marca `requires_confirmation`
 *    (en `exploratory` queda como estimación advertida); si no hay fórmula,
 *    el ancla se repite marcada para confirmación.
 * 6. Dependencias `"unchanged"` ⇒ el importe histórico persiste solo si la
 *    regla declara `valuePersistence: "while_dependencies_unchanged"`
 *    (mismos insumos → mismo importe REAL comprobado). Con `replay_only`
 *    siempre recalcula.
 */
export function resolveWithAnchor(
  args: ResolveWithAnchorArgs,
): AnchorResolution {
  const {
    conceptCode,
    ruleId,
    anchor,
    formulaAmount,
    formulaComputable = true,
    eligibleNow = true,
    status,
    mode,
    valuePersistence = "replay_only",
    period,
  } = args

  const warnings: string[] = []
  const anchorInTargetPeriod = anchor ? anchorCoversPeriod(anchor, period) : false

  function buildAudit(
    selectedValue: number,
    selectedSource: ResolutionSelectedSource,
    reason: string,
    effectiveDependencyStatus: DependencyStatus | "none",
  ): ResolutionAudit {
    return {
      ruleId,
      conceptCode,
      targetPeriodId: period.id,
      targetPeriodLabel: period.label,
      hadAnchor: !!anchor,
      anchorValue: anchor?.amount,
      anchorDate: anchor?.date,
      anchorInTargetPeriod,
      eligibleNow,
      dependencyStatus: anchor ? effectiveDependencyStatus : "none",
      formulaComputable,
      formulaValue: formulaAmount,
      valuePersistence,
      selectedValue,
      selectedSource,
      reason,
    }
  }

  // 1. Sin ancla: fórmula pura.
  if (!anchor) {
    const amount = eligibleNow && formulaComputable ? formulaAmount : 0
    const reason = !eligibleNow
      ? "no_elegible_ahora_sin_ancla"
      : !formulaComputable
        ? "sin_ancla_y_sin_formula"
        : "sin_ancla_formula_vigente"
    return {
      amount,
      warnings,
      usedAnchor: false,
      requiresConfirmation: false,
      audit: buildAudit(amount, amount === 0 ? "zero" : "formula", reason, "none"),
    }
  }

  // 2. Baseline reproduciendo EL MISMO periodo: el tarjetón es la verdad.
  if (mode === "baseline" && anchorInTargetPeriod) {
    return {
      amount: anchor.amount,
      warnings,
      usedAnchor: true,
      requiresConfirmation: false,
      audit: buildAudit(anchor.amount, "anchor", "baseline_replay_mismo_periodo", status),
    }
  }

  // 3. Elegibilidad actual independiente del ancla.
  if (!eligibleNow) {
    warnings.push("El derecho no aplica en el periodo proyectado según la evidencia actual; no se reutiliza el importe histórico.")
    return {
      amount: 0,
      warnings,
      usedAnchor: false,
      requiresConfirmation: false,
      audit: buildAudit(0, "zero", "no_elegible_ahora", status),
    }
  }

  // 4. Cambio probado: jamás conservar el importe histórico.
  if (status === "changed") {
    if (formulaComputable) {
      warnings.push(`Las dependencias cambiaron desde el último tarjetón; se recalcula con la fórmula vigente (ancla: ${anchor.amount.toFixed(2)}).`)
      return {
        amount: formulaAmount,
        warnings,
        usedAnchor: false,
        requiresConfirmation: false,
        audit: buildAudit(formulaAmount, "formula", "dependencias_cambiadas_recalculo", status),
      }
    }
    // Cambio probado pero sin fórmula: repetir el ancla sería presentedarlo
    // como válido para un escenario distinto → requiere confirmación.
    warnings.push("Las dependencias cambiaron y esta regla no tiene fórmula configurada; el importe mostrado es el último comprobado y DEBE confirmarse.")
    return {
      amount: anchor.amount,
      warnings,
      usedAnchor: true,
      requiresConfirmation: true,
      audit: buildAudit(anchor.amount, "anchor", "dependencias_cambiadas_sin_formula_requiere_confirmacion", status),
    }
  }

  // 5. Incertidumbre tampoco equivale a importe válido.
  if (status === "unknown") {
    if (formulaComputable) {
      if (mode === "exploratory") {
        warnings.push("No se pudo verificar el estado anterior de las dependencias; estimación por fórmula.")
        return {
          amount: formulaAmount,
          warnings,
          usedAnchor: false,
          requiresConfirmation: false,
          audit: buildAudit(formulaAmount, "formula", "dependencias_desconocidas_estimacion_exploratoria", status),
        }
      }
      warnings.push("No se pudo verificar el estado anterior de las dependencias; se recalcula por fórmula y requiere confirmación.")
      return {
        amount: formulaAmount,
        warnings,
        usedAnchor: false,
        requiresConfirmation: true,
        audit: buildAudit(formulaAmount, "formula", "dependencias_desconocidas_recalculo_requiere_confirmacion", status),
      }
    }
    warnings.push("Sin fórmula configurada ni dependencias verificables; se repite el último importe comprobado y DEBE confirmarse.")
    return {
      amount: anchor.amount,
      warnings,
      usedAnchor: true,
      requiresConfirmation: true,
      audit: buildAudit(anchor.amount, "anchor", "sin_formula_dependencias_desconocidas_requiere_confirmacion", status),
    }
  }

  // 6. Unchanged: decidir explícitamente si el VALOR puede persistir.
  if (valuePersistence === "while_dependencies_unchanged") {
    return {
      amount: anchor.amount,
      warnings,
      usedAnchor: true,
      requiresConfirmation: false,
      audit: buildAudit(anchor.amount, "anchor", "dependencias_iguales_valor_persiste", status),
    }
  }

  if (formulaComputable) {
    return {
      amount: formulaAmount,
      warnings,
      usedAnchor: false,
      requiresConfirmation: false,
      audit: buildAudit(formulaAmount, "formula", "valor_no_persiste_recalculo", status),
    }
  }

  // Unchanged + replay_only + sin fórmula: lo único disponible es el ancla.
  warnings.push("Sin fórmula configurada; se repite el último importe comprobado.")
  return {
    amount: anchor.amount,
    warnings,
    usedAnchor: true,
    requiresConfirmation: false,
    audit: buildAudit(anchor.amount, "anchor", "sin_formula_replay_unico", status),
  }
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
