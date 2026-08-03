import type { ParsedImssTarjeton, TarjetonConceptLine } from "@/shared/contracts/tarjeton-import"

/** Línea de concepto editable durante la revisión. */
export interface ReviewedConceptLine {
  lineIndex: number
  code: string
  description: string
  amount: number
  kind: "earning" | "deduction"
  confidence: number
  /** true solo si el trabajador la confirmó explícitamente (o era confiable). */
  confirmedByUser: boolean
  /** true si el trabajador la eliminó por ser un falso positivo del OCR. */
  deleted?: boolean
}

/**
 * Aplica las ediciones de revisión al tarjetón:
 * - Descarta líneas eliminadas.
 * - Conserva el código, descripción e importe editados por el trabajador.
 * - Conserva `confirmedByUser` tal como la marcó la revisión (el RPC solo
 *   promueve a conceptos recurrentes lo que el trabajador confirmó).
 * Devuelve una copia; nunca muta el original.
 */
export function applyConceptEdits(
  parsed: ParsedImssTarjeton,
  lines: ReviewedConceptLine[],
): ParsedImssTarjeton {
  const apply = (kind: "earning" | "deduction") =>
    lines
      .filter((line) => line.kind === kind && line.deleted !== true)
      .map((line): TarjetonConceptLine => ({
        lineIndex: line.lineIndex,
        code: line.code,
        description: line.description,
        amount: line.amount,
        kind: line.kind,
        confidence: line.confidence,
        confirmedByUser: line.confirmedByUser,
      }))

  return {
    ...parsed,
    payroll: {
      ...parsed.payroll,
      earnings: apply("earning"),
      deductions: apply("deduction"),
    },
  }
}

/**
 * Umbral de confianza a partir del cual una línea NO necesita confirmación
 * explícita (los importes son datos críticos: 0.95).
 */
export const AUTO_CONFIRM_THRESHOLD = 0.95

export function needsExplicitConfirmation(confidence: number): boolean {
  return confidence < AUTO_CONFIRM_THRESHOLD
}

export function updateReviewedConcept(
  lines: ReviewedConceptLine[],
  identity: Pick<ReviewedConceptLine, "kind" | "lineIndex">,
  patch: Partial<ReviewedConceptLine>,
): ReviewedConceptLine[] {
  return lines.map((line) => (
    line.kind === identity.kind && line.lineIndex === identity.lineIndex
      ? { ...line, ...patch }
      : line
  ))
}
