import type { CalculatedPayrollConcept, ProjectionTotals } from "./types"

export function calculateProjectionTotals(
  concepts: CalculatedPayrollConcept[],
): ProjectionTotals {
  const confirmedEarnings = concepts.filter(
    (c) => c.type === "earning" && c.included && c.confidence === "high"
  )
  const probableEarnings = concepts.filter(
    (c) =>
      c.type === "earning" &&
      c.included &&
      (c.confidence === "medium" || c.confidence === "low" || c.confidence === "requires_confirmation")
  )
  const conditionalEarnings = concepts.filter(
    (c) => c.type === "earning" && !c.included && c.amount > 0
  )
  const confirmedDeductions = concepts.filter(
    (c) => c.type === "deduction" && c.included && c.confidence === "high"
  )
  const estimatedDeductions = concepts.filter(
    (c) => c.type === "deduction" && c.included && c.confidence !== "high"
  )

  const confirmedEarningsTotal = confirmedEarnings.reduce((s, c) => s + c.amount, 0)
  const probableEarningsTotal = probableEarnings.reduce((s, c) => s + c.amount, 0)
  const conditionalPotentialTotal = conditionalEarnings.reduce((s, c) => s + c.amount, 0)
  const confirmedDeductionsTotal = confirmedDeductions.reduce((s, c) => s + c.amount, 0)
  const estimatedDeductionsTotal = estimatedDeductions.reduce((s, c) => s + c.amount, 0)

  const confirmedGross = confirmedEarningsTotal
  const probableGross = confirmedGross + probableEarningsTotal
  const possibleGross = probableGross + conditionalPotentialTotal

  const confirmedNet = confirmedDeductionsTotal > 0
    ? confirmedGross - confirmedDeductionsTotal
    : undefined

  const estimatedNetRange = confirmedDeductionsTotal > 0 || estimatedDeductionsTotal > 0
    ? {
        minimum: confirmedGross - confirmedDeductionsTotal - estimatedDeductionsTotal,
        maximum: possibleGross - confirmedDeductionsTotal,
      }
    : undefined

  return {
    confirmedEarnings: confirmedEarningsTotal,
    probableEarnings: probableEarningsTotal,
    conditionalPotentialEarnings: conditionalPotentialTotal,
    confirmedDeductions: confirmedDeductionsTotal,
    estimatedDeductions: estimatedDeductionsTotal,
    confirmedGross,
    probableGross,
    possibleGross,
    confirmedNet,
    estimatedNetRange,
  }
}

export function validateProjectionTotals(totals: ProjectionTotals): boolean {
  const fields: number[] = [
    totals.confirmedEarnings,
    totals.probableEarnings,
    totals.conditionalPotentialEarnings,
    totals.confirmedDeductions,
    totals.estimatedDeductions,
    totals.confirmedGross,
    totals.probableGross,
    totals.possibleGross,
  ]
  if (totals.confirmedNet !== undefined) fields.push(totals.confirmedNet)
  if (totals.estimatedNetRange !== undefined) {
    fields.push(totals.estimatedNetRange.minimum, totals.estimatedNetRange.maximum)
  }
  return fields.every((v) => Number.isFinite(v))
}
