import { createClient } from "@/lib/supabase/server"
import type { CalculatorId, CalculatorPrefillResponse, PrefillSource } from "@/shared/contracts/calculator-prefill"
import type { Tables } from "@/lib/supabase/types"
import type {
  EmployeePayrollProfile,
  OccupationalCondition,
  PayrollFact,
  RecurringConceptEvidence,
  SiapConceptMark,
  ConceptOccurrenceType,
  EligibilityPersistence,
} from "../lib/types"
import { resolveCategory } from "../lib/category-resolver"
import { calculateSeniority } from "../lib/seniority"
import { getCurrentPayPeriod } from "../lib/periods"
import { parseSeniorityText } from "../lib/antiguedad-parser"
import { calculateProjection } from "../lib/engine"
import {
  buildCalculatorPrefillResponse,
  type CalculatorPrefillBuildContext,
  type RecurringEvidenceEntry,
} from "../lib/calculator-prefill-builder"

/**
 * Servicio de construcción del prerrelleno (lado servidor).
 *
 * Lee SOLO datos del trabajador autenticado, reutiliza el motor de nómina
 * existente y devuelve la respuesta de prerrelleno. No escribe nada.
 */

type PayrollContextRow = Tables<"payroll_contexts">

const EMPLOYMENT_TYPES = ["base", "sustituto", "interino", "obra_determinada", "confianza", "otro"] as const
const VALID_JORNADAS = [6, 6.5, 8, 12] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function parseJsonArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : []
}

