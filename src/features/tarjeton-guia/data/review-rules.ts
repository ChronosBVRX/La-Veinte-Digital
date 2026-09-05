/**
 * Reglas de revisión de "Revisa tu quincena".
 *
 * Solo se incluyen reglas con fundamento suficiente y lenguaje descriptivo:
 * nunca acusatorio. Cada regla puede derivar en un estado normal, informativo
 * o de revisión. No evaluable se reserva a datos ausentes.
 */
import type { GuidePayslip, GuideOccurrence } from "@/features/tarjeton-guia/lib/types"

export type GuideReviewState = "normal" | "info" | "review" | "no-evaluable"

export interface GuideReviewRule {
  id: string
  code: string
  label: string
  /** Qué determina la aparición del concepto en la quincena. */
  when?: (payslip: GuidePayslip) => GuideOccurrence
  /** Estado cuando el concepto SÍ aparece. */
  presentState: GuideReviewState
  /** Estado cuando el concepto NO aparece. */
  absentState: GuideReviewState
  presentMessage: string
  absentMessage: string
  /** Texto aclaratorio que acompaña al estado informativo. */
  caveat?: string
  /** Destino del CTA "¿Por qué podría no aparecer?". */
  helpHref?: string
  helpLabel?: string
}

const hasCode = (lines: GuidePayslip["earnings"] | GuidePayslip["deductions"], code: string) =>
  lines.some((l) => l.code === code)

export const guideReviewRules: GuideReviewRule[] = [
  {
    id: "sueldo-base",
    code: "002",
    label: "Sueldo base",
    when: (p) => (hasCode(p.earnings, "002") ? "present" : "absent"),
    presentState: "normal",
    absentState: "review",
    presentMessage: "Sueldo base encontrado",
    absentMessage: "El concepto 002 no aparece en esta quincena",
    caveat: "Esto no significa necesariamente que exista un error. Algunas incidencias o el periodo en que se genera el concepto pueden modificar cuándo aparece reflejado.",
    helpHref: "/guia/conceptos/002",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "ayuda-renta",
    code: "011",
    label: "Ayuda de renta",
    when: (p) => (hasCode(p.earnings, "011") || hasCode(p.earnings, "020") ? "present" : "absent"),
    presentState: "normal",
    absentState: "info",
    presentMessage: "Ayuda de renta encontrada",
    absentMessage: "La ayuda de renta no aparece en esta quincena",
    caveat: "Su pago depende de tu categoría y de las disposiciones vigentes: la ausencia puede deberse a cambios en tu situación laboral.",
    helpHref: "/guia/conceptos/011",
    helpLabel: "Ver ayuda de renta",
  },
  {
    id: "estimulo-asistencia",
    code: "032",
    label: "Estímulo por asistencia",
    when: (p) => (hasCode(p.earnings, "032") ? "present" : "absent"),
    presentState: "normal",
    absentState: "info",
    presentMessage: "Estímulo por asistencia encontrado",
    absentMessage: "El concepto 032 no aparece en esta quincena",
    caveat: "Los estímulos se evalúan con la quincena de incidencia: faltas, retardos o licencias pueden modificar su pago sin que exista un error.",
    helpHref: "/guia/conceptos/032",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "estimulo-puntualidad",
    code: "033",
    label: "Estímulo por puntualidad",
    when: (p) => (hasCode(p.earnings, "033") ? "present" : "absent"),
    presentState: "normal",
    absentState: "info",
    presentMessage: "Estímulo por puntualidad encontrado",
    absentMessage: "El concepto 033 no aparece en esta quincena",
    caveat: "Esto no significa necesariamente que exista un error. Algunas incidencias o el periodo en que se genera el concepto pueden modificar cuándo aparece reflejado.",
    helpHref: "/guia/conceptos/033",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "isr",
    code: "151",
    label: "Impuesto sobre la renta (ISR)",
    when: (p) => (hasCode(p.deductions, "151") ? "present" : "absent"),
    presentState: "info",
    absentState: "info",
    presentMessage: "ISR retenido conforme a tus percepciones",
    absentMessage: "No se registró retención de ISR en esta quincena",
    caveat: "La retención depende del monto de tus percepciones gravadas del periodo.",
    helpHref: "/guia/conceptos/151",
    helpLabel: "Ver ISR",
  },
]

/** Regla generada por datos: líneas con confianza baja o sin confirmar. */
export function buildUnconfirmedRule(payslip: GuidePayslip): GuideReviewRule | null {
  const lines = [...payslip.earnings, ...payslip.deductions].filter(
    (l) => (l.confidence ?? 1) < 0.95 || l.confirmedByUser === false
  )
  if (lines.length === 0) return null
  return {
    id: "confianza",
    code: lines[0].code ?? "",
    label: "Conceptos por revisar",
    when: () => "present",
    presentState: "review",
    absentState: "info",
    presentMessage: `${lines.length} concepto(s) se detectaron con menor confianza`,
    absentMessage: "",
    caveat: "Conviene comparar el importe contra tu tarjetón original para confirmar que sea correcto.",
    helpHref: "/guia/conceptos",
    helpLabel: "Buscar un concepto",
  }
}
