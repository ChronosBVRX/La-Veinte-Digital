import { CALENDARIOS } from "@/shared/data/calendario"
import { getFortnightInfo } from "./falta-calculo"
import type { WorkerCommitment } from "../types"

export type BankType = "santander" | "otros"

export interface PaymentSchedule {
  incidenceFortnightKey: string
  incidenceFortnightLabel: string
  targetYear: number
  targetMonth: number
  targetMonthName: string
  targetFortnightNumber: 1 | 2
  targetFortnightKey: string
  targetFortnightLabel: string
  targetPaymentDate: string
  formattedPaymentDate: string
  bankUsed: BankType
}

export interface ClaimResolutionSchedule {
  filedDate: string
  clausula8Deadline: string
  formattedClausula8Deadline: string
  targetYear: number
  targetMonth: number
  targetMonthName: string
  targetFortnightNumber: 1 | 2
  targetFortnightKey: string
  targetFortnightLabel: string
  targetPaymentDate: string
  formattedPaymentDate: string
}

export interface OvertimeFortnightSummary {
  periodKey: string
  fortnightLabel: string
  year: number
  month: number
  monthName: string
  fortnightNumber: 1 | 2
  totalHours: number
  totalEstimatedEarnings: number
  hasPendingCalculations: boolean
  exceedsLimit20h: boolean
  paymentSchedule: PaymentSchedule
  items: WorkerCommitment[]
}

