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
      : getPayPeriod(new Date().getFullYear(), new Date().getMonth() + 1, 1)

  const seniority = parsed.employee.seniority
  const fallbackEarnings = payroll.earnings.reduce((s, l) => s + l.amount, 0)
  const fallbackDeductions = Math.abs(payroll.deductions.reduce((s, l) => s + l.amount, 0))

  return {
    id: response.id,
    userId,
    period,
    categoryName: parsed.employee.categoryName,
    institutionalEntryDate: seniority?.reconstructedEffectiveDate,
    displayedSeniority: seniority && seniority.fortnights === 0
      ? { years: seniority.years, months: 0, days: seniority.days }
      : undefined,
    earnings: payroll.earnings.map((l) => ({
      code: l.code,
      description: l.description,
      amount: l.amount,
      confirmedByUser: true,
      includeInNextProjection: true,
    })),
    deductions: payroll.deductions.map((l) => ({
      code: l.code,
      description: l.description,
      amount: l.amount,
      confirmedByUser: true,
      includeInNextProjection: true,
    })),
    totalEarnings: payroll.totalEarnings ?? fallbackEarnings,
    totalDeductions: payroll.totalDeductions ?? fallbackDeductions,
    netPay: payroll.netPay ?? fallbackEarnings - fallbackDeductions,
    source: "pdf",
    confirmedByUser: true,
  }
}

const RECURRENT_CODES = new Set(["050", "023", "063"])

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
  }
  if (profileUpdates.antiguedad === true && seniority) {
    if (seniority.reconstructedEffectiveDate) {
      updated.institutionalEntryDate = seniority.reconstructedEffectiveDate
    }
    if (seniority.fortnights === 0) {
      updated.displayedSeniorityAtLastPayslip = {
        years: seniority.years,
        months: 0,
        days: seniority.days,
        referenceDate: seniority.referenceDate,
      }
    }
  }

  // Evidencia de conceptos recurrentes confirmados en el tarjetón.
  const recurringConcepts: RecurringConceptEvidence[] = [...(profile.recurringConcepts ?? [])]
  for (const line of parsed.payroll.earnings) {
    if (!RECURRENT_CODES.has(line.code)) continue
    const existing = recurringConcepts.find((r) => r.conceptCode === line.code)
    const entry: RecurringConceptEvidence = {
      conceptCode: line.code,
      appearsNormally: true,
      lastAmount: line.amount,
      source: "last_payslip",
      firstSeenAt: existing?.firstSeenAt ?? parsed.document.periodRaw,
      lastSeenAt: parsed.document.periodRaw,
      confirmed: true,
    }
    if (existing) {
      recurringConcepts[recurringConcepts.indexOf(existing)] = entry
    } else {
      recurringConcepts.push(entry)
    }
  }
  updated.recurringConcepts = recurringConcepts

  // Hecho de nómina: 054 presente en tarjetón.
  const has054 = parsed.payroll.earnings.some((l) => l.code === "054" && l.amount > 0)
  if (has054) {
    const facts = [...(profile.facts ?? []).filter((f) => f.key !== "concept_054_on_payslip")]
    const fact: PayrollFact = {
      key: "concept_054_on_payslip",
      value: true,
      source: "last_payslip",
      confidence: 0.9,
      updatedAt: new Date().toISOString(),
    }
    facts.push(fact)
    updated.facts = facts
  }

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
