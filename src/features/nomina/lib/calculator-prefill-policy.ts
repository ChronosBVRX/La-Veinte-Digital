import type { CalculatorId } from "@/shared/contracts/calculator-prefill"

/**
 * Política de prerrelleno por calculadora.
 *
 * Define qué campos pueden prerrellenarse en cada calculadora. La política es
 * explícita y cerrada: ningún campo fuera de la lista se envía al cliente.
 * El builder de prerrelleno la aplica como filtro final.
 */
export interface CalculatorPrefillPolicy {
  calculatorId: CalculatorId
  /** Categoría resuelta (id y nombre). */
  allowCategory: boolean
  /** Conceptos salariales base permitidos (002, 011, 020, 050, 054, 023, 063). */
  allowedConceptCodes: string[]
  /**
   * El 022 es una prestación ANUAL por antigüedad. Nunca se integra en una
   * base; si se permite, solo se muestra como información independiente con
   * requires_confirmation.
   */
  includeConcept022AsInfo: boolean
  /** Antigüedad como dato auxiliar (años y fecha efectiva). */
  includeSeniority: boolean
  /** Horas de jornada (derivadas de la categoría). */
  includeWorkdayHours: boolean
  /** Días laborados en el periodo anual (solo con fuente verificable). */
  includeDaysWorked: boolean
  notes: string[]
}

const NO_SENIORITY: Pick<CalculatorPrefillPolicy, "includeSeniority"> = { includeSeniority: false }
const NO_CATEGORY: Pick<CalculatorPrefillPolicy, "allowCategory"> = { allowCategory: false }

export const CALCULATOR_POLICIES: Record<CalculatorId, CalculatorPrefillPolicy> = {
  aguinaldo: {
    calculatorId: "aguinaldo",
    allowCategory: true,
    allowedConceptCodes: ["002", "011"],
    includeConcept022AsInfo: false,
    includeWorkdayHours: false,
    includeDaysWorked: false,
    ...NO_SENIORITY,
    notes: [
      "002 y 011 se prerrellenan; 011 solo como referencia normativa.",
      "La fórmula original (factor 7.490956567109524) y la distribución 047/043/049 no se modifican.",
      "El 022 no forma parte de la base del aguinaldo.",
    ],
  },
  "clausula-97": {
    calculatorId: "clausula-97",
    allowCategory: true,
    allowedConceptCodes: ["002", "011"],
    includeConcept022AsInfo: true,
    includeSeniority: true,
    includeWorkdayHours: false,
    includeDaysWorked: false,
    notes: [
      "002 y 011 se prerrellenan; 011 solo como referencia normativa.",
      "El 022 se muestra como información independiente y NO se suma a la base.",
      "La fórmula original (base × 2/4/6/8) no se modifica.",
    ],
  },
  prestamos: {
    calculatorId: "prestamos",
    allowCategory: true,
    allowedConceptCodes: ["002", "011"],
    includeConcept022AsInfo: false,
    includeSeniority: false,
    includeWorkdayHours: false,
    includeDaysWorked: false,
    notes: [
      "La categoría y el sueldo tabular se prerrellenan como referencia.",
      "Las tablas de préstamos y sus fórmulas no se sustituyen.",
    ],
  },
  "segunda-julio": {
    calculatorId: "segunda-julio",
    allowCategory: true,
    allowedConceptCodes: ["002", "011"],
    includeConcept022AsInfo: false,
    includeSeniority: false,
    includeWorkdayHours: false,
    includeDaysWorked: false,
    notes: [
      "002 y 011 se prerrellenan; 011 solo como referencia normativa.",
      "El 022 NO se introduce en esta fórmula.",
      "La fórmula original ((base ÷ 15) × 46) no se modifica.",
    ],
  },
  "segunda-julio-proporcional": {
    calculatorId: "segunda-julio-proporcional",
    allowCategory: true,
    allowedConceptCodes: ["002", "011"],
    includeConcept022AsInfo: false,
    includeSeniority: true,
    includeWorkdayHours: false,
    includeDaysWorked: true,
    notes: [
      "002 y 011 se prerrellenan.",
      "Los días laborados solo se prerrellenan si existe una fuente real y verificable; nunca se inventan (no se asume 360).",
      "La antigüedad es solo un dato auxiliar.",
      "La fórmula original (importe completo × días ÷ 360) no se modifica.",
    ],
  },
  "tiempo-extra": {
    calculatorId: "tiempo-extra",
    allowCategory: true,
    allowedConceptCodes: ["002", "011", "020", "023", "050", "054", "063"],
    includeConcept022AsInfo: false,
    includeSeniority: false,
    includeWorkdayHours: true,
    includeDaysWorked: false,
    notes: [
      "002, 011 y 020 se prerrellenan cuando están vigentes.",
      "050 solo si existe monto validado; 023 y 063 solo con evidencia confirmada en tarjetón.",
      "El 022 NUNCA se integra automáticamente a la base (es una prestación anual).",
      "Las horas extra siempre se capturan manualmente; nunca se prerrellenan.",
      "La fórmula original (valor hora × 2 × horas extra) no se modifica.",
    ],
  },
}

export function getCalculatorPolicy(calculatorId: CalculatorId): CalculatorPrefillPolicy {
  return CALCULATOR_POLICIES[calculatorId]
}
