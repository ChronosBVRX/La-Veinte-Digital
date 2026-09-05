import type {
  SegundaJulioInput,
  SegundaJulioProporcionalInput,
  SegundaJulioProporcionalResult,
} from "./types"
import { FONDO_AHORRO_CONSTANTS } from "@/shared/lib/fondo-ahorro"

export const SEGUNDA_JULIO_DAYS_FULL = FONDO_AHORRO_CONSTANTS.DAYS_FULL_ANNUAL
export const SEGUNDA_JULIO_ANNUAL_BASE = FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS

/**
 * Resuelve la base normativa del Fondo de Ahorro (055).
 * Conforme a la Cláusula 144 del CCT y la repercusión expresa de la Cláusula 63 Bis inc. b,
 * la base integra el sueldo tabular (002) y la ayuda de renta (011).
 */
export function resolveFondoAhorroBase(input: SegundaJulioInput): number {
  return input.concepto002 + (input.concepto011 ?? 0)
}

/**
 * Segunda de julio (Fondo de Ahorro, 055) — régimen ordinario.
 *
 * Base = sueldo tabular (002) + ayuda renta (011) por repercusión de la Cláusula 63 Bis inc. b CCT.
 * Procedimiento 1A74-003-024 (46 días de sueldo tabular conforme a Cláusula 144 CCT).
 */
export function calculateSegundaJulio(input: SegundaJulioInput): number {
  const base = resolveFondoAhorroBase(input)
  return (base / FONDO_AHORRO_CONSTANTS.DAILY_BASE_DIVISOR) * FONDO_AHORRO_CONSTANTS.DAYS_FULL_ANNUAL
}

export function calculateSegundaJulioProporcional(input: SegundaJulioProporcionalInput): SegundaJulioProporcionalResult {
  const base = resolveFondoAhorroBase(input)
  const importeCompleto = calculateSegundaJulio(input)
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
