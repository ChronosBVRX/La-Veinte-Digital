/**
 * "Revisa tu quincena": estados de revisión a partir de reglas con fundamento.
 */
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import { guideReviewRules, buildUnconfirmedRule, type GuideReviewRule, type GuideReviewState } from "@/features/tarjeton-guia/data/review-rules"

export interface ReviewItem {
  rule: GuideReviewRule
  state: GuideReviewState
  message: string
  caveat?: string
  helpHref?: string
  helpLabel?: string
}

/** Construye la lista de revisión para un tarjetón. */
export function buildReviewChecklist(payslip: GuidePayslip): ReviewItem[] {
  const items: ReviewItem[] = []

  for (const rule of guideReviewRules) {
    const occurrence = rule.when ? rule.when(payslip) : "unknown"
    const state = occurrence === "absent" ? rule.absentState : occurrence === "present" ? rule.presentState : "no-evaluable"
    const message = occurrence === "absent" ? rule.absentMessage : occurrence === "present" ? rule.presentMessage : "No podemos evaluar este concepto en esta quincena."
    items.push({
      rule,
      state,
      message,
      caveat: rule.caveat,
      helpHref: rule.helpHref,
      helpLabel: rule.helpLabel,
    })
  }

  const unconfirmed = buildUnconfirmedRule(payslip)
  if (unconfirmed) {
    items.push({
      rule: unconfirmed,
      state: "review",
      message: unconfirmed.presentMessage,
      caveat: unconfirmed.caveat,
      helpHref: unconfirmed.helpHref,
      helpLabel: unconfirmed.helpLabel,
    })
  }

  return items
}
