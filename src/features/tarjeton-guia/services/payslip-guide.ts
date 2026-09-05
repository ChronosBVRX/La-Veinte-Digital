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

  // Period label
  let periodLabel: string | undefined
  if (typeof p.period === "string") {
    periodLabel = p.period
  } else if (p.period && typeof p.period === "object") {
    const periodObj = p.period as Record<string, unknown>
    periodLabel =
      (typeof periodObj.label === "string" ? periodObj.label : undefined) ??
      (typeof periodObj.id === "string" ? periodObj.id : undefined)
  }
  if (!periodLabel && typeof p.periodLabel === "string") {
    periodLabel = p.periodLabel
  }
  if (!periodLabel && typeof p.periodRaw === "string") {
    periodLabel = p.periodRaw
  }

  // Earnings/Perceptions source
  const parsedData = (p.parsed_data && typeof p.parsed_data === "object" ? p.parsed_data : {}) as Record<string, unknown>
  const rawPayload = (p.raw_payload && typeof p.raw_payload === "object" ? p.raw_payload : {}) as Record<string, unknown>

  let earningsRaw =
    p.earnings ??
    p.perceptions ??
    p.percepciones ??
    parsedData.earnings ??
    parsedData.perceptions ??
    rawPayload.earnings ??
    rawPayload.perceptions
  let deductionsRaw =
    p.deductions ??
    p.deducciones ??
    parsedData.deductions ??
    parsedData.deducciones ??
    rawPayload.deductions ??
    rawPayload.deducciones

  const allConcepts = p.concepts ?? parsedData.concepts ?? rawPayload.concepts

  if (!Array.isArray(earningsRaw) && !Array.isArray(deductionsRaw) && Array.isArray(allConcepts)) {
    earningsRaw = (allConcepts as Array<Record<string, unknown>>).filter((c) => {
      const k = String(c?.kind ?? c?.tipo ?? "").toLowerCase()
      return !k.includes("deduc")
    })
    deductionsRaw = (allConcepts as Array<Record<string, unknown>>).filter((c) => {
      const k = String(c?.kind ?? c?.tipo ?? "").toLowerCase()
      return k.includes("deduc")
    })
  }

  if (!Array.isArray(earningsRaw) && !Array.isArray(deductionsRaw)) {
    if (!p.id && !periodLabel && !isNumber(p.netPay) && !isNumber(p.netAmount)) {
      return null
    }
  }

  const earnings: GuidePayslipLine[] = []
  const deductions: GuidePayslipLine[] = []

  if (Array.isArray(earningsRaw)) {
    for (const e of earningsRaw) {
      const rawKind = String(
        (e as Record<string, unknown>)?.kind ?? (e as Record<string, unknown>)?.tipo ?? ""
      ).toLowerCase()
      const kind = rawKind.includes("deduc") ? "deduction" : "earning"
      const line = toGuideLine(e, kind)
      if (line) {
        if (line.kind === "deduction") deductions.push(line)
        else earnings.push(line)
      }
    }
  }

  if (Array.isArray(deductionsRaw)) {
    for (const d of deductionsRaw) {
      const line = toGuideLine(d, "deduction")
      if (line) deductions.push(line)
    }
  }

  const totalEarnings = isNumber(p.totalEarnings)
    ? p.totalEarnings
    : isNumber(p.total_percepciones)
    ? (p.total_percepciones as number)
    : undefined

  const totalDeductions = isNumber(p.totalDeductions)
    ? p.totalDeductions
    : isNumber(p.total_deducciones)
    ? (p.total_deducciones as number)
    : undefined

  const netPay = isNumber(p.netPay)
    ? p.netPay
    : isNumber(p.netAmount)
    ? (p.netAmount as number)
    : isNumber(p.liquido)
    ? (p.liquido as number)
    : undefined

  return {
    id: typeof p.id === "string" ? p.id : "",
    periodRaw: typeof p.periodRaw === "string" ? p.periodRaw : periodLabel,
    periodLabel,
    createdAt:
      typeof p.generatedAt === "string"
        ? p.generatedAt
        : typeof p.created_at === "string"
        ? p.created_at
        : undefined,
    earnings,
    deductions,
    perceptions: earnings,
    observations: [],
    totalEarnings,
    totalDeductions,
    netPay,
    netAmount: netPay,
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
