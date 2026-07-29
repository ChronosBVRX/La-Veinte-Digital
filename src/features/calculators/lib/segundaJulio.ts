import type { BaseConceptosInput, SegundaJulioProporcionalInput, SegundaJulioProporcionalResult } from "./types"

export function calculateSegundaJulio(input: BaseConceptosInput): number {
  const base = input.concepto002 + input.concepto011
  return (base / 15) * 46
}

export function calculateSegundaJulioProporcional(input: SegundaJulioProporcionalInput): SegundaJulioProporcionalResult {
  const base = input.concepto002 + input.concepto011
  const importeCompleto = (base / 15) * 46
  const proporcion = input.diasLaborados / 360

  return {
    base,
    importeCompleto,
    proporcion,
    resultado: importeCompleto * proporcion,
  }
}

export function validateDiasLaborados(dias: number): string | null {
  if (!Number.isInteger(dias)) return "Los días deben ser un número entero"
  if (dias < 1) return "El mínimo es 1 día"
  if (dias > 360) return "El máximo es 360 días (base anual)"
  return null
}
