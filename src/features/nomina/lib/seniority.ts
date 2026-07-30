import type { SeniorityResult } from "./types"

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number)
  return { year: y, month: m, day: d }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function calculateSeniority(
  effectiveDate: string,
  referenceDate: string
): SeniorityResult {
  const start = parseDate(effectiveDate)
  const end = parseDate(referenceDate)
  const warnings: string[] = []

  if (!start.year || !end.year) {
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      referenceDate, source: "confirmed_effective_date",
      warnings: ["Fecha invalida"],
    }
  }

  const startDate = new Date(start.year, start.month - 1, start.day)
  const endDate = new Date(end.year, end.month - 1, end.day)

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      referenceDate, source: "confirmed_effective_date",
      warnings: ["Fecha invalida"],
    }
  }

  if (startDate > endDate) {
    warnings.push("La fecha efectiva es posterior a la fecha de referencia")
  }

  let years = end.year - start.year
  let months = end.month - start.month
  let days = end.day - start.day

  if (days < 0) {
    months--
    days += daysInMonth(end.year, end.month - 1)
  }
  if (months < 0) {
    years--
    months += 12
  }

  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  return { years, months, days, totalDays, referenceDate, source: "confirmed_effective_date", warnings }
}

export function reconstructEffectiveDate(
  displayedSeniority: { years: number; months: number; days: number },
  payslipReferenceDate: string
): string {
  const [y, m, d] = payslipReferenceDate.split("-").map(Number)
  let year = y - displayedSeniority.years
  let month = m - displayedSeniority.months
  let day = d - displayedSeniority.days

  if (day < 1) {
    month--
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
    day += prevMonthLastDay
  }
  if (month < 1) {
    year--
    month += 12
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getSeniorityAtDate(
  effectiveDate: string,
  targetDate: string
): SeniorityResult {
  return calculateSeniority(effectiveDate, targetDate)
}


