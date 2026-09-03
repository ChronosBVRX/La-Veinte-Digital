import type { AguinaldoInput, AguinaldoResult, FormulaEvidence } from "./types"
import { roundCurrency } from "./money"

/**
 * Factor histórico reconstruido (fixture / referencia empírica).
 * Se mantiene como comparación histórica documentada pero NUNCA como el resultado principal.
 */
export const FACTOR_AGUINALDO_RECONSTRUIDO = 7.490956567109524
export const FACTOR_AGUINALDO = FACTOR_AGUINALDO_RECONSTRUIDO

/**
 * Cláusula 107 del CCT IMSS-SNTSS 2025-2027:
 * "Los trabajadores percibirán por concepto de aguinaldo anual el equivalente a
 * tres meses de sueldo nominal..."
 * Tres meses de sueldo nominal = 6 quincenas de sueldo base integrado.
 */
export const DIAS_AGUINALDO_ORDINARIO = 90 // 3 meses = 90 días
export const FACTOR_AGUINALDO_CLAUSULA_107 = 6

const FORMULA_EVIDENCE: FormulaEvidence = {
  status: "contract_verified",
  source: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
  reference: "Cláusula 107 (Aguinaldo) — 3 meses de sueldo nominal (90 días)",
  notes:
    "Base normativa: Conceptos 002 y 011; en su caso conceptos integrantes autorizados (019, 054, 057, 058, 061). Desglose: Enero concepto 047 (medio mes = 15 días); Agosto concepto 043 (un mes = 30 días, a solicitud); Diciembre concepto 049 (saldo restante).",
}

export function calculateAguinaldo(input: AguinaldoInput): AguinaldoResult {
  const conceptosIntegrantes: { code: string; label: string; amount: number }[] = [
    { code: "002", label: "Sueldo Tabular", amount: input.concepto002 || 0 },
    { code: "011", label: "Concepto Tabular 011", amount: input.concepto011 || 0 },
  ]

  if (input.concepto019 && input.concepto019 > 0) {
    conceptosIntegrantes.push({ code: "019", label: "Sustitución de Médico / Cl. 63 bis", amount: input.concepto019 })
  }
  if (input.concepto054 && input.concepto054 > 0) {
    conceptosIntegrantes.push({ code: "054", label: "Infecto-Contagiosidad / Radiación", amount: input.concepto054 })
  }
  if (input.concepto057 && input.concepto057 > 0) {
    conceptosIntegrantes.push({ code: "057", label: "Atención Integral Continua", amount: input.concepto057 })
  }
  if (input.concepto058 && input.concepto058 > 0) {
    conceptosIntegrantes.push({ code: "058", label: "Docencia en Enfermería", amount: input.concepto058 })
  }
  if (input.concepto061 && input.concepto061 > 0) {
    conceptosIntegrantes.push({ code: "061", label: "Traslado de Pacientes", amount: input.concepto061 })
  }

  const base = roundCurrency(conceptosIntegrantes.reduce((sum, c) => sum + c.amount, 0))
  const baseMensual = roundCurrency(base * 2)
  const cuotaDiaria = roundCurrency(base / 15)

  const diasLaborados = input.diasLaboradosAno !== undefined && input.diasLaboradosAno >= 0
    ? Math.min(365, input.diasLaboradosAno)
    : 360

  // Proporcionalidad conforme a días laborados (360 base anual según práctica institucional)
  const proporcionComputable = diasLaborados >= 360 ? 1 : diasLaborados / 360

  const diasOrdinarios = 90
  const diasAdicionales = input.diasAdicionalesConfirmados && input.diasAdicionalesConfirmados > 0
    ? input.diasAdicionalesConfirmados
    : 0
  const diasTotales = diasOrdinarios + diasAdicionales

  // Total anual conforme a Cláusula 107
  const totalOrdinario = roundCurrency(baseMensual * 3 * proporcionComputable)
  const totalAdicional = roundCurrency(cuotaDiaria * diasAdicionales * proporcionComputable)
  const totalAnual = roundCurrency(totalOrdinario + totalAdicional)

  // Desglose de pagos institucionales:
  // 1. Concepto 047 (Enero): medio mes de sueldo nominal (15 días)
  const anticipoEnero047 = roundCurrency(baseMensual * 0.5 * proporcionComputable)

  // 2. Concepto 043 (Agosto): un mes de sueldo nominal (30 días), si el trabajador lo solicitó
  const valeAgosto043 = input.solicitoAgosto043
    ? roundCurrency(baseMensual * 1.0 * proporcionComputable)
    : 0

  // 3. Anticipos pagados a deducir
  const anticiposDeducibles = input.anticiposPreviosPagados !== undefined
    ? input.anticiposPreviosPagados
    : (anticipoEnero047 + valeAgosto043)

  // 4. Concepto 049 (Diciembre): saldo remanente
  const saldoDiciembre049 = Math.max(0, roundCurrency(totalAnual - anticiposDeducibles))

  // Comparación histórica con el factor empírico previo
  const historicalTotal = roundCurrency(base * FACTOR_AGUINALDO_RECONSTRUIDO)

  return {
    base,
    baseMensual,
    conceptosIntegrantes,
    diasOrdinarios,
    diasAdicionales,
    diasTotales,
    proporcionComputable,
    totalAnual,
    anticipoEnero047,
    valeAgosto043,
    saldoDiciembre049,
    factor: 6,
    formulaEvidence: FORMULA_EVIDENCE,
    historicalComparison: {
      label: "Factor empírico anterior (reconstruido)",
      factor: FACTOR_AGUINALDO_RECONSTRUIDO,
      total: historicalTotal,
      reference: "Factor histórico 7.490956... (sin evidencia documental en CCT)",
    },
  }
}

export { FORMULA_EVIDENCE as AGUINALDO_FORMULA_EVIDENCE }
