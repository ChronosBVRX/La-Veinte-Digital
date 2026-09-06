/**
 * Lógica pura de cálculo para incidencias de Falta Injustificada en Agenda.
 *
 * Determina:
 * 1. Quincena afectada (1ª quincena: días 1–15; 2ª quincena: día 16 al fin de mes).
 * 2. Cálculo del descuento estimado con base en el sueldo base tabular (concepto 002 ÷ 15).
 * 3. Estado "pendiente de calcular" si no existe sueldo base registrado, sin inventar cifras.
 */

export interface FortnightInfo {
  fortnightNumber: 1 | 2
  year: number
  month: number
  monthName: string
  day: number
  lastDayOfMonth: number
  label: string
  periodKey: string
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Obtiene el último día natural del mes (contempla años bisiestos para febrero).
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Calcula la quincena natural a la que corresponde una fecha dada.
 */
export function getFortnightInfo(dateInput: Date | string): FortnightInfo {
  let year: number
  let month: number
  let day: number

  if (typeof dateInput === "string") {
    const cleanStr = dateInput.split("T")[0]
    const parts = cleanStr.split("-").map(Number)
    year = parts[0]
    month = parts[1]
    day = parts[2]
  } else {
    year = dateInput.getFullYear()
    month = dateInput.getMonth() + 1
    day = dateInput.getDate()
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return {
      fortnightNumber: 1,
      year: 0,
      month: 0,
      monthName: "",
      day: 0,
      lastDayOfMonth: 0,
      label: "Fecha no válida",
      periodKey: "",
    }
  }

  const lastDay = getLastDayOfMonth(year, month)
  const isFirstHalf = day <= 15
  const fortnightNumber: 1 | 2 = isFirstHalf ? 1 : 2
  const monthName = MONTH_NAMES[month - 1] ?? ""

  const rangeStr = isFirstHalf ? `1–15 de ${monthName}` : `16–${lastDay} de ${monthName}`
  const label = `${fortnightNumber}ª quincena (${rangeStr} de ${year})`
  const periodKey = `${year}-${String(month).padStart(2, "0")}-Q${fortnightNumber}`

  return {
    fortnightNumber,
    year,
    month,
    monthName,
    day,
    lastDayOfMonth: lastDay,
    label,
    periodKey,
  }
}

export interface FaltaDescuentoResult {
  status: "calculated" | "pending"
  baseSalaryUsed?: number
  dailySalary?: number
  estimatedDeduction?: number
  formula: string
  missingDataReason?: string
  displaySummary: string
}

/**
 * Calcula el descuento estimado por un día de falta injustificada.
 *
 * Fórmula canónica IMSS / CCT:
 * Salario diario = Sueldo base quincenal (concepto 002) ÷ 15 días.
 * Descuento estimado (1 día de falta) = Salario diario.
 */
export function calculateFaltaDescuento(params: {
  baseSalaryFortnightly?: number | null
}): FaltaDescuentoResult {
  const base = params.baseSalaryFortnightly

  if (typeof base !== "number" || !Number.isFinite(base) || base <= 0) {
    return {
      status: "pending",
      formula: "Sueldo base quincenal (002) ÷ 15 días",
      missingDataReason: "Falta registrar sueldo base (concepto 002) en perfil o tarjetón",
      displaySummary: "Pendiente de calcular: Falta registrar sueldo base (concepto 002) en perfil o tarjetón",
    }
  }

  const roundedBase = Math.round(base * 100) / 100
  const daily = Math.round((roundedBase / 15) * 100) / 100
  const deduction = daily
  const formula = `$${roundedBase.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (sueldo base quincenal) ÷ 15 días = $${daily.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por día`

  return {
    status: "calculated",
    baseSalaryUsed: roundedBase,
    dailySalary: daily,
    estimatedDeduction: deduction,
    formula,
    displaySummary: `$${deduction.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${formula})`,
  }
}
