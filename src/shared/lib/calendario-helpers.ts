import { CALENDARIOS, EVENT_LABELS, getMandatoryRestDayByDate } from "@/shared/data/calendario"
import type { CalendarEventType } from "@/shared/data/calendario"

export const SHIFT_LABELS: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  nocturno: "Nocturno",
  jornada_acumulada: "Jornada Acumulada",
  mixto: "Mixto",
}

export const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

export function getNextPaymentDay(
  year: number,
  monthIndex: number,
  day: number,
  types?: CalendarEventType[],
): { date: Date; label: string } | null {
  const filterTypes = types ?? ["santander", "otros", "cheque", "jubilados"]
  const yearData = CALENDARIOS[year]
  if (!yearData) return null
  const now = new Date(year, monthIndex, day)
  const candidates: { date: Date; label: string }[] = []
  for (let mi = 0; mi < yearData.length; mi++) {
    const m = yearData[mi]
    for (const type of filterTypes) {
      const days = m.events[type]
      if (!days) continue
      for (const d of days) {
        const candidate = new Date(year, mi, d)
        if (candidate >= now) candidates.push({ date: candidate, label: EVENT_LABELS[type] })
      }
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates[0]
}

export function isInteractivoOpen(year: number, monthIndex: number, day: number): boolean {
  const yearData = CALENDARIOS[year]
  if (!yearData) return false
  return yearData[monthIndex]?.events.interactivo?.includes(day) ?? false
}

export function getNextNonInteractiveDay(
  year: number,
  monthIndex: number,
  day: number,
): { date: Date } | null {
  const checkDate = new Date(year, monthIndex, day + 1)
  for (let i = 0; i < 90; i++) {
    const y = checkDate.getFullYear()
    const m = checkDate.getMonth()
    const d = checkDate.getDate()
    const yearData = CALENDARIOS[y]
    if (yearData) {
      const interactiveDays = yearData[m]?.events.interactivo
      if (!interactiveDays?.includes(d)) {
        return { date: new Date(y, m, d) }
      }
    }
    checkDate.setDate(checkDate.getDate() + 1)
  }
  return null
}

function formatLocalIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * Día hábil para trámites: de lunes a viernes y sin descanso obligatorio del
 * CCT (Cláusula 46-III). Sábado y domingo nunca cuentan como hábiles.
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) return false
  return !getMandatoryRestDayByDate(formatLocalIso(date))
}

/**
 * Primer día posterior a la fecha dada en el que realmente se pueden hacer
 * trámites: día hábil y fuera del periodo interactivo.
 */
export function getNextTramiteDay(
  year: number,
  monthIndex: number,
  day: number,
): { date: Date } | null {
  const checkDate = new Date(year, monthIndex, day + 1)
  for (let i = 0; i < 120; i++) {
    const y = checkDate.getFullYear()
    const m = checkDate.getMonth()
    const d = checkDate.getDate()
    if (isBusinessDay(checkDate) && !isInteractivoOpen(y, m, d)) {
      return { date: new Date(checkDate) }
    }
    checkDate.setDate(checkDate.getDate() + 1)
  }
  return null
}

export type InteractivoNoticeKind = "interactive" | "non-business" | "free"

export interface InteractivoNotice {
  kind: InteractivoNoticeKind
  /** "es fin de semana" o "es día de descanso obligatorio" (solo non-business). */
  reason?: string
  /** Fecha legible del siguiente día en que se pueden hacer trámites. */
  nextTramiteLabel?: string
}

/**
 * Estado del aviso de "Periodo interactivo" en la portada.
 *
 * Sábado y domingo (y los descansos obligatorios) NUNCA cuentan como días
 * hábiles: si hoy no es hábil y no estamos en interactivo, se informa el
 * siguiente día en que sí se pueden hacer trámites.
 */
export function getInteractivoNotice(now: Date, interactiveOpen: boolean): InteractivoNotice {
  if (interactiveOpen) return { kind: "interactive" }
  if (isBusinessDay(now)) return { kind: "free" }

  const next = getNextTramiteDay(now.getFullYear(), now.getMonth(), now.getDate())
  if (!next) return { kind: "free" }

  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  return {
    kind: "non-business",
    reason: isWeekend ? "es fin de semana" : "es día de descanso obligatorio",
    nextTramiteLabel: next.date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  }
}

export function getNextVacationStart(
  year: number,
  monthIndex: number,
  day: number,
): { date: Date } | null {
  const yearData = CALENDARIOS[year]
  if (!yearData) return null
  const now = new Date(year, monthIndex, day)
  const candidates: Date[] = []
  for (let mi = 0; mi < yearData.length; mi++) {
    const m = yearData[mi]
    const days = m.events.vacacional
    if (!days) continue
    for (const d of days) {
      const candidate = new Date(year, mi, d)
      if (candidate >= now) candidates.push(candidate)
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { date: candidates[0] }
}

export function getBiweekEnd(): string {
  const now = new Date()
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (day <= 15) return `${year}-${String(month + 1).padStart(2, "0")}-15`
  const lastDay = new Date(year, month + 1, 0).getDate()
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}