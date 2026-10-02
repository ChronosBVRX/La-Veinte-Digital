import { redondearMinutosClausula33 } from "@/features/calculators/lib/tiempoExtra"

/**
 * Lógica pura de cálculo para estimación de ingresos por Tiempo Extra en la Agenda Laboral.
 * 
 * Normativa CCT IMSS:
 * 1. Redondeo de minutos según Cláusula 33 (<30 min = 0.5 h, >=30 min = 1.0 h).
 * 2. Horas ordinarias del periodo quincenal = jornada diaria × 15.
 * 3. Valor de la hora ordinaria = base quincenal ÷ horas del periodo.
 * 4. Factor ordinario: Dobles (factor 2) para jornadas extras habituales;
 *    Triples (factor 3) si se labora en día de descanso semanal o descanso obligatorio festivo.
 */

export interface AgendaTiempoExtraParams {
  startTime: string
  endTime: string
  baseSalaryFortnightly?: number | null
  jornada?: number
  isHolidayOrRestDay?: boolean
}

export interface AgendaTiempoExtraResult {
  status: "calculated" | "pending"
  rawMinutes: number
  hoursCalculated: number
  jornadaUsed: number
  hourlyRate?: number
  factor: number
  estimatedEarnings?: number
  formula: string
  missingDataReason?: string
  displaySummary: string
  isHolidayOrRestDay: boolean
}

/**
 * Calcula la duración entre dos horas en formato "HH:mm".
 * Si la hora de fin es menor o igual a la de inicio, asume que cruza la medianoche (+1 día).
 */
export function getDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0

  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins
}

export function calculateAgendaTiempoExtra(params: AgendaTiempoExtraParams): AgendaTiempoExtraResult {
  const { startTime, endTime, baseSalaryFortnightly, isHolidayOrRestDay = false } = params
  const jornada = params.jornada && params.jornada > 0 ? params.jornada : 8

  const rawMinutes = getDurationMinutes(startTime, endTime)
  const hoursCalculated = redondearMinutosClausula33(rawMinutes)
  const factor = isHolidayOrRestDay ? 3 : 2

  if (rawMinutes <= 0 || hoursCalculated <= 0) {
    return {
      status: "pending",
      rawMinutes: 0,
      hoursCalculated: 0,
      jornadaUsed: jornada,
      factor,
      formula: "0 hrs calculadas",
      missingDataReason: "Ingresa horario de inicio y término válido",
      displaySummary: "Horario incompleto",
      isHolidayOrRestDay,
    }
  }

  const base = baseSalaryFortnightly
  if (typeof base !== "number" || !Number.isFinite(base) || base <= 0) {
    return {
      status: "pending",
      rawMinutes,
      hoursCalculated,
      jornadaUsed: jornada,
      factor,
      formula: `${hoursCalculated}h × factor ${factor} (${isHolidayOrRestDay ? "triple" : "doble"})`,
      missingDataReason: "Falta registrar sueldo base (concepto 002) en perfil o tarjetón",
      displaySummary: `Pendiente de calcular: ${hoursCalculated}h registradas. Sube tu tarjetón para calcular tu pago estimado.`,
      isHolidayOrRestDay,
    }
  }

  const roundedBase = Math.round(base * 100) / 100
  const horasPeriodo = jornada * 15
  const hourlyRate = Math.round((roundedBase / horasPeriodo) * 100) / 100
  const estimatedEarnings = Math.round(hoursCalculated * hourlyRate * factor * 100) / 100

  const factorLabel = isHolidayOrRestDay ? "al triple (descanso/festivo)" : "al doble (ordinario)"
  const formula = `$${hourlyRate.toLocaleString("es-MX", { minimumFractionDigits: 2 })}/h ordinaria × ${hoursCalculated}h × ${factor} (${factorLabel})`

  return {
    status: "calculated",
    rawMinutes,
    hoursCalculated,
    jornadaUsed: jornada,
    hourlyRate,
    factor,
    estimatedEarnings,
    formula,
    displaySummary: `$${estimatedEarnings.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${hoursCalculated}h ${factorLabel})`,
    isHolidayOrRestDay,
  }
}
