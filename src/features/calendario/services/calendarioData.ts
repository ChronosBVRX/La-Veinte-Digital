export type { CalendarEventType, CalendarEvent, MonthData } from "@/shared/data/calendario"
export { EVENT_COLORS, EVENT_LABELS, CALENDARIOS, getMonthData, getDayEvents } from "@/shared/data/calendario"
import { CALENDARIOS, EVENT_LABELS } from "@/shared/data/calendario"
import type { CalendarEventType } from "@/shared/data/calendario"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function nextDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day))
  date.setUTCDate(date.getUTCDate() + 1)
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
}

function getRanges(days: number[]): [number, number][] {
  const sorted = [...days].sort((a, b) => a - b)
  const ranges: [number, number][] = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push([start, end])
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push([start, end])
  return ranges
}

export function generateICS(year: number, monthIndex?: number): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Veinte Digital//Calendario IMSS//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  const months = monthIndex !== undefined ? [monthIndex] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const yearData = CALENDARIOS[year]
  if (!yearData) return ""

  const eventTypes: CalendarEventType[] = ["interactivo", "vacacional", "santander", "otros", "cheque", "jubilados"]

  for (const mi of months) {
    const monthData = yearData[mi]
    if (!monthData) continue

    for (const type of eventTypes) {
      const days = monthData.events[type]
      if (!days || days.length === 0) continue

      if (type === "interactivo") {
        const ranges = getRanges(days)
        for (const [s, e] of ranges) {
          const dtStart = `${year}${pad(mi + 1)}${pad(s)}`
          const dtEnd = nextDate(year, mi, e)
          lines.push("BEGIN:VEVENT")
          lines.push(`DTSTART;VALUE=DATE:${dtStart}`)
          lines.push(`DTEND;VALUE=DATE:${dtEnd}`)
          lines.push(`SUMMARY:${EVENT_LABELS[type]}`)
          lines.push("END:VEVENT")
        }
      } else {
        for (const day of days) {
          const dtStart = `${year}${pad(mi + 1)}${pad(day)}`
          const dtEnd = nextDate(year, mi, day)
          lines.push("BEGIN:VEVENT")
          lines.push(`DTSTART;VALUE=DATE:${dtStart}`)
          lines.push(`DTEND;VALUE=DATE:${dtEnd}`)
          lines.push(`SUMMARY:${EVENT_LABELS[type]}`)
          lines.push("END:VEVENT")
        }
      }
    }
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}
