import type { BaseConceptosInput, Clausula97Result, Clausula97MonthOption } from "./types"
import { roundCurrency } from "./money"

/**
 * Cláusula 97 del CCT IMSS-SNTSS 2025-2027:
 * "Anticipo de hasta por cuatro meses de sueldo una sola vez al año. Es facultativo
 * para el trabajador de base, usar en una sola ocasión o en forma fraccionada, el
 * derecho que le otorga esta cláusula. Estos anticipos no devengarán intereses."
 *
 * Base mensual = (002 + 011) × 2
 * Recuperación según CCT:
 * - 1 mes: 10 quincenas
 * - 2 meses: 20 quincenas
 * - 3 meses: 30 quincenas
 * - 4 meses: 40 quincenas
 */
export function calculateClausula97(input: BaseConceptosInput): Clausula97Result {
  const baseQuincenal = roundCurrency(input.concepto002 + input.concepto011)
  const baseMensual = roundCurrency(baseQuincenal * 2)

  const unMes = baseMensual
  const dosMeses = roundCurrency(baseMensual * 2)
  const tresMeses = roundCurrency(baseMensual * 3)
  const cuatroMeses = roundCurrency(baseMensual * 4)

  const opciones: Clausula97MonthOption[] = [
    {
      meses: 1,
      monto: unMes,
      quincenasRecuperacion: 10,
      descuentoQuincenal: roundCurrency(unMes / 10),
    },
    {
      meses: 2,
      monto: dosMeses,
      quincenasRecuperacion: 20,
      descuentoQuincenal: roundCurrency(dosMeses / 20),
    },
    {
      meses: 3,
      monto: tresMeses,
      quincenasRecuperacion: 30,
      descuentoQuincenal: roundCurrency(tresMeses / 30),
    },
    {
      meses: 4,
      monto: cuatroMeses,
      quincenasRecuperacion: 40,
      descuentoQuincenal: roundCurrency(cuatroMeses / 40),
    },
  ]

  return {
    baseQuincenal,
    baseMensual,
    unMes,
    dosMeses,
    tresMeses,
    cuatroMeses,
    opciones,
  }
}