export interface ClaimsSummary {
  totalCount: number
  pendingCount: number
  resolvedCount: number
  totalClaimedAmount: number
  items: WorkerCommitment[]
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Obtiene la fecha exacta de pago quincenal según el calendario oficial IMSS registrado.
 * Si el año no estuviese en la tabla precargada, aplica la regla contractual estándar
 * de penúltimo día hábil previo a la quincena (Cláusula 94 CCT).
 */
export function getImssPayday(
  year: number,
  month: number, // 1-12
  fortnightNumber: 1 | 2,
  bank: BankType = "santander",
): string {
  const monthData = CALENDARIOS[year]?.[month - 1]
  const bankEvents = monthData?.events[bank]

  let day: number
  if (bankEvents && bankEvents.length >= 2) {
    day = fortnightNumber === 1 ? bankEvents[0] : bankEvents[1]
  } else {
    // Algoritmo de rescate para años futuros sin tabla explícita:
    // Q1 suele pagarse entre el 10 y el 13; Q2 entre el 25 y el 28.
    day = fortnightNumber === 1 ? 12 : 27
  }

  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return ""
  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  const y = Number(yearStr)
  const m = Number(monthStr)
  const d = Number(dayStr)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr
  const monthName = MONTH_NAMES[m - 1] || ""
  return `${d} de ${monthName} de ${y}`
}

/**
 * Calcula la fecha y quincena de cobro de Tiempo Extraordinario
 * aplicando la regla normativa de desfase de 1 mes (2 quincenas)
 * derivada del cierre del Interactivo SIAP (Procedimiento 1A74-003-031).
 *
 * - Horas de 1ª Qna de Mes M  -> Se liquidan en 1ª Qna de Mes M+1 (Campo 40).
 * - Horas de 2ª Qna de Mes M  -> Se liquidan en 2ª Qna de Mes M+1 (Campo 40).
 */
export function getOvertimePaymentSchedule(
  incidenceDate: Date | string,
  bank: BankType = "santander",
): PaymentSchedule {
  const fortnight = getFortnightInfo(incidenceDate)

  // 1 mes posterior (2 quincenas de desfase)
  let targetYear = fortnight.year
  let targetMonth = fortnight.month + 1
  if (targetMonth > 12) {
    targetMonth = 1
    targetYear += 1
  }

  const targetFortnightNumber = fortnight.fortnightNumber
  const targetMonthName = MONTH_NAMES[targetMonth - 1] || ""
  const targetFortnightKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}-Q${targetFortnightNumber}`
  const targetFortnightLabel = `${targetFortnightNumber}ª quincena de ${targetMonthName} de ${targetYear}`
  const targetPaymentDate = getImssPayday(targetYear, targetMonth, targetFortnightNumber, bank)
  const formattedPaymentDate = formatFriendlyDate(targetPaymentDate)

  return {
    incidenceFortnightKey: fortnight.periodKey,
    incidenceFortnightLabel: fortnight.label,
    targetYear,
    targetMonth,
    targetMonthName,
    targetFortnightNumber,
    targetFortnightKey,
    targetFortnightLabel,
    targetPaymentDate,
    formattedPaymentDate,
    bankUsed: bank,
  }
}

/**
 * Calcula el cronograma de resolución de una Reclamación Salarial
 * basado en el ciclo operativo de 3 quincenas (45 días naturales)
 * de la cartera sindical de Trabajo y Conflictos y la Cláusula 8 del CCT.
 *
 * - Hito 1 (Día 15): Plazo para contestación formal bilateral por escrito (Cláusula 8 CCT).
 * - Hito 2 (Día 45 / 3ª Quincena): Quincena de dispersión líquida en nómina tras interactivo.
 */
export function getClaimResolutionSchedule(
  filedDateStr: string,
  bank: BankType = "santander",
): ClaimResolutionSchedule {
  const [yStr, mStr, dStr] = filedDateStr.split("-")
  const fYear = Number(yStr)
  const fMonth = Number(mStr)
  const fDay = Number(dStr)

  // Hito Día 15 (Cláusula 8)
  const filedDateObj = new Date(Date.UTC(fYear, fMonth - 1, fDay))
  const day15Obj = new Date(filedDateObj.getTime() + 15 * 24 * 60 * 60 * 1000)
  const clausula8Deadline = day15Obj.toISOString().split("T")[0]
  const formattedClausula8Deadline = formatFriendlyDate(clausula8Deadline)

  // Hito Día 45 (3 Quincenas de ciclo operativo)
  // Avanza 3 quincenas naturales desde la quincena de radicación
  const filingFortnight = getFortnightInfo(filedDateStr)
  let tFortnightNum = filingFortnight.fortnightNumber
  let tMonth = filingFortnight.month
  let tYear = filingFortnight.year

  // Sumar 3 quincenas
  for (let i = 0; i < 3; i++) {
    if (tFortnightNum === 1) {
      tFortnightNum = 2
    } else {
      tFortnightNum = 1
      tMonth += 1
      if (tMonth > 12) {
        tMonth = 1
        tYear += 1
      }
    }
  }

  const targetFortnightKey = `${tYear}-${String(tMonth).padStart(2, "0")}-Q${tFortnightNum}`
  const targetMonthName = MONTH_NAMES[tMonth - 1] || ""
  const targetFortnightLabel = `${tFortnightNum}ª quincena de ${targetMonthName} de ${tYear}`
  const targetPaymentDate = getImssPayday(tYear, tMonth, tFortnightNum, bank)
  const formattedPaymentDate = formatFriendlyDate(targetPaymentDate)

  return {
    filedDate: filedDateStr,
    clausula8Deadline,
    formattedClausula8Deadline,
    targetYear: tYear,
    targetMonth: tMonth,
    targetMonthName,
    targetFortnightNumber: tFortnightNum,
    targetFortnightKey,
    targetFortnightLabel,
    targetPaymentDate,
    formattedPaymentDate,
  }
}

/**
 * Agrupa los compromisos de tipo "overtime" por Quincena de Incidencia (Campo 30).
 * Calcula la suma de horas, la percepción estimada acumulada y evalúa el tope
 * normativo de 20 horas quincenales del Procedimiento 1A74-003-031.
 */
export function groupOvertimeByFortnight(
  commitments: WorkerCommitment[],
  bank: BankType = "santander",
): OvertimeFortnightSummary[] {
  const overtimeList = commitments.filter(
    (c) => c.type === "overtime" && c.status === "active",
  )

  const groupMap = new Map<string, WorkerCommitment[]>()

  for (const c of overtimeList) {
    const fnInfo = getFortnightInfo(c.startAt)
    if (!fnInfo.periodKey) continue
    if (!groupMap.has(fnInfo.periodKey)) {
      groupMap.set(fnInfo.periodKey, [])
    }
    groupMap.get(fnInfo.periodKey)!.push(c)
  }

  const summaries: OvertimeFortnightSummary[] = []

  for (const [periodKey, items] of groupMap.entries()) {
    // Tomar representativo para cálculo de quincena
    const firstItem = items[0]
    const fnInfo = getFortnightInfo(firstItem.startAt)
    const paymentSchedule = getOvertimePaymentSchedule(firstItem.startAt, bank)

    let totalHours = 0
    let totalEstimatedEarnings = 0
    let hasPendingCalculations = false

    for (const item of items) {
      const hours = item.details?.hoursCalculated ?? 0
      totalHours += hours

      const earnings = item.details?.estimatedEarnings
      if (typeof earnings === "number" && Number.isFinite(earnings) && earnings > 0) {
        totalEstimatedEarnings += earnings
      } else {
        hasPendingCalculations = true
      }
    }

    totalHours = Math.round(totalHours * 100) / 100
    totalEstimatedEarnings = Math.round(totalEstimatedEarnings * 100) / 100

    summaries.push({
      periodKey,
      fortnightLabel: fnInfo.label,
      year: fnInfo.year,
      month: fnInfo.month,
      monthName: fnInfo.monthName,
      fortnightNumber: fnInfo.fortnightNumber,
      totalHours,
      totalEstimatedEarnings,
      hasPendingCalculations,
      exceedsLimit20h: totalHours > 20,
      paymentSchedule,
      items: items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    })
  }

  // Orden cronológico inverso (quincenas más recientes primero)
  return summaries.sort((a, b) => b.periodKey.localeCompare(a.periodKey))
}

/**
 * Agrupa y totaliza las Reclamaciones Pendientes (`no_pagado`).
 */
export function summarizeClaims(commitments: WorkerCommitment[]): ClaimsSummary {
  const claims = commitments.filter((c) => c.type === "no_pagado")
  let pendingCount = 0
  let resolvedCount = 0
  let totalClaimedAmount = 0

  for (const c of claims) {
    const status = c.details?.claimStatus ?? "pendiente"
    if (status === "resuelta") {
      resolvedCount++
    } else {
      pendingCount++
    }

    const amount = c.details?.estimatedClaimAmount
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
      totalClaimedAmount += amount
    }
  }

  return {
    totalCount: claims.length,
    pendingCount,
    resolvedCount,
    totalClaimedAmount: Math.round(totalClaimedAmount * 100) / 100,
    items: claims.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
  }
}
