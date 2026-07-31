import type { TiempoExtraInput, TiempoExtraResult } from "./types"

export const JORNADAS = [6.5, 8, 12] as const
export const MAX_HORAS_EXTRA = 24

// Nota técnica: la implementación de referencia parecía dividir entre las horas
// extra y multiplicar posteriormente por las mismas, anulando su efecto.
// Esta plataforma utiliza la fórmula corregida en la que el valor por hora se
// multiplica por las horas trabajadas (ver calculateTiempoExtraLegacy).

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

export function calculateTiempoExtra(input: TiempoExtraInput): TiempoExtraResult {
  const sumaConceptos = sumTiempoExtraConceptos(input)
  const horasOrdinariasPeriodo = input.jornada * 15
  const valorHora = sumaConceptos / horasOrdinariasPeriodo
  const pago = valorHora * 2 * input.horasExtra

  return {
    sumaConceptos,
    horasOrdinariasPeriodo,
    valorHora,
    factor: 2,
    horasExtra: input.horasExtra,
    pago,
  }
}

export function calculateTiempoExtraLegacy(input: TiempoExtraInput): number {
  const suma = sumTiempoExtraConceptos(input)
  return (suma * 2) / (input.jornada * 15)
}

export function validateHorasExtra(horas: number): string | null {
  if (!Number.isFinite(horas) || horas <= 0) return "Debe ser mayor que cero"
  if (horas > MAX_HORAS_EXTRA) return `Máximo razonable: ${MAX_HORAS_EXTRA} horas`
  return null
}
