const MEXICO_TIME_ZONE = "America/Mexico_City"

const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const

export function institutionalToday(): Date {
  return new Date(`${institutionalDateString()}T00:00:00`)
}

export function institutionalDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MEXICO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function institutionalDateTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MEXICO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace("24:", "00:")
}

export function institutionalWeekday(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: MEXICO_TIME_ZONE,
    weekday: "long",
  })
  const name = dtf.format(date)
  const idx = WEEKDAY_NAMES.indexOf(name as (typeof WEEKDAY_NAMES)[number])
  return idx >= 0 ? name : WEEKDAY_NAMES[0]
}

export function institutionalMonthName(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    month: "long",
  })
  const name = dtf.format(date)
  const idx = MONTH_NAMES.indexOf(name as (typeof MONTH_NAMES)[number])
  return idx >= 0 ? name : MONTH_NAMES[0]
}

export function formatDateInstitutional(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d)
}

export function isInstitutionalDateValid(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const d = new Date(`${isoDate}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === isoDate
}

export function todayForQueryParam(): string {
  return institutionalDateString()
}
