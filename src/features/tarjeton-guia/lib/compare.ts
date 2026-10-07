/**
 * Comparación descriptiva de quincenas. La comparación es descriptiva, nunca
 * acusatoria: usa códigos normalizados y distingue aparición/desaparición/variación.
 */
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import {
  diagnoseConceptDiscrepancy,
  type ConceptDiscrepancyDiagnosis,
} from "@/features/tarjeton-guia/lib/concept-discrepancy-diagnostics"

export type ChangeType = "nuevo" | "desaparecio" | "subio" | "bajo"

export interface PayChange {
  type: ChangeType
  code: string
  label: string
  previousAmount?: number
  amount?: number
  diagnosis?: ConceptDiscrepancyDiagnosis
}

export interface PayslipComparison {
  hasPrevious: boolean
  periodCurrent: string
  periodPrevious: string
  changes: PayChange[]
  sameCodes: number
}

function norm(line: { code: string | null; description?: string }) {
  if (line.code) return normalizeCode(line.code) ?? line.code
  return line.description || "sin-codigo"
}

/** Compara dos quincenas de forma descriptiva incorporando diagnóstico de naturaleza laboral. */
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
      const diag = diagnoseConceptDiscrepancy(c, "nuevo", { amount: l.amount, label: l.description })
      changes.push({ type: "nuevo", code: c, label: l.description, amount: l.amount, diagnosis: diag })
    } else if (Math.abs(prev.amount - l.amount) > 0.01) {
      const changeType = Math.abs(l.amount) > Math.abs(prev.amount) ? "subio" : "bajo"
      const diag = diagnoseConceptDiscrepancy(c, changeType, {
        previousAmount: prev.amount,
        amount: l.amount,
        label: l.description,
      })
      changes.push({
        type: changeType,
        code: c,
        label: l.description,
        previousAmount: prev.amount,
        amount: l.amount,
        diagnosis: diag,
      })
    }
  }

  for (const l of prevAll) {
    const c = norm(l)
    if (!curCodes.has(c)) {
      const diag = diagnoseConceptDiscrepancy(c, "desaparecio", {
        previousAmount: l.amount,
        label: l.description,
      })
      changes.push({
        type: "desaparecio",
        code: c,
        label: l.description,
        previousAmount: l.amount,
        diagnosis: diag,
      })
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

/** Frase descriptiva para un cambio que diagnostica su naturaleza y causa probable. */
export function describeChange(change: PayChange): string {
  const diag =
    change.diagnosis ??
    diagnoseConceptDiscrepancy(change.code, change.type, {
      previousAmount: change.previousAmount,
      amount: change.amount,
      label: change.label,
    })

  switch (change.type) {
    case "nuevo":
      return `El concepto ${change.code} ${change.label ? `(${change.label})` : ""} aparece en esta quincena.${diag.probableCause ? ` Causa: ${diag.probableCause}` : ""}`
    case "desaparecio":
      return `El concepto ${change.code} no aparece en esta quincena.${diag.probableCause ? ` Causa probable: ${diag.probableCause}` : ""}`
    case "subio":
      return `El importe del concepto ${change.code} aumentó respecto a la quincena anterior.${diag.probableCause ? ` (${diag.probableCause})` : ""}`
    case "bajo":
      return `El importe del concepto ${change.code} es menor respecto a la quincena anterior.${diag.probableCause ? ` Causa probable: ${diag.probableCause}` : ""}`
  }
}
