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

export const CALENDARIO_2026: MonthData[] = [
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
]

export function getMonthData(monthIndex: number): MonthData | undefined {
  return CALENDARIO_2026[monthIndex]
}

export function getDayEvents(monthIndex: number, day: number): CalendarEvent[] {
  const monthData = CALENDARIO_2026[monthIndex]
  if (!monthData) return []
  const result: CalendarEvent[] = []
  for (const [type, days] of Object.entries(monthData.events)) {
    if (days.includes(day)) {
      result.push({ type: type as CalendarEventType, label: EVENT_LABELS[type as CalendarEventType] })
    }
  }
  return result
}
