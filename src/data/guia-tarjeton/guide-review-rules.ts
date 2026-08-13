// Reglas de "Revisa tu quincena" (Guía de mi Tarjetón).
// Solo se crean reglas con fundamento suficiente; nunca se afirma un error.
// Las clasificaciones de recurrencia siguen la lógica de la app
// (payslip-sync: recurrentes {002, 011, 020, 050, 023, 063}).

export type GuideReviewState = "ok" | "info" | "review" | "not_evaluable"

export type GuideReviewRuleKind = "perception" | "deduction"

export interface GuideReviewRule {
  code: string
  name: string
  kind: GuideReviewRuleKind
  expected: "always" | "recurring" | "when_previous"
  reason: string
}

// Conceptos que deberían estar presentes en toda quincena activa.
export const GUIDE_REVIEW_EXPECTED: GuideReviewRule[] = [
  { code: "002", name: "Sueldo base", kind: "perception", expected: "always", reason: "Es el pago base de tu quincena y debe aparecer en todo tarjetón activo." },
  { code: "011", name: "Ayuda de renta", kind: "perception", expected: "recurring", reason: "Es una percepción recurrente cuando la cláusula de renta aplica." },
  { code: "020", name: "Ayuda de renta (fija)", kind: "perception", expected: "recurring", reason: "Es una percepción recurrente con importe fijo cuando aplica." },
  { code: "050", name: "Ayuda para despensa", kind: "perception", expected: "recurring", reason: "Es una percepción recurrente con importe fijo cuando aplica." },
  { code: "023", name: "Complemento base", kind: "perception", expected: "recurring", reason: "La app lo clasifica como concepto recurrente." },
  { code: "063", name: "Emanaciones radioactivas", kind: "perception", expected: "recurring", reason: "La app lo clasifica como concepto recurrente." },
  { code: "151", name: "ISR", kind: "deduction", expected: "recurring", reason: "La retención de impuesto es un descuento habitual cuando se genera impuesto." },
]

export interface GuideReviewExplanation {
  text: string
}

// Texto usado cuando un concepto esperado no aparece (informativo, no acusatorio).
export const GUIDE_REVIEW_MISSING_EXPLANATION: GuideReviewExplanation = {
  text: "Esto no significa necesariamente que exista un error. Algunas incidencias o el periodo en que se genera el concepto pueden modificar cuándo aparece reflejado.",
}

export const GUIDE_REVIEW_INTRO: GuideReviewExplanation = {
  text: "Esto no necesariamente representa un error. Revisa las condiciones de generación del concepto y la quincena de incidencia.",
}