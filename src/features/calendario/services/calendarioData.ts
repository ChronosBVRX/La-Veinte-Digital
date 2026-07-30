export type CalendarEventType = 'interactivo' | 'vacacional' | 'santander' | 'otros' | 'cheque' | 'jubilados'

export interface CalendarEvent {
  type: CalendarEventType
  label: string
}

export const EVENT_COLORS: Record<CalendarEventType, string> = {
  interactivo: '#eab308',
  vacacional: '#22c55e',
  santander: '#ef4444',
  otros: '#3b82f6',
  cheque: '#a855f7',
  jubilados: '#f97316',
}

export const EVENT_LABELS: Record<CalendarEventType, string> = {
  interactivo: 'Periodo de interactivo',
  vacacional: 'Inicio de periodo vacacional',
  santander: 'Pago Santander y Scotiabank',
  otros: 'Pago Banamex, Banorte, BBVA y demás bancos',
  cheque: 'Pago con cheque',
  jubilados: 'Pago a jubilados',
}

interface MonthData {
  month: string
  events: Partial<Record<CalendarEventType, number[]>>
}

export const CALENDARIOS: Record<number, MonthData[]> = {
  2026: [
    {
      month: 'Enero',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [16, 30],
        santander: [12, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Febrero',
      events: {
        interactivo: [3, 4, 5, 6, 17, 18, 19, 20],
        vacacional: [16],
        santander: [10, 24],
        otros: [11, 25],
        cheque: [12, 26],
        jubilados: [28],
      },
    },
    {
      month: 'Marzo',
      events: {
        interactivo: [2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [2, 19],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 27],
        jubilados: [31],
      },
    },
    {
      month: 'Abril',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [6, 22],
        santander: [10, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Mayo',
      events: {
        interactivo: [4, 5, 6, 7],
        vacacional: [7, 25],
        santander: [12, 26],
        otros: [13, 27],
        cheque: [14, 28],
        jubilados: [30],
      },
    },
    {
      month: 'Junio',
      events: {
        interactivo: [1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [8, 22],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Julio',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [6, 20],
        santander: [10, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Agosto',
      events: {
        interactivo: [3, 4, 5, 6, 7, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [3, 20],
        santander: [11, 25],
        otros: [12, 26],
        cheque: [13, 27],
        jubilados: [31],
      },
    },
    {
      month: 'Septiembre',
      events: {
        interactivo: [1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [3, 21],
        santander: [9, 25],
        otros: [10, 28],
        cheque: [11, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Octubre',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [5, 19],
        santander: [12, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Noviembre',
      events: {
        interactivo: [2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [2, 17],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 27],
        jubilados: [30],
      },
    },
    {
      month: 'Diciembre',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7],
        vacacional: [1, 15, 30],
        santander: [10, 24],
        otros: [11, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
  ],
  2027: [
    {
      month: 'Enero',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [16, 30],
        santander: [12, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Febrero',
      events: {
        interactivo: [3, 4, 5, 6, 17, 18, 19, 20],
        vacacional: [16],
        santander: [10, 24],
        otros: [11, 25],
        cheque: [12, 26],
        jubilados: [28],
      },
    },
    {
      month: 'Marzo',
      events: {
        interactivo: [2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [2, 19],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 27],
        jubilados: [31],
      },
    },
    {
      month: 'Abril',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [6, 22],
        santander: [10, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Mayo',
      events: {
        interactivo: [4, 5, 6, 7],
        vacacional: [7, 25],
        santander: [12, 26],
        otros: [13, 27],
        cheque: [14, 28],
        jubilados: [30],
      },
    },
    {
      month: 'Junio',
      events: {
        interactivo: [1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [8, 22],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Julio',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [6, 20],
        santander: [10, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Agosto',
      events: {
        interactivo: [3, 4, 5, 6, 7, 18, 19, 20, 21, 22, 23, 24],
        vacacional: [3, 20],
        santander: [11, 25],
        otros: [12, 26],
        cheque: [13, 27],
        jubilados: [31],
      },
    },
    {
      month: 'Septiembre',
      events: {
        interactivo: [1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [3, 21],
        santander: [9, 25],
        otros: [10, 28],
        cheque: [11, 29],
        jubilados: [30],
      },
    },
    {
      month: 'Octubre',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [5, 19],
        santander: [12, 27],
        otros: [13, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
    {
      month: 'Noviembre',
      events: {
        interactivo: [2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23],
        vacacional: [2, 17],
        santander: [10, 25],
        otros: [11, 26],
        cheque: [12, 27],
        jubilados: [30],
      },
    },
    {
      month: 'Diciembre',
      events: {
        interactivo: [1, 2, 3, 4, 5, 6, 7],
        vacacional: [1, 15, 30],
        santander: [10, 24],
        otros: [11, 28],
        cheque: [14, 29],
        jubilados: [31],
      },
    },
  ],
}

export function getMonthData(year: number, monthIndex: number): MonthData | undefined {
  return CALENDARIOS[year]?.[monthIndex]
}

export function getDayEvents(year: number, monthIndex: number, day: number): CalendarEvent[] {
  const monthData = CALENDARIOS[year]?.[monthIndex]
  if (!monthData) return []
  const result: CalendarEvent[] = []
  for (const [type, days] of Object.entries(monthData.events)) {
    if (days.includes(day)) {
      result.push({ type: type as CalendarEventType, label: EVENT_LABELS[type as CalendarEventType] })
    }
  }
  return result
}

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
