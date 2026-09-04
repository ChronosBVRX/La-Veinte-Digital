/**
 * Adaptador de tarjetones para la Guía de mi Tarjetón.
 *
 * Convierte tarjetones de las fuentes existentes (localStorage vía
 * `@/shared/services/local-storage` y filas del servidor de
 * `imported_payslips`/`imported_payslip_lines`) al tipo desacoplado
 * `GuidePayslip` del módulo educativo.
 */
import type { GuidePayslip, GuidePayslipLine, GuideObservation } from "@/features/tarjeton-guia/lib/types"
import { normalizePayslipConcept } from "@/shared/contracts/payslip-concept"

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function toGuideLine(raw: unknown, kind: "earning" | "deduction"): GuidePayslipLine | null {
  return normalizePayslipConcept(raw, kind)
}

/**
 * Convierte un tarjetón de localStorage (una entrada de `getPayslips()`) a
 * `GuidePayslip`. Devuelve null si no pasa una validación estructural mínima.
 */
export function toGuidePayslip(raw: unknown): GuidePayslip | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>

  const period = (p.period ?? {}) as Record<string, unknown>
  const label = typeof period.label === "string" ? period.label : undefined

  const earningsRaw = p.earnings
  const deductionsRaw = p.deductions

  if (!Array.isArray(earningsRaw) || !Array.isArray(deductionsRaw)) return null

  const earnings: GuidePayslipLine[] = []
  const deductions: GuidePayslipLine[] = []
  for (const e of earningsRaw) {
    const rawKind = String((e as Record<string, unknown>)?.kind ?? "").toLowerCase()
    const kind = rawKind.includes("deduc") ? "deduction" : "earning"
    const line = toGuideLine(e, kind)
    if (line) {
      if (line.kind === "deduction") deductions.push(line)
      else earnings.push(line)
    }
  }
  for (const d of deductionsRaw) {
    const line = toGuideLine(d, "deduction")
    if (line) deductions.push(line)
  }

  return {
    id: typeof p.id === "string" ? p.id : "",
    periodLabel: label,
    createdAt: typeof p.generatedAt === "string" ? p.generatedAt : undefined,
    earnings,
    deductions,
    observations: [],
    totalEarnings: isNumber(p.totalEarnings) ? p.totalEarnings : undefined,
    totalDeductions: isNumber(p.totalDeductions) ? p.totalDeductions : undefined,
    netPay: isNumber(p.netPay) ? p.netPay : undefined,
    source: "local",
  }
}

/**
 * Convierte una fila de `imported_payslips` + `imported_payslip_lines` +
 * `imported_payslip_observations` a `GuidePayslip`.
 */
export function dbRowToGuidePayslip(
  row: Record<string, unknown> | null | undefined,
  lines: Array<Record<string, unknown>> = [],
  observations: Array<Record<string, unknown>> = []
): GuidePayslip | null {
  if (!row) return null

  const payrollTotals = (row.payroll_totals ?? {}) as Record<string, unknown>

  const periodMonth = isNumber(row.period_month) ? row.period_month : undefined
  const periodYear = isNumber(row.period_year) ? row.period_year : undefined
  const periodHalf = row.period_half === 2 ? 2 : 1
  const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

  const earnings: GuidePayslipLine[] = []
  const deductions: GuidePayslipLine[] = []
  for (const line of lines) {
    const rawKind = String(line.kind ?? line.tipo ?? "").toLowerCase()
    const fallbackKind = rawKind.includes("deduc") ? "deduction" : "earning"
    const cl = toGuideLine(line, fallbackKind)
    if (!cl) continue
    if (cl.kind === "deduction") deductions.push(cl)
    else earnings.push(cl)
  }

  const observationsOut: GuideObservation[] = []
  for (const o of observations) {
    observationsOut.push({
      conceptCode: typeof o.concept_code === "string" ? o.concept_code : String(o.concept_code ?? ""),
      amount: isNumber(o.amount) ? o.amount : undefined,
      duePeriod: typeof o.due_period === "string" ? o.due_period : undefined,
      units: isNumber(o.units) ? o.units : undefined,
      controlNumber: typeof o.control_number === "string" ? o.control_number : undefined,
      initialCharge: isNumber(o.initial_charge) ? o.initial_charge : undefined,
      notes: typeof o.notes === "string" ? o.notes : undefined,
    })
  }

  const periodLabel =
    typeof row.period_raw === "string" && row.period_raw.length > 0
      ? row.period_raw
      : periodYear && periodMonth
      ? `${MONTHS[periodMonth - 1]} ${periodHalf}ª ${periodYear}`
      : undefined

  const totalEarnings = isNumber(payrollTotals.totalEarnings)
    ? payrollTotals.totalEarnings
    : isNumber(payrollTotals.total_earnings)
    ? payrollTotals.total_earnings
    : isNumber(row.total_percepciones)
    ? (row.total_percepciones as number)
    : undefined

  const totalDeductions = isNumber(payrollTotals.totalDeductions)
    ? payrollTotals.totalDeductions
    : isNumber(payrollTotals.total_deductions)
    ? payrollTotals.total_deductions
    : isNumber(row.total_deducciones)
    ? (row.total_deducciones as number)
    : undefined

  const netPay = isNumber(payrollTotals.netPay)
    ? payrollTotals.netPay
    : isNumber(payrollTotals.net_pay)
    ? payrollTotals.net_pay
    : isNumber(row.liquido)
    ? (row.liquido as number)
    : undefined

  return {
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    periodRaw: typeof row.period_raw === "string" ? row.period_raw : undefined,
    periodLabel,
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    earnings,
    deductions,
    observations: observationsOut,
    totalEarnings,
    totalDeductions,
    netPay,
    source: "server",
  }
}
