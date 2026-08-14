import type {
  SegundaJulioInput,
  SegundaJulioProporcionalInput,
  SegundaJulioProporcionalResult,
} from "./types"
import { FONDO_AHORRO_CONSTANTS } from "@/shared/lib/fondo-ahorro"

export const SEGUNDA_JULIO_DAYS_FULL = FONDO_AHORRO_CONSTANTS.DAYS_FULL_ANNUAL
export const SEGUNDA_JULIO_ANNUAL_BASE = FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS

/**
 * Segunda de julio (Fondo de Ahorro, 055) — régimen ordinario.
 *
 * Base = sueldo tabular (002). El procedimiento 1A74-003-024 fija el régimen
 * ordinario con base 002; la prima 011 NO integra la base.
 */
export function calculateSegundaJulio(input: SegundaJulioInput): number {
  return (input.concepto002 / FONDO_AHORRO_CONSTANTS.DAILY_BASE_DIVISOR) * FONDO_AHORRO_CONSTANTS.DAYS_FULL_ANNUAL
}

export function calculateSegundaJulioProporcional(input: SegundaJulioProporcionalInput): SegundaJulioProporcionalResult {
  const base = input.concepto002
  const importeCompleto = calculateSegundaJulio({ concepto002: base })
  const proporcion = input.unidades / FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS

  return {
    base,
    importeCompleto,
    proporcion,
    resultado: importeCompleto * proporcion,
  }
}

/**
 * Deprecated: renombrado a `validateUnidades`. Se conserva como alias para
 * no romper consumidores previos.
 */
export function validateDiasLaborados(dias: number): string | null {
  return validateUnidades(dias)
}

export function validateUnidades(unidades: number): string | null {
  if (!Number.isInteger(unidades)) return "Las unidades deben ser un número entero"
  if (unidades < 1) return "El mínimo es 1 unidad"
  if (unidades > FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS) return `El máximo es ${FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS} unidades (base anual)`
  return null
}
