export type { CalendarEventType, CalendarEvent, MonthData, ImssMandatoryRestDay, ImssRestDaysOptions, ElectoralHolidayEntry } from "@/shared/data/calendario"
export {
  EVENT_COLORS,
  EVENT_LABELS,
  CALENDARIOS,
  getMonthData,
  getDayEvents,
  getImssMandatoryRestDays,
  getImssMandatoryRestDaysForMonth,
  getMandatoryRestDayByDate,
} from "@/shared/data/calendario"
import { CALENDARIOS, EVENT_LABELS, getImssMandatoryRestDaysForMonth } from "@/shared/data/calendario"
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

export function hasCalendar(year: number): boolean {
  return CALENDARIOS[year] !== undefined
}

export function isValidMonthIndex(monthIndex: number): boolean {
  return Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11
}

// DTSTAMP/UID estables por evento: el UID no debe cambiar entre descargas.
function eventUid(year: number, mi: number, day: number, type: CalendarEventType, end?: number): string {
  const suffix = end !== undefined ? `${pad(day)}-${pad(end)}` : pad(day)
  return `imss-${year}-${pad(mi + 1)}-${suffix}-${type}@laveinte-digital`
}

function dtStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function generateICS(year: number, monthIndex?: number): string {
  if (!hasCalendar(year)) return ""

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
    if (!isValidMonthIndex(mi)) continue
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
          lines.push(`UID:${eventUid(year, mi, s, type, e)}`)
          lines.push(`DTSTAMP:${dtStamp()}`)
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
          lines.push(`UID:${eventUid(year, mi, day, type)}`)
          lines.push(`DTSTAMP:${dtStamp()}`)
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
