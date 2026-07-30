import type { PayPeriod } from "./types"

export function getCurrentPayPeriod(date: string): PayPeriod {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const half: 1 | 2 = day <= 15 ? 1 : 2
  return getPayPeriod(year, month, half)
}

export function getNextPayPeriod(date: string): PayPeriod {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const half: 1 | 2 = day <= 15 ? 1 : 2

  if (half === 1) {
    return getPayPeriod(year, month, 2)
  }
  if (month === 12) {
    return getPayPeriod(year + 1, 1, 1)
  }
  return getPayPeriod(year, month + 1, 1)
}

export function getPayPeriod(year: number, month: number, half: 1 | 2): PayPeriod {
  const startDay = half === 1 ? 1 : 16
  const endDay = half === 1 ? 15 : lastDayOfMonth(year, month)

  const startDate = formatDate(year, month, startDay)
  const endDate = formatDate(year, month, endDay)
  const label = `${padMonth(month)}/${year} ${half === 1 ? "1ra" : "2da"} quincena`

  return {
    id: `${year}-${padMonth(month)}-Q${half}`,
    year,
    month,
    half,
    startDate,
    endDate,
    label,
  }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${padMonth(month)}-${String(day).padStart(2, "0")}`
}

function padMonth(m: number): string {
  return String(m).padStart(2, "0")
}
