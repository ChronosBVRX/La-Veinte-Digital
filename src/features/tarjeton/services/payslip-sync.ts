/**
 * Sincronización local tras confirmar un tarjetón.
 *
 * Escribe en localStorage (vía `shared/services/local-storage`):
 * - el tarjetón como `ImportedPayslip` (historial de quincenas),
 * - el perfil de nómina actualizado (categoría, antigüedad, hechos y
 *   evidencia de conceptos recurrentes del tarjetón).
 *
 * Es cliente y puro: no llama a la red.
 */
import type { ImportedPayslip, EmployeePayrollProfile, PayrollFact, RecurringConceptEvidence, ConceptOccurrenceType, EligibilityPersistence } from "@/features/nomina/lib/types"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { getPayPeriod } from "@/features/nomina/lib/periods"
import { institutionalToday } from "@/shared/lib/dates"
import { getProfile, savePayslip, saveProfile } from "@/shared/services/local-storage"

export interface PayslipSyncResult {
  payslip: ImportedPayslip
  profile: EmployeePayrollProfile
}

export function buildImportedPayslip(
  response: ConfirmTarjetonResponse,
  request: ConfirmTarjetonRequest,
  userId: string,
): ImportedPayslip {
  const { parsed } = request
  const { document, payroll } = parsed

  const period =
    document.year && document.month && document.half
      ? getPayPeriod(document.year, document.month, document.half)
      : getPayPeriod(institutionalToday().getFullYear(), institutionalToday().getMonth() + 1, 1)

  const seniority = parsed.employee.seniority
  const fallbackEarnings = payroll.earnings.reduce((s, l) => s + l.amount, 0)
  const fallbackDeductions = Math.abs(payroll.deductions.reduce((s, l) => s + l.amount, 0))

  return {
    id: response.id,
    userId,
    period,
    categoryName: parsed.employee.categoryName,
    institutionalEntryDate: parsed.employee.entryDate,
    displayedSeniority: seniority && seniority.fortnights === 0
      ? { years: seniority.years, months: 0, days: seniority.days }
      : undefined,
    earnings: payroll.earnings.map((l) => ({
      code: l.code,
      description: l.description,
      amount: l.amount,
      confirmedByUser: l.confirmedByUser,
      includeInNextProjection: l.confirmedByUser,
    })),
    deductions: payroll.deductions.map((l) => ({
      code: l.code,
      description: l.description,
      amount: l.amount,
      confirmedByUser: l.confirmedByUser,
      includeInNextProjection: l.confirmedByUser,
    })),
    totalEarnings: payroll.totalEarnings ?? fallbackEarnings,
    totalDeductions: payroll.totalDeductions ?? fallbackDeductions,
    netPay: payroll.netPay ?? fallbackEarnings - fallbackDeductions,
    source: "pdf",
    confirmedByUser: true,
  }
}

/**
 * Códigos de conceptos que, además de guardarse como ancla de importe,
 * deben registrarse también como hecho booleano (concept_XXX_on_payslip)
 * para alimentar el motor de elegibilidad existente.
 *
 * Solo se incluyen los códigos que tienen entrada correspondiente en
 * PayrollFactKey — 002, 011, 020, 022, 050, 055 no necesitan hecho
 * booleano porque su elegibilidad se determina por otras vías.
 */
const PAYSLIP_FACT_CODES = new Set([
  "02", "012", "013",
  "051", "054", "057", "058",
  "061", "062", "072", "078", "083",
])

/**
 * Clasifica el tipo de ocurrencia de un concepto según su código.
 *
 * - recurring: aparece en cada tarjetón siempre (base, ayuda de renta, despensa).
 * - periodic: solo en quincenas específicas (aguinaldo anual, fondo de ahorro julio).
 * - variable: aparece regularmente pero el importe depende de la base (conceptos derivados).
 * - unknown: conceptos no clasificados (deducciones, horas extra, retroactivos, etc.).
 */
