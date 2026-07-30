export interface FixedConceptAmountEntry {
  effectiveFrom: string
  effectiveTo?: string
  amount: number
  frequency: "biweekly" | "monthly" | "annual"
}

export const FIXED_CONCEPT_AMOUNTS: Record<string, FixedConceptAmountEntry[]> = {
  "020": [
    {
      effectiveFrom: "2025-01-01",
      amount: 250,
      frequency: "biweekly",
    },
  ],
}

export function getFixedAmount(
  conceptCode: string,
  date: string
): { amount: number; frequency: "biweekly" | "monthly" | "annual" } | null {
  const entries = FIXED_CONCEPT_AMOUNTS[conceptCode]
  if (!entries || entries.length === 0) return null

  const applicable = entries.find((e) => {
    if (date < e.effectiveFrom) return false
    if (e.effectiveTo && date > e.effectiveTo) return false
    return true
  })

  if (!applicable) return null
  return { amount: applicable.amount, frequency: applicable.frequency }
}
