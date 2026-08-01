import type { CalculatedPayrollConcept, ProjectionTotals } from "./types"

export function calculateProjectionTotals(
  concepts: CalculatedPayrollConcept[],
): ProjectionTotals {
  const confirmedEarnings = concepts.filter(
    (c) => c.type === "earning" && c.included && c.confidence === "high"
  )
  const probableEarnings = concepts.filter(
    (c) => c.type === "earning" && (c.included && c.confidence === "medium")
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

  const confirmedGross = confirmedEarningsTotal + probableEarningsTotal
  const possibleGross = confirmedGross + conditionalPotentialTotal

  const confirmedNet = confirmedDeductionsTotal > 0 || estimatedDeductionsTotal > 0
    ? confirmedGross - confirmedDeductionsTotal - estimatedDeductionsTotal
    : undefined

  return {
    confirmedEarnings: confirmedEarningsTotal,
    probableEarnings: probableEarningsTotal,
    conditionalPotentialEarnings: conditionalPotentialTotal,
    confirmedDeductions: confirmedDeductionsTotal,
    estimatedDeductions: estimatedDeductionsTotal,
    confirmedGross,
    possibleGross,
    confirmedNet,
    estimatedNetRange: confirmedNet !== undefined
      ? { minimum: confirmedGross - confirmedDeductionsTotal - estimatedDeductionsTotal, maximum: confirmedGross }
      : undefined,
  }
}
