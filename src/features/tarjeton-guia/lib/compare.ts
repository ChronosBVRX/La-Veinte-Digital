/**
 * Comparación descriptiva de quincenas. La comparación es descriptiva, nunca
 * acusatoria: usa códigos normalizados y distingue aparición/desaparición/variación.
 */
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"

export type ChangeType = "nuevo" | "desaparecio" | "subio" | "bajo"

export interface PayChange {
  type: ChangeType
  code: string
  label: string
  previousAmount?: number
  amount?: number
}

export interface PayslipComparison {
  hasPrevious: boolean
  periodCurrent: string
  periodPrevious: string
  changes: PayChange[]
  sameCodes: number
}

function norm(line: { code: string }) {
  return normalizeCode(line.code) ?? line.code
}

/** Compara dos quincenas de forma descriptiva. */
export function compareQuincenas(current: GuidePayslip, previous: GuidePayslip): PayslipComparison {
  const curAll = [...current.earnings, ...current.deductions]
  const prevAll = [...previous.earnings, ...previous.deductions]

  const prevByCode = new Map<string, { code: string; label: string; amount: number }>()
  for (const l of prevAll) {
    const c = norm(l)
    if (!prevByCode.has(c)) prevByCode.set(c, { code: c, label: l.description, amount: l.amount })
  }

  const curCodes = new Set<string>()
  const changes: PayChange[] = []

  for (const l of curAll) {
    const c = norm(l)
    curCodes.add(c)
    const prev = prevByCode.get(c)
    if (!prev) {
      changes.push({ type: "nuevo", code: c, label: l.description, amount: l.amount })
    } else if (Math.abs(prev.amount - l.amount) > 0.01) {
      changes.push({
        type: Math.abs(l.amount) > Math.abs(prev.amount) ? "subio" : "bajo",
        code: c,
        label: l.description,
        previousAmount: prev.amount,
        amount: l.amount,
      })
    }
  }

  for (const l of prevAll) {
    const c = norm(l)
    if (!curCodes.has(c)) {
      changes.push({ type: "desaparecio", code: c, label: l.description, previousAmount: l.amount })
    }
  }

  return {
    hasPrevious: true,
    periodCurrent: current.periodRaw ?? "esta quincena",
    periodPrevious: previous.periodRaw ?? "la quincena anterior",
    changes,
    sameCodes: prevAll.filter((l) => curCodes.has(norm(l))).length,
  }
}

/** Frase descriptiva para un cambio (nunca acusatoria). */
export function describeChange(change: PayChange): string {
  switch (change.type) {
    case "nuevo":
      return `El concepto ${change.code} ${change.label ? `(${change.label})` : ""} aparece en esta quincena.`
    case "desaparecio":
      return `El concepto ${change.code} no aparece en esta quincena.`
    case "subio":
      return `El importe del concepto ${change.code} aumentó respecto a la quincena anterior.`
    case "bajo":
      return `El importe del concepto ${change.code} es menor respecto a la quincena anterior.`
  }
}
