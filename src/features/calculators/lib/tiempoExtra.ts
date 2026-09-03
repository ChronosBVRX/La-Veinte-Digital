import type {
  TiempoExtraInput,
  TiempoExtraResult,
  HorasExtraValidation,
  TiempoExtraTierBreakdown,
} from "./types"
import { roundCurrency } from "./money"

export const JORNADAS = [6, 6.5, 8, 12] as const

/**
 * Límites normativos ordinarios del tiempo extraordinario
 * (procedimiento 1A74-003-031): 9 h semanales / 20 h quincenales.
 */
export const MAX_HORAS_SEMANALES = 9
export const MAX_HORAS_QUINCENALES = 20
export const MAX_HORAS_EXTRA = 24

/**
 * Redondeo reglamentario de minutos según Cláusula 33 del CCT:
 * - Menos de 30 minutos: se computa media hora (0.5 h).
 * - De 30 a 60 minutos: se computa una hora completa (1.0 h).
 */
export function redondearMinutosClausula33(minutos: number): number {
  if (minutos <= 0) return 0
  const horasCompletas = Math.floor(minutos / 60)
  const remanenteMinutos = minutos % 60
  if (remanenteMinutos === 0) return horasCompletas
  if (remanenteMinutos < 30) return horasCompletas + 0.5
  return horasCompletas + 1.0
}

/** Suma manual de los conceptos capturados (solo si no se usa baseNormativa). */
export function sumTiempoExtraConceptos(input: TiempoExtraInput): number {
  return (
    (input.concepto002 || 0) +
    (input.concepto011 || 0) +
    (input.concepto020 || 0) +
    (input.conceptoAdicional1 || 0) +
    (input.conceptoAdicional2 || 0) +
    (input.concepto050 || 0)
  )
}

/** Horas ordinarias del periodo quincenal = jornada diaria × 15. */
export function calcularHorasOrdinariasPeriodo(jornada: number): number {
  return jornada * 15
}

/** Valor de la hora ordinaria = base ÷ horas ordinarias del periodo. */
export function calcularValorHora(base: number, jornada: number): number {
  return base / calcularHorasOrdinariasPeriodo(jornada)
}

/**
 * Pago de tiempo extra:
 * - Primeras 9 horas semanales: factor 2 (100% adicional / dobles).
 * - Excedente de 9 horas semanales: factor 3 (200% adicional / triples).
 */
export function calcularPagoTiempoExtra(base: number, jornada: number, horasExtra: number): number {
  const valorHora = calcularValorHora(base, jornada)
  const horasDobles = Math.min(9, Math.max(0, horasExtra))
  const horasTriples = Math.max(0, horasExtra - 9)
  return roundCurrency(horasDobles * valorHora * 2 + horasTriples * valorHora * 3)
}

/**
 * Elige la base del cálculo:
 * - Si se provee `baseNormativa` (del motor de repercusiones, concepto 037),
 *   se usa esa base integrada y los campos manuales se ignoran como base.
 * - En su defecto, se usa la suma manual capturada.
 */
export function elegirBaseTiempoExtra(input: TiempoExtraInput): {
  baseTotal: number
  baseNormativaUsada: boolean
  conceptosIntegrados: { code: string; amount: number }[]
} {
  if (input.baseNormativa && input.baseNormativa.baseAmount > 0) {
    return {
      baseTotal: input.baseNormativa.baseAmount,
      baseNormativaUsada: true,
      conceptosIntegrados: input.baseNormativa.conceptos,
    }
  }
  return {
    baseTotal: sumTiempoExtraConceptos(input),
    baseNormativaUsada: false,
    conceptosIntegrados: [],
  }
}

