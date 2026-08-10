import { CALENDARIOS, EVENT_LABELS } from "@/shared/data/calendario"
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