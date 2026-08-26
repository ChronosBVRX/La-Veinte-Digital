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
  // Ayuda para Despensa (050): importe observado en tarjetón real
  // 2A-AGO-2026 ($200.00 quincenales). Pendiente confirmar contra catálogo
  // oficial; versionado para poder actualizar sin romper reproducciones.
  "050": [
    {
      effectiveFrom: "2025-01-01",
      amount: 200,
      frequency: "biweekly",
    },
  ],
}

export function getFixedAmount(
  conceptCode: string,
  date: string
): { amount: number; frequency: "biweekly" | "monthly" | "annual"; version: string } | null {
  const entries = FIXED_CONCEPT_AMOUNTS[conceptCode]
  if (!entries || entries.length === 0) return null

  const applicable = entries.find((e) => {
    if (date < e.effectiveFrom) return false
    if (e.effectiveTo && date > e.effectiveTo) return false
    return true
  })

  if (!applicable) return null
  return { amount: applicable.amount, frequency: applicable.frequency, version: applicable.effectiveFrom }
}
