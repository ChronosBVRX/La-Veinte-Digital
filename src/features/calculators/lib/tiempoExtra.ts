import type {
  TiempoExtraInput,
  TiempoExtraResult,
  HorasExtraValidation,
} from "./types"

export const JORNADAS = [6, 6.5, 8, 12] as const

/**
 * Límites normativos ordinarios del tiempo extraordinario
 * (procedimiento 1A74-003-031): 9 h semanales / 20 h quincenales.
 * El límite puede excederse ÚNICAMENTE con una excepción expresamente
 * documentada/seleccionada (Cláusula 100 del CCT o Art. 24 del RIT).
 */
export const MAX_HORAS_SEMANALES = 9
export const MAX_HORAS_QUINCENALES = 20

/**
 * Tope de cordura genérico para el mecanismo de pago (no normativo).
 * Se conserva como defensa de cálculo, no como regla institucional: la
 * validez normativa de las horas la definen los validadores 9/20.
 */
export const MAX_HORAS_EXTRA = 24

// Nota técnica: la implementación de referencia parecía dividir entre las horas
// extra y multiplicar posteriormente por las mismas, anulando su efecto.
// Esta plataforma utiliza la fórmula corregida en la que el valor por hora se
// multiplica por las horas trabajadas (ver calculateTiempoExtraLegacy).

/** Suma manual de los conceptos capturados (solo si no se usa baseNormativa). */
export function sumTiempoExtraConceptos(input: TiempoExtraInput): number {
  return (
    input.concepto002 +
    input.concepto011 +
    input.concepto020 +
    input.conceptoAdicional1 +
    input.conceptoAdicional2 +
    input.concepto050
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

/** Pago de tiempo extra = valor hora × 2 × horas. Factor de pago 2 sin modificar. */
export function calcularPagoTiempoExtra(base: number, jornada: number, horasExtra: number): number {
  return calcularValorHora(base, jornada) * 2 * horasExtra
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
  const pago = calcularPagoTiempoExtra(baseTotal, input.jornada, input.horasExtra)

  return {
    sumaConceptos: baseTotal,
    horasOrdinariasPeriodo,
    valorHora,
    factor: 2,
    horasExtra: input.horasExtra,
    pago,
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
 * de cordura de 24 horas. NO valida el límite normativo; para eso usa
 * `validateHorasSemana` y `validateHorasExtraQuincena`.
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
      error: `Excede el límite ordinario de ${MAX_HORAS_SEMANALES} h semanales (proc. 1A74-003-031). Requiere excepción documentada.`,
      requiresConfirmation: true,
    }
  }
  return { valid: true }
}

/**
 * Valida el límite ordinario de 20 h quincenales. Si se excede y NO hay una
 * excepción documentada/seleccionada, es error (requiere confirmación).
 * Con excepción, se permite con advertencia (requires_confirmation).
 */
export function validateHorasExtraQuincena(
  horas: number,
  exceptionType?: TiempoExtraInput["exceptionType"],
): HorasExtraValidation {
  if (!Number.isFinite(horas) || horas <= 0) {
    return { valid: false, error: "Debe ser mayor que cero" }
  }
  if (horas <= MAX_HORAS_QUINCENALES) {
    return { valid: true }
  }
  if (exceptionType) {
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
