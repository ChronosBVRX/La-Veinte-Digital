const MEXICO_TIME_ZONE = "America/Mexico_City"

// México sin horario de verano desde 2022 (UTC-6 fijo).
const MEXICO_OFFSET_MS = -6 * 60 * 60 * 1000

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

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function isISODateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Convierte una fecha civil YYYY-MM-DD (día institucional de México) en el
// instante UTC de su medianoche mexicana. Sin esto, `new Date("2026-08-01")`
// se interpreta como medianoche de la zona del servidor y al reformatear en
// America/Mexico_City retrocede al día anterior.
function mexicoMidnight(dateString: string): Date {
  return new Date(Date.parse(`${dateString}T00:00:00Z`) - MEXICO_OFFSET_MS)
}

export function institutionalToday(): Date {
  return mexicoMidnight(institutionalDateString())
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
  const dtf = new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    weekday: "long",
  })
  const name = capitalize(dtf.format(date))
  const idx = WEEKDAY_NAMES.indexOf(name as (typeof WEEKDAY_NAMES)[number])
  return idx >= 0 ? name : WEEKDAY_NAMES[0]
}

export function institutionalMonthName(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    month: "long",
  })
  const name = capitalize(dtf.format(date))
  const idx = MONTH_NAMES.indexOf(name as (typeof MONTH_NAMES)[number])
  return idx >= 0 ? name : MONTH_NAMES[0]
}

export function formatDateInstitutional(date: Date | string): string {
  const dtf = new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  if (typeof date === "string") {
    if (!isISODateString(date)) return date
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "UTC",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.parse(`${date}T00:00:00Z`)))
  }
  return dtf.format(date)
}

export function isInstitutionalDateValid(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const d = new Date(`${isoDate}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === isoDate
}

export function todayForQueryParam(): string {
  return institutionalDateString()
}
