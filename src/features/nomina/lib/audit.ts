import type { CalculatedPayrollConcept, PayrollProjection } from "./types"

const money = (v: number | undefined): string =>
  v === undefined ? "—" : `$${v.toFixed(2)}`

/**
 * Formatea la auditoría de resolución de UN concepto en el formato de
 * diagnóstico:
 *
 * ```
 * [055]
 * anchorValue:      $14,283.41
 * anchorPeriod:     dentro|fuera del periodo objetivo
 * targetPeriod:     2026-08-Q1 (01/2026 1ra quincena)
 * eligibleNow:      false
 * dependencies:     unchanged
 * formulaValue:     $0.00
 * selectedValue:    $14,283.41
 * selectedSource:   anchor
 * reason:           no_elegible_ahora
 * ```
 */
export function formatResolutionAudit(concept: CalculatedPayrollConcept): string {
  const a = concept.resolutionAudit
  if (!a) {
    return `[${concept.code}]\n(sin auditoría — el concepto no usó resolveWithAnchor)\nselectedSource: ${concept.source}\n`
  }
  const lines = [
    `[${a.conceptCode}]${a.ruleId && a.ruleId !== a.conceptCode ? ` (regla ${a.ruleId})` : ""}`,
    `anchorValue:      ${a.hadAnchor ? money(a.anchorValue) : "sin ancla"}`,
    `anchorDate:       ${a.anchorDate ?? "—"}`,
    `anchorInTargetPeriod: ${a.anchorInTargetPeriod ? "sí" : "no"}`,
    `targetPeriod:     ${a.targetPeriodId}${a.targetPeriodLabel ? ` (${a.targetPeriodLabel})` : ""}`,
    `eligibleNow:      ${a.eligibleNow}`,
    `dependencies:     ${a.dependencyStatus}`,
    `formulaComputable: ${a.formulaComputable}`,
    `formulaValue:     ${money(a.formulaValue)}`,
    `valuePersistence: ${a.valuePersistence}`,
    `selectedValue:    ${money(a.selectedValue)}`,
    `selectedSource:   ${a.selectedSource}`,
    `reason:           ${a.reason}`,
  ]
  return lines.join("\n")
}

/**
 * Reporte de auditoría de una proyección completa: un bloque por concepto con
 * auditoría de resolución. Pensado para logs, tests golden y depuración de
 * "cifras inexplicables": en un solo tarjetón se ve exactamente dónde inicia
 * la desviación.
 */
export function formatProjectionAudit(projection: PayrollProjection): string {
  const all = [
    ...projection.earnings,
    ...projection.probableConcepts,
    ...projection.conditionalConcepts,
    ...projection.excludedConcepts,
  ]
  const header = [
    `Auditoría de proyección — periodo ${projection.period.id}, modo ${projection.mode}`,
    `Confianza: ${projection.confidence}`,
    "".padEnd(60, "="),
  ].join("\n")
  const blocks = all.map(formatResolutionAudit).join("\n\n")
  return `${header}\n\n${blocks}\n`
}