export function calculateTiempoExtra(input: TiempoExtraInput): TiempoExtraResult {
  const { baseTotal, baseNormativaUsada, conceptosIntegrados } = elegirBaseTiempoExtra(input)
  const horasOrdinariasPeriodo = calcularHorasOrdinariasPeriodo(input.jornada)
  const valorHora = calcularValorHora(baseTotal, input.jornada)

  const horasDobles = Math.min(9, Math.max(0, input.horasExtra))
  const horasTriples = Math.max(0, input.horasExtra - 9)
  const horasDescansoSemanal = Math.max(0, input.horasDescansoSemanal || 0)
  const horasDescansoObligatorio = Math.max(0, input.horasDescansoObligatorio || 0)
  const horasCoincidentes = Math.max(0, input.horasDescansoObligatorioEnSemanal || 0)

  const desglose: TiempoExtraTierBreakdown[] = []

  if (horasDobles > 0) {
    desglose.push({
      label: "Horas extras dobles (primeras 9 h semanales)",
      horas: horasDobles,
      factor: 2,
      importe: roundCurrency(horasDobles * valorHora * 2),
    })
  }

  if (horasTriples > 0) {
    desglose.push({
      label: "Horas extras triples (excedente de 9 h semanales)",
      horas: horasTriples,
      factor: 3,
      importe: roundCurrency(horasTriples * valorHora * 3),
    })
  }

  if (horasDescansoSemanal > 0) {
    desglose.push({
      label: "Labor en día de descanso semanal (triple)",
      horas: horasDescansoSemanal,
      factor: 3,
      importe: roundCurrency(horasDescansoSemanal * valorHora * 3),
    })
  }

  if (horasDescansoObligatorio > 0) {
    desglose.push({
      label: "Labor en descanso obligatorio festivo (triple)",
      horas: horasDescansoObligatorio,
      factor: 3,
      importe: roundCurrency(horasDescansoObligatorio * valorHora * 3),
    })
  }

  if (horasCoincidentes > 0) {
    desglose.push({
      label: "Labor coincidente (descanso obligatorio en descanso semanal, cuádruple)",
      horas: horasCoincidentes,
      factor: 4,
      importe: roundCurrency(horasCoincidentes * valorHora * 4),
    })
  }

  const pago = desglose.reduce((sum, d) => sum + d.importe, 0)
  const totalHorasCalculadas = input.horasExtra + horasDescansoSemanal + horasDescansoObligatorio + horasCoincidentes
  const effectiveFactor = totalHorasCalculadas > 0 && valorHora > 0
    ? roundCurrency(pago / (valorHora * totalHorasCalculadas))
    : 2

  return {
    sumaConceptos: baseTotal,
    horasOrdinariasPeriodo,
    valorHora,
    factor: effectiveFactor,
    horasExtra: input.horasExtra,
    pago,
    desglose,
    baseNormativaUsada,
    conceptosIntegrados,
  }
}

export function calculateTiempoExtraLegacy(input: TiempoExtraInput): number {
  const suma = sumTiempoExtraConceptos(input)
  return (suma * 2) / (input.jornada * 15)
}

/**
 * Validación básica de cordura (legacy): mayor que cero y dentro del tope
 * de cordura de 24 horas.
 */
export function validateHorasExtra(horas: number): string | null {
  if (!Number.isFinite(horas) || horas <= 0) return "Debe ser mayor que cero"
  if (horas > MAX_HORAS_EXTRA) return `Tope de cordura: ${MAX_HORAS_EXTRA} horas`
  return null
}

/** Valida el límite ordinario de 9 h semanales. */
export function validateHorasSemana(horasSemana: number | undefined): HorasExtraValidation {
  if (horasSemana === undefined || horasSemana === null || horasSemana <= 0) {
    return { valid: true, requiresConfirmation: false }
  }
  if (!Number.isFinite(horasSemana)) {
    return { valid: false, error: "Debe ser un número válido" }
  }
  if (horasSemana > MAX_HORAS_SEMANALES) {
    return {
      valid: false,
      error: `Excede el límite ordinario de ${MAX_HORAS_SEMANALES} h semanales (proc. 1A74-003-031). El excedente se paga al triple conforme a LFT / CCT.`,
      requiresConfirmation: true,
    }
  }
  return { valid: true }
}

export function validateHorasExtraQuincena(
  horas: number,
  exception?: boolean | TiempoExtraInput["exceptionType"],
): HorasExtraValidation {
  const hasException = typeof exception === "boolean" ? exception : Boolean(exception)
  if (!Number.isFinite(horas) || horas <= 0) {
    return { valid: false, error: "Debe ser mayor que cero" }
  }
  if (horas <= MAX_HORAS_QUINCENALES) {
    return { valid: true }
  }
  if (hasException) {
    return {
      valid: true,
      warning: `Supera las ${MAX_HORAS_QUINCENALES} h ordinarias; se permite por excepción documentada. Confirma que está expresamente autorizada.`,
      requiresConfirmation: true,
    }
  }
  return {
    valid: false,
    error: `Excede el límite ordinario de ${MAX_HORAS_QUINCENALES} h quincenales (proc. 1A74-003-031). Solo se admite con excepción documentada (Cláusula 100 CCT o Art. 24 RIT).`,
    requiresConfirmation: true,
  }
}