function classifyOccurrence(code: string): ConceptOccurrenceType {
  const recurring = new Set(["002", "011", "020", "050", "023", "063"])
  if (recurring.has(code)) return "recurring"
  const periodic = new Set(["022", "055"])
  if (periodic.has(code)) return "periodic"
  const variable = new Set(["02", "012", "013", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (variable.has(code)) return "variable"
  return "unknown"
}

function classifyPersistence(code: string): EligibilityPersistence {
  const persistent = new Set(["002", "011", "020"])
  if (persistent.has(code)) return "persistent"
  const periodScoped = new Set(["022", "055"])
  if (periodScoped.has(code)) return "period_scoped"
  const untilChanged = new Set(["02", "012", "013", "050", "023", "063", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (untilChanged.has(code)) return "until_changed"
  return "event_scoped"
}

function normalizeRecurringConcepts(raw: unknown[]): RecurringConceptEvidence[] {
  const result: RecurringConceptEvidence[] = []
  for (const item of raw) {
    if (!isObject(item)) continue
    const code = asString(item.conceptCode)
    if (!code) continue
    const source = asString(item.source)
    const storedType = asString(item.occurrenceType) as ConceptOccurrenceType | undefined
    const storedPersistence = asString(item.eligibilityPersistence) as EligibilityPersistence | undefined
    result.push({
      conceptCode: code,
      appearsNormally: asBoolean(item.appearsNormally) ?? null,
      lastAmount: asNumber(item.lastAmount),
      source: source === "last_payslip" || source === "multiple_payslips" || source === "appointment_document" || source === "user"
        ? source
        : "user",
      firstSeenAt: asString(item.firstSeenAt),
      lastSeenAt: asString(item.lastSeenAt),
      confirmed: asBoolean(item.confirmed) ?? false,
      occurrenceType: storedType ?? classifyOccurrence(code),
      eligibilityPersistence: storedPersistence ?? classifyPersistence(code),
    })
  }
  return result
}

function buildRecurringEvidence(profile: EmployeePayrollProfile): RecurringEvidenceEntry[] {
  const entries: RecurringEvidenceEntry[] = []
  for (const rc of profile.recurringConcepts) {
    if (!rc.confirmed || rc.appearsNormally !== true || rc.lastAmount === undefined) continue
    entries.push({
      conceptCode: rc.conceptCode,
      amount: rc.lastAmount,
      source: rc.source === "multiple_payslips" ? "multiple_payslips" : "last_payslip",
      confirmed: true,
    })
  }
  return entries
}

export interface BuildCalculatorPrefillArgs {
  calculatorId: CalculatorId
  userId: string
  targetDate: string
}

export async function buildCalculatorPrefill(args: BuildCalculatorPrefillArgs): Promise<CalculatorPrefillResponse> {
  const { calculatorId, userId, targetDate } = args
  const generatedAt = new Date().toISOString()
  const isDev = process.env.NODE_ENV !== "production"
  const warnings: string[] = []

  const supabase = await createClient()

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("categoria, antiguedad")
    .eq("id", userId)
    .maybeSingle()

  if (profileError && isDev) {
    console.warn("[calculator-prefill] perfil no disponible:", profileError.message)
  }

  let contextRow: PayrollContextRow | null = null
  try {
    const { data } = await supabase
      .from("payroll_contexts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    contextRow = data ?? null
  } catch (err) {
    if (isDev) {
      console.warn("[calculator-prefill] payroll_contexts no disponible:", err instanceof Error ? err.message : err)
    }
  }

  // Gating de consentimiento: los datos del tarjetón (categoría, jornada,
  // antigüedad, conceptos recurrentes, hechos) solo se usan si el trabajador
  // aceptó el consentimiento. Sin él, el prerrelleno usa únicamente el
  // perfil básico (categoría/antigüedad que el propio usuario registró).
  const contextAllowed = contextRow?.consent_given === true
  const contextProfile = contextAllowed ? contextRow : null

  // Días laborados en el año: solo si vienen del último tarjetón confirmado
  // (nunca se asume un valor por defecto) y el consentimiento está otorgado.
  let daysWorkedInAnnualPeriod: { value: number; source: PrefillSource; note?: string } | undefined
  if (contextAllowed) {
    try {
      const { data: latestPayslip } = await supabase
        .from("imported_payslips")
        .select("payroll_totals")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const totals = latestPayslip?.payroll_totals
      const days = isObject(totals) ? asNumber(totals.daysWorkedInYear) : undefined
      if (days !== undefined && days > 0) {
        daysWorkedInAnnualPeriod = {
          value: days,
          source: "last_payslip",
          note: "Días laborados del último tarjetón confirmado.",
        }
      }
    } catch (err) {
      if (isDev) {
        console.warn("[calculator-prefill] imported_payslips no disponible:", err instanceof Error ? err.message : err)
      }
    }
  }

  const emptyContext = (status: CalculatorPrefillBuildContext["categoryStatus"]): CalculatorPrefillResponse =>
    buildCalculatorPrefillResponse({
      calculatorId,
      targetDate,
      generatedAt,
      profile: null,
      category: null,
      categoryStatus: status,
      seniority: null,
      senioritySource: null,
      concepts: new Map(),
      recurringEvidence: [],
    })

  if (!profileRow && !contextRow) {
    return emptyContext("missing_profile")
  }

  const categoryIdentifier = contextProfile?.category_name ?? profileRow?.categoria ?? contextProfile?.category_id ?? ""
  const existingCategoryId = contextProfile?.category_id ?? undefined

  let resolutionStatus: CalculatorPrefillBuildContext["categoryStatus"] = "not_found"
  let category: CalculatorPrefillBuildContext["category"] = null
  let categoryResolutionMessage: string | undefined

  if (categoryIdentifier.trim() !== "" || existingCategoryId) {
    const result = resolveCategory(categoryIdentifier, targetDate, existingCategoryId)
    if (result.resolved && result.category) {
      resolutionStatus = "resolved"
      category = result.category
      categoryResolutionMessage = result.message
    } else if (result.status === "ambiguous") {
      resolutionStatus = "ambiguous"
      categoryResolutionMessage = result.message
    } else {
      resolutionStatus = "not_found"
      categoryResolutionMessage = result.message
      if (isDev) {
        console.warn(`[calculator-prefill] categoría no resuelta (${calculatorId}): ${result.status}`)
      }
    }
  }

  const workdayHours = asNumber(contextProfile?.workday_hours) ?? category?.workdayHours ?? 8

  const employmentType = asString(contextProfile?.employment_type) ?? "base"

  const recurringConcepts = normalizeRecurringConcepts(parseJsonArray(contextProfile?.recurring_concepts))

  const profile: EmployeePayrollProfile = {
    id: userId,
    userId,
    consentGiven: contextRow?.consent_given === true,
    categoryId: category?.categoryId ?? contextProfile?.category_id ?? undefined,
    categoryName: category?.categoryName ?? contextProfile?.category_name ?? profileRow?.categoria ?? undefined,
    categoryCode: category?.categoryCode ?? contextProfile?.category_code ?? undefined,
    workdayHours: (VALID_JORNADAS as readonly number[]).includes(workdayHours) ? workdayHours as 6 | 6.5 | 8 | 12 : 8,
    employmentType: (EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)
      ? employmentType as EmployeePayrollProfile["employmentType"]
      : "base",
    occupationalConditions: parseJsonArray(contextProfile?.occupational_conditions).filter(isObject) as unknown as OccupationalCondition[],
    facts: parseJsonArray(contextProfile?.payroll_facts).filter(isObject) as unknown as PayrollFact[],
    siapConceptMarks: parseJsonArray(contextProfile?.siap_concept_marks).filter(isObject) as unknown as SiapConceptMark[],
    recurringConcepts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (!contextAllowed && contextRow) {
    warnings.push("Los datos de tu tarjetón aún no se usan: para prellenar con ellos acepta el consentimiento de nómina.")
  }

  let seniority: CalculatorPrefillBuildContext["seniority"] = null
  let senioritySource: CalculatorPrefillBuildContext["senioritySource"] = null
  let effectiveSeniorityDate: string | undefined

  const contextSeniorityDate = asString(contextProfile?.effective_seniority_date)
  if (contextSeniorityDate) {
    seniority = calculateSeniority(contextSeniorityDate, targetDate)
    senioritySource = "effective_date"
    effectiveSeniorityDate = contextSeniorityDate
  }

  if (!seniority && profileRow?.antiguedad) {
    const parsed = parseSeniorityText(profileRow.antiguedad)
    if (parsed) {
      seniority = {
        years: parsed.years,
        months: parsed.months,
        days: parsed.days,
        totalDays: parsed.years * 365 + parsed.months * 30 + parsed.days,
        referenceDate: targetDate,
        source: "institutional_entry_date",
        warnings: ["Antigüedad derivada del texto del perfil"],
      }
      senioritySource = "parsed_text"
    } else if (isDev) {
      console.warn("[calculator-prefill] antigüedad del perfil no interpretable")
    }
  }

  const period = getCurrentPayPeriod(targetDate)

  const fallbackCategory = category ?? {
    categoryId: "unknown",
    categoryName: profile.categoryName ?? "Desconocida",
    categoryCode: profile.categoryCode,
    workdayHours: profile.workdayHours,
    biweeklyBaseSalary: 0,
    sourceRecordId: "unresolved-category",
  }

  const fallbackSeniority = seniority ?? {
    years: 0, months: 0, days: 0, totalDays: 0,
    referenceDate: targetDate,
    source: "confirmed_effective_date" as const,
    warnings: [],
  }

  const projectionResult = calculateProjection({
    profile,
    category: fallbackCategory,
    period,
    seniority: fallbackSeniority,
    incidents: [],
    recurringConcepts: [],
  })

  const concepts = new Map<string, (typeof projectionResult.projection.earnings)[number]>()
  const { projection } = projectionResult
  for (const concept of [
    ...projection.earnings,
    ...projection.probableConcepts,
    ...projection.conditionalConcepts,
    ...projection.excludedConcepts,
    ...projection.deductions,
  ]) {
    concepts.set(concept.code, concept)
  }

  const response = buildCalculatorPrefillResponse({
    calculatorId,
    targetDate,
    generatedAt,
    profile,
    category,
    categoryStatus: resolutionStatus,
    categoryResolutionMessage,
    seniority,
    senioritySource,
    effectiveSeniorityDate,
    concepts,
    recurringEvidence: buildRecurringEvidence(profile),
    daysWorkedInAnnualPeriod,
    warnings,
  })

  for (const warning of projection.warnings) {
    if (!response.warnings.includes(warning)) {
      response.warnings.push(warning)
    }
  }

  return response
}
