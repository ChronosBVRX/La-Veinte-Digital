/**
 * Validaciones matemáticas del tarjetón.
 *
 * - sum(percepciones) === totalPercepciones  (tolerancia 5 centavos)
 * - sum(deducciones) === totalDeducciones    (tolerancia 5 centavos)
 * - totalPercepciones − totalDeducciones === líquido (tolerancia 5 centavos)
 * - comprobación auxiliar: 011 ≈ 002 × 0.8215 (no reemplaza importes)
 */
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { roundImssMoney } from "./money-parser"

export const TOTALS_TOLERANCE = 0.05

export function moneyCloseEnough(a: number | undefined, b: number | undefined, tolerance = TOTALS_TOLERANCE): boolean {
  if (a === undefined || b === undefined) return false
  return Math.abs(a - b) <= tolerance
}

export interface TarjetonTotalsValidation {
  earningsTotalMatches: boolean | null
  deductionsTotalMatches: boolean | null
  netPayMatches: boolean | null
  messages: string[]
}

export function validateTarjetonTotals(parsed: ParsedImssTarjeton): TarjetonTotalsValidation {
  const messages: string[] = []
  const { payroll } = parsed

  const sumEarnings = roundImssMoney(payroll.earnings.reduce((s, l) => s + l.amount, 0))
  const sumDeductions = roundImssMoney(payroll.deductions.reduce((s, l) => s + l.amount, 0))

  const earningsTotalMatches =
    payroll.totalEarnings === undefined
      ? null
      : moneyCloseEnough(sumEarnings, payroll.totalEarnings)

  // Las deducciones se imprimen como importes negativos; el total es la
  // magnitud. Se compara |suma| contra el total declarado.
  const deductionsTotalMatches =
    payroll.totalDeductions === undefined
      ? null
      : moneyCloseEnough(Math.abs(sumDeductions), payroll.totalDeductions)

  let netPayMatches: boolean | null = null
  if (payroll.totalEarnings !== undefined && payroll.totalDeductions !== undefined && payroll.netPay !== undefined) {
    netPayMatches = moneyCloseEnough(
      roundImssMoney(payroll.totalEarnings - payroll.totalDeductions),
      payroll.netPay,
    )
  }

  if (earningsTotalMatches === false) {
    messages.push(
      `La suma de percepciones (${sumEarnings.toFixed(2)}) no coincide con el total declarado (${(payroll.totalEarnings ?? 0).toFixed(2)}).`,
    )
  }
  if (deductionsTotalMatches === false) {
    messages.push(
      `La suma de deducciones (${sumDeductions.toFixed(2)}) no coincide con el total declarado (${(payroll.totalDeductions ?? 0).toFixed(2)}).`,
    )
  }
  if (netPayMatches === false) {
    messages.push(
      `El líquido declarado (${(payroll.netPay ?? 0).toFixed(2)}) no coincide con percepciones − deducciones (${(roundImssMoney((payroll.totalEarnings ?? 0) - (payroll.totalDeductions ?? 0))).toFixed(2)}).`,
    )
  }

  return { earningsTotalMatches, deductionsTotalMatches, netPayMatches, messages }
}

/** Factor de comprobación 011 ≈ 002 × 0.8215 (tolerancia relativa 1%). */
export const CONCEPT_011_SANITY_FACTOR = 0.8215
export const CONCEPT_011_SANITY_TOLERANCE = 0.01

export interface Concept011SanityCheck {
  expected: number | null
  ratio: number | null
  plausible: boolean | null
}

export function validateConcept011Sanity(concept002: number | undefined, concept011: number | undefined): Concept011SanityCheck {
  if (concept002 === undefined || concept011 === undefined) {
    return { expected: null, ratio: null, plausible: null }
  }
  const expected = roundImssMoney(concept002 * CONCEPT_011_SANITY_FACTOR)
  const ratio = concept002 > 0 ? concept011 / concept002 : null
  const plausible =
    ratio === null
      ? null
      : Math.abs(ratio - CONCEPT_011_SANITY_FACTOR) / CONCEPT_011_SANITY_FACTOR <= CONCEPT_011_SANITY_TOLERANCE

  return { expected, ratio, plausible }
}

export function totalsRequireReview(validation: TarjetonTotalsValidation): boolean {
  return (
    validation.earningsTotalMatches === false ||
    validation.deductionsTotalMatches === false ||
    validation.netPayMatches === false
  )
}
