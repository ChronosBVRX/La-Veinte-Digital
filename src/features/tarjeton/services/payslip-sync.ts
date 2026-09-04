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
import type { ImportedPayslip, EmployeePayrollProfile, PayrollFact, RecurringConceptEvidence } from "@/features/nomina/lib/types"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { getPayPeriod } from "@/features/nomina/lib/periods"
import { institutionalToday } from "@/shared/lib/dates"
import { PAYSLIP_FACT_CODES, classifyOccurrence, classifyPersistence } from "@/shared/lib/recurring-concept-classifier"
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
      code: l.code ?? "",
      description: l.description,
      amount: l.amount,
      confirmedByUser: l.confirmedByUser,
      includeInNextProjection: l.confirmedByUser,
    })),
    deductions: payroll.deductions.map((l) => ({
      code: l.code ?? "",
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
    if (!line.confirmedByUser || line.amount <= 0 || !line.code) continue
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
    if (!line.confirmedByUser || line.amount <= 0 || !line.code) continue
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
  const now = new Date().toISOString()
  const baseProfile: EmployeePayrollProfile = profile ?? {
    id: `profile_${userId}`,
    userId,
    consentGiven: true,
    employmentType: "base",
    occupationalConditions: [],
    siapConceptMarks: [],
    categoryName: request.parsed.employee.categoryName ?? "",
    categoryCode: request.parsed.employee.categoryCode,
    workdayHours: (request.parsed.employee.workdayHours as 6 | 6.5 | 8 | 12) ?? 8,
    institutionalEntryDate: request.parsed.employee.entryDate,
    effectiveSeniorityDate: request.parsed.employee.seniority?.reconstructedEffectiveDate,
    facts: [],
    recurringConcepts: [],
    createdAt: now,
    updatedAt: now,
  }
  const updatedProfile = applyPayslipToProfile(baseProfile, request.parsed, request)
  saveProfile(updatedProfile)

  return { payslip, profile: updatedProfile }
}
