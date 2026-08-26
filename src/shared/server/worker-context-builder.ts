/**
 * Constructor PURO del contexto de nómina para el simulador.
 *
 * Sin directivas "use server" ni acceso a red: testeable directamente.
 *
 * HISTORIA (bug $200.00): el RPC `confirm_imported_payslip` solo persiste un
 * subconjunto histórico (050/023/063) en `payroll_contexts.recurring_concepts`;
 * hidratar la portada con ese subconjunto sumaba una sola percepción en lugar
 * del total comprobado ($14,256.87 en el tarjetón real 2A-AGO-2026). Aquí se
 * reconstruye la lista COMPLETA desde `imported_payslip_lines`.
 */
import type { RecurringConceptEvidence, ConceptOccurrenceType, EligibilityPersistence } from "@/features/nomina/lib/types"
import { classifyOccurrence, classifyPersistence } from "@/shared/lib/recurring-concept-classifier"

export interface WorkerContext {
  profile: {
    fullName: string | null
    matricula: string | null
    categoria: string | null
    antiguedad: string | null
  } | null
  employment: {
    categoryName: string | null
    categoryCode: string | null
    workdayHours: number | null
    employmentType: string | null
    entryDate: string | null
    effectiveSeniorityDate: string | null
    seniorityRaw: string | null
  } | null
  payroll: {
    latestPeriod: string | null
    totalEarnings: number | null
    totalDeductions: number | null
    netPay: number | null
    recurringConcepts: unknown[]
    payrollFacts: unknown[]
  } | null
}

/** Línea de percepción/deducción tal como vive en `imported_payslip_lines`. */
export interface PayslipLineRow {
  concept_code: string
  description: string
  amount: number
  kind: "earning" | "deduction"
  confirmed_by_user: boolean
}

/**
 * Reconstruye la lista COMPLETA de recurrentes desde las líneas confirmadas
 * del último tarjetón real.
 *
 * HISTORIA: el RPC `confirm_imported_payslip` solo persiste un subconjunto
 * histórico (050/023/063) en `payroll_contexts.recurring_concepts`; hidratar
 * el simulador con ese subconjunto hacía que la portada sumara $200 (una sola
 * percepción) en lugar del total comprobado ($14,256.87). Esta función usa la
 * verdad de terreno (`imported_payslip_lines`) y preserva entradas previas
 * para códigos ausentes en el tarjetón más reciente.
 */
export function buildRecurringConceptsFromPayslipLines(
  lines: PayslipLineRow[],
  periodRaw: string | null,
  existing: unknown[],
): RecurringConceptEvidence[] {
  // Normalizar entradas existentes válidas (defensa ante JSONB legacy).
  const merged = new Map<string, RecurringConceptEvidence>()
  for (const raw of existing) {
    if (!raw || typeof raw !== "object") continue
    const e = raw as Partial<RecurringConceptEvidence>
    if (typeof e.conceptCode !== "string" || !e.conceptCode) continue
    merged.set(e.conceptCode, {
      conceptCode: e.conceptCode,
      appearsNormally: typeof e.appearsNormally === "boolean" ? e.appearsNormally : null,
      lastAmount: typeof e.lastAmount === "number" ? e.lastAmount : undefined,
      source: e.source ?? "last_payslip",
      firstSeenAt: e.firstSeenAt,
      lastSeenAt: e.lastSeenAt,
      confirmed: e.confirmed === true,
      occurrenceType: (e.occurrenceType ?? "unknown") as ConceptOccurrenceType,
      eligibilityPersistence: (e.eligibilityPersistence ?? "until_changed") as EligibilityPersistence,
    })
  }

  // Las líneas del tarjetón real son la fuente más fresca: ganan por código.
  for (const line of lines) {
    if (line.kind !== "earning") continue
    if (!line.confirmed_by_user) continue
    if (!(line.amount > 0)) continue
    const code = line.concept_code
    const occurrenceType = classifyOccurrence(code)
    const prev = merged.get(code)
    merged.set(code, {
      conceptCode: code,
      appearsNormally: occurrenceType === "recurring" || occurrenceType === "variable",
      lastAmount: line.amount,
      source: "last_payslip",
      firstSeenAt: prev?.firstSeenAt ?? periodRaw ?? undefined,
      lastSeenAt: periodRaw ?? prev?.lastSeenAt,
      confirmed: true,
      occurrenceType,
      eligibilityPersistence: classifyPersistence(code),
    })
  }

  return Array.from(merged.values())
}

/**
 * Helper puro para pruebas y reutilización: arma `payroll` a partir de las
 * filas ya consultadas. Mantiene el contrato `WorkerContext` intacto.
 */
export function buildWorkerContextPayroll(
  latest: {
    period_raw: string | null
    payroll_totals: Record<string, number> | null
  } | null,
  ctxRecurring: unknown[],
  ctxFacts: unknown[],
  payslipLines: PayslipLineRow[],
): WorkerContext["payroll"] {
  return {
    latestPeriod: latest?.period_raw ?? null,
    totalEarnings: latest?.payroll_totals?.totalEarnings ?? null,
    totalDeductions: latest?.payroll_totals?.totalDeductions ?? null,
    netPay: latest?.payroll_totals?.netPay ?? null,
    recurringConcepts: buildRecurringConceptsFromPayslipLines(
      payslipLines,
      latest?.period_raw ?? null,
      ctxRecurring,
    ),
    payrollFacts: ctxFacts,
  }
}
