import type { TiempoExtraInput, TiempoExtraResult } from "./types"

export const JORNADAS = [6.5, 8, 12] as const

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