function classifyOccurrence(code: string): ConceptOccurrenceType {
  const recurring = new Set(["002", "011", "020", "050", "023", "063"])
  if (recurring.has(code)) return "recurring"

  const periodic = new Set(["022", "055"])
  if (periodic.has(code)) return "periodic"

  const variable = new Set(["02", "012", "013", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (variable.has(code)) return "variable"

  return "unknown"
}

/**
 * Clasifica la persistencia de elegibilidad según el código del concepto.
 */
function classifyPersistence(code: string): EligibilityPersistence {
  const persistent = new Set(["002", "011", "020"])
  if (persistent.has(code)) return "persistent"
  const periodScoped = new Set(["022", "055"])
  if (periodScoped.has(code)) return "period_scoped"
  const untilChanged = new Set(["02", "012", "013", "050", "023", "063", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (untilChanged.has(code)) return "until_changed"
  return "event_scoped"
}

/** Fusiona la evidencia del tarjetón en el perfil de nómina local. */
export function applyPayslipToProfile(
  profile: EmployeePayrollProfile,
  parsed: ParsedImssTarjeton,
  request: ConfirmTarjetonRequest,
): EmployeePayrollProfile {
  const updated: EmployeePayrollProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  }

  const { profileUpdates } = request
  const employee = parsed.employee
  const seniority = employee.seniority

  if (profileUpdates.categoria === true && employee.categoryName) {
    updated.categoryName = employee.categoryName
    updated.categoryCode = employee.categoryCode
    if (employee.workdayHours === 6 || employee.workdayHours === 6.5 || employee.workdayHours === 8 || employee.workdayHours === 12) {
      updated.workdayHours = employee.workdayHours
    }
  }
  if (profileUpdates.antiguedad === true && seniority) {
    if (employee.entryDate) {
      updated.institutionalEntryDate = employee.entryDate
    }
    if (seniority.reconstructedEffectiveDate) {
      updated.effectiveSeniorityDate = seniority.reconstructedEffectiveDate
    }
    if (seniority.fortnights === 0) {
      updated.displayedSeniorityAtLastPayslip = {
        years: seniority.years,
        months: 0,
        days: seniority.days,
        referenceDate: seniority.referenceDate ?? parsed.document.periodRaw,
      }
    }
  }

  const payslipDate = parsed.document.periodRaw ?? new Date().toISOString().slice(0, 10)

  // Guardar importe ancla de TODOS los conceptos de percepción confirmados.
  const recurringConcepts: RecurringConceptEvidence[] = [...(profile.recurringConcepts ?? [])]
  for (const line of parsed.payroll.earnings) {
    if (!line.confirmedByUser || line.amount <= 0) continue
    const existingIdx = recurringConcepts.findIndex((r) => r.conceptCode === line.code)
    const occurrenceType = classifyOccurrence(line.code)
    const eligibilityPersistence = classifyPersistence(line.code)
    const entry: RecurringConceptEvidence = {
      conceptCode: line.code,
      appearsNormally: occurrenceType === "recurring" || occurrenceType === "variable",
      lastAmount: line.amount,
      source: "last_payslip",
      firstSeenAt: existingIdx >= 0 ? recurringConcepts[existingIdx].firstSeenAt : payslipDate,
      lastSeenAt: payslipDate,
      confirmed: true,
      occurrenceType,
      eligibilityPersistence,
    }
    if (existingIdx >= 0) {
      recurringConcepts[existingIdx] = entry
    } else {
      recurringConcepts.push(entry)
    }
  }
  updated.recurringConcepts = recurringConcepts

  // Registrar hechos booleanos para los códigos que el motor de elegibilidad
  // aún espera (compatibilidad con reglas y eligibility-catalog existentes).
  const facts = [...(profile.facts ?? [])]
  for (const line of parsed.payroll.earnings) {
    if (!line.confirmedByUser || line.amount <= 0) continue
    if (!PAYSLIP_FACT_CODES.has(line.code)) continue
    const factKey = `concept_${line.code}_on_payslip` as PayrollFact["key"]
    const existingFact = facts.findIndex((f) => f.key === factKey)
    const fact: PayrollFact = {
      key: factKey,
      value: true,
      source: "last_payslip",
      confidence: 0.9,
      updatedAt: new Date().toISOString(),
    }
    if (existingFact >= 0) {
      facts[existingFact] = fact
    } else {
      facts.push(fact)
    }
  }
  updated.facts = facts

  return updated
}

/** Persiste el tarjetón y el perfil actualizado en el navegador. */
export function syncConfirmedPayslip(
  response: ConfirmTarjetonResponse,
  request: ConfirmTarjetonRequest,
  userId: string,
): PayslipSyncResult {
  const payslip = buildImportedPayslip(response, request, userId)
  savePayslip(payslip)

  const profile = getProfile()
  const updatedProfile = profile ? applyPayslipToProfile(profile, request.parsed, request) : profile
  if (updatedProfile) {
    saveProfile(updatedProfile)
  }

  return { payslip, profile: updatedProfile as EmployeePayrollProfile }
}
