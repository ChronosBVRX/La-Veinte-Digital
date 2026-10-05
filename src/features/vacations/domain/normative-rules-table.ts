import type { VacationRegime, VacationStage } from "./types";

export type NormativeSourceId =
  | "CCT_2025_2027"
  | "PROCEDIMIENTO_1A74_003_025"
  | "TABLA_1A74_022_065"
  | "ESTATUTO_CONFIANZA_A";

export interface NormativeCitation {
  source: NormativeSourceId;
  clauseOrSection: string;
  ruleId: string;
}

export interface VacationMarkRule {
  id: string;
  regime: VacationRegime;
  inclusionMark: number;
  allowedFromContinuity: number[];
  resultingContinuity: number;
  upoDelta: number;
  stage: VacationStage;
  enjoyedDaysRule:
    | { type: "FULL_ANNUAL" }
    | { type: "FIXED"; days: number }
    | { type: "RANGE_BY_SENIORITY"; min: number; max: number }
    | { type: "FRACTION"; part: 1 | 2 }
    | { type: "RADIATION_TABLE" };
  concept029Rule:
    | { type: "NONE" }
    | { type: "SAME_AS_ENJOYED" }
    | { type: "FIXED"; days: number };
  concept048Rule:
    | { type: "NONE" }
    | { type: "FULL" }
    | { type: "HALF" }
    | { type: "DEFERRED" }
    | { type: "FIXED"; days: number };
  citation: NormativeCitation;
}

/**
 * Tabla contractual de días hábiles a disfrutar por periodo cuatrimestral
 * para trabajadores expuestos en forma constante y permanente a emanaciones radiactivas.
 * Fuente: CCT IMSS-SNTSS 2025-2027, Cláusula 47, párrafo 5.
 */
export const RADIATION_DAYS_BY_SENIORITY: Record<number, [number, number, number]> = {
  0: [7, 8, 7],
  1: [8, 8, 8],
  2: [8, 9, 8],
  3: [9, 9, 9],
  4: [9, 10, 9],
  5: [10, 10, 10],
};

/**
 * Tabla declarativa única y verificable de reglas de marcas vacacionales.
 * Jerarquía normativa:
 * CCT 2025-2027 (Cláusula 47) → Procedimiento 1A74-003-025 → Tabla de marcas 1A74-022-065 → Estatuto Confianza "A".
 */
export const VACATION_MARK_RULES: VacationMarkRule[] = [
  // ============================================================================
  // RÉGIMEN SEMESTRAL (Base y Confianza B)
  // ============================================================================
  {
    id: "SEMESTRAL_MARK_0_CONTINUOUS",
    regime: "SEMESTRAL",
    inclusionMark: 0,
    allowedFromContinuity: [0, 2, 6, 13],
    resultingContinuity: 0,
    upoDelta: 2,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FULL_ANNUAL" },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Cláusula 47 CCT / Anexo 1 Tabla 1A74-022-065 (Marca 0)",
      ruleId: "SEMESTRAL_MARK_0_CONTINUOUS",
    },
  },
  {
    id: "SEMESTRAL_MARK_1_FIRST_FRACTION",
    regime: "SEMESTRAL",
    inclusionMark: 1,
    allowedFromContinuity: [0, 2, 6, 13],
    resultingContinuity: 1,
    upoDelta: 1,
    stage: "FIRST_FRACTION",
    enjoyedDaysRule: { type: "FRACTION", part: 1 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "HALF" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Cláusula 47 CCT / Anexo 1 Tabla 1A74-022-065 (Marca 1 - 1a Fracción 7-10 días)",
      ruleId: "SEMESTRAL_MARK_1_FIRST_FRACTION",
    },
  },
  {
    id: "SEMESTRAL_MARK_1_SECOND_FRACTION",
    regime: "SEMESTRAL",
    inclusionMark: 1,
    allowedFromContinuity: [1],
    resultingContinuity: 2,
    upoDelta: 1,
    stage: "SECOND_FRACTION",
    enjoyedDaysRule: { type: "FRACTION", part: 2 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "HALF" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Cláusula 47 CCT / Anexo 1 Tabla 1A74-022-065 (Marca 1 - 2a Fracción 8-10 días)",
      ruleId: "SEMESTRAL_MARK_1_SECOND_FRACTION",
    },
  },
  {
    id: "SEMESTRAL_MARK_2_FIRST_COMPLETE_PERIOD",
    regime: "SEMESTRAL",
    inclusionMark: 2,
    allowedFromContinuity: [0, 2, 6, 13],
    resultingContinuity: 3,
    upoDelta: 1,
    stage: "FIRST_COMPLETE_PERIOD",
    enjoyedDaysRule: { type: "RANGE_BY_SENIORITY", min: 15, max: 20 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Cláusula 47 antepenúltimo párrafo CCT / Tabla 1A74-022-065 (Marca 2: 15-20 días continuos sin 048)",
      ruleId: "SEMESTRAL_MARK_2_FIRST_COMPLETE_PERIOD",
    },
  },
  {
    id: "SEMESTRAL_MARK_3_SECOND_COMPLETE_PERIOD",
    regime: "SEMESTRAL",
    inclusionMark: 3,
    allowedFromContinuity: [3],
    resultingContinuity: 6,
    upoDelta: 1,
    stage: "SECOND_COMPLETE_PERIOD",
    enjoyedDaysRule: { type: "RANGE_BY_SENIORITY", min: 10, max: 15 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Cláusula 47 antepenúltimo párrafo CCT / Tabla 1A74-022-065 (Marca 3: 10-15 días sin 048, cierra en 6)",
      ruleId: "SEMESTRAL_MARK_3_SECOND_COMPLETE_PERIOD",
    },
  },
  {
    id: "SEMESTRAL_MARK_4_FIRST_FRACTION_FULL_048",
    regime: "SEMESTRAL",
    inclusionMark: 4,
    allowedFromContinuity: [0, 2, 6, 13],
    resultingContinuity: 4,
    upoDelta: 1,
    stage: "FIRST_FRACTION_4_9",
    enjoyedDaysRule: { type: "FRACTION", part: 1 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Anexo 1 Tabla 1A74-022-065 (Marca 4 -> 9: 1a fracción con 100% ayuda 048)",
      ruleId: "SEMESTRAL_MARK_4_FIRST_FRACTION_FULL_048",
    },
  },
  {
    id: "SEMESTRAL_MARK_9_SECOND_FRACTION_AFTER_4",
    regime: "SEMESTRAL",
    inclusionMark: 9,
    allowedFromContinuity: [4],
    resultingContinuity: 13,
    upoDelta: 1,
    stage: "SECOND_FRACTION_4_9",
    enjoyedDaysRule: { type: "FRACTION", part: 2 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Anexo 1 Tabla 1A74-022-065 (Marca 9 tras Marca 4: 2a fracción sin ayuda 048, cierra en 13)",
      ruleId: "SEMESTRAL_MARK_9_SECOND_FRACTION_AFTER_4",
    },
  },
  {
    id: "SEMESTRAL_MARK_9_FIRST_FRACTION_DEFERRED_048",
    regime: "SEMESTRAL",
    inclusionMark: 9,
    allowedFromContinuity: [0, 2, 6, 13],
    resultingContinuity: 9,
    upoDelta: 1,
    stage: "FIRST_FRACTION_9_4",
    enjoyedDaysRule: { type: "FRACTION", part: 1 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "DEFERRED" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Anexo 1 Tabla 1A74-022-065 (Marca 9 -> 4: 1a fracción difiere ayuda 048)",
      ruleId: "SEMESTRAL_MARK_9_FIRST_FRACTION_DEFERRED_048",
    },
  },
  {
    id: "SEMESTRAL_MARK_4_SECOND_FRACTION_AFTER_9",
    regime: "SEMESTRAL",
    inclusionMark: 4,
    allowedFromContinuity: [9],
    resultingContinuity: 13,
    upoDelta: 1,
    stage: "SECOND_FRACTION_9_4",
    enjoyedDaysRule: { type: "FRACTION", part: 2 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "TABLA_1A74_022_065",
      clauseOrSection: "Anexo 1 Tabla 1A74-022-065 (Marca 4 tras Marca 9: 2a fracción liquida 100% ayuda 048, cierra en 13)",
      ruleId: "SEMESTRAL_MARK_4_SECOND_FRACTION_AFTER_9",
    },
  },

  // ============================================================================
  // RÉGIMEN CUATRIMESTRAL (Emanaciones Radiactivas)
  // ============================================================================
  {
    id: "CUATRIMESTRAL_MARK_0_P1",
    regime: "CUATRIMESTRAL",
    inclusionMark: 0,
    allowedFromContinuity: [0, 3, 14],
    resultingContinuity: 1,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_A",
    enjoyedDaysRule: { type: "RADIATION_TABLE" },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 5 CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 0 - Periodo 1)",
      ruleId: "CUATRIMESTRAL_MARK_0_P1",
    },
  },
  {
    id: "CUATRIMESTRAL_MARK_0_P2",
    regime: "CUATRIMESTRAL",
    inclusionMark: 0,
    allowedFromContinuity: [1],
    resultingContinuity: 2,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_A",
    enjoyedDaysRule: { type: "RADIATION_TABLE" },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 5 CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 0 - Periodo 2)",
      ruleId: "CUATRIMESTRAL_MARK_0_P2",
    },
  },
  {
    id: "CUATRIMESTRAL_MARK_0_P3",
    regime: "CUATRIMESTRAL",
    inclusionMark: 0,
    allowedFromContinuity: [2],
    resultingContinuity: 3,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_A",
    enjoyedDaysRule: { type: "RADIATION_TABLE" },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 5 CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 0 - Periodo 3)",
      ruleId: "CUATRIMESTRAL_MARK_0_P3",
    },
  },
  {
    id: "CUATRIMESTRAL_MARK_2_P1",
    regime: "CUATRIMESTRAL",
    inclusionMark: 2,
    allowedFromContinuity: [0, 3, 14],
    resultingContinuity: 4,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_B",
    enjoyedDaysRule: { type: "FIXED", days: 15 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 último párrafo CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 2 - hasta 15 días sin 048)",
      ruleId: "CUATRIMESTRAL_MARK_2_P1",
    },
  },
  {
    id: "CUATRIMESTRAL_MARK_5_P2",
    regime: "CUATRIMESTRAL",
    inclusionMark: 5,
    allowedFromContinuity: [4],
    resultingContinuity: 9,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_B",
    enjoyedDaysRule: { type: "FIXED", days: 15 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 último párrafo CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 5 - Periodo 2 hasta 15 días sin 048)",
      ruleId: "CUATRIMESTRAL_MARK_5_P2",
    },
  },
  {
    id: "CUATRIMESTRAL_MARK_5_P3",
    regime: "CUATRIMESTRAL",
    inclusionMark: 5,
    allowedFromContinuity: [9],
    resultingContinuity: 14,
    upoDelta: 1,
    stage: "CUATRIMESTRAL_SEQUENCE_B",
    enjoyedDaysRule: { type: "FIXED", days: 15 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 último párrafo CCT / Tabla 1A74-022-065 (Cuatrimestral Marca 5 - Periodo 3 hasta 15 días sin 048)",
      ruleId: "CUATRIMESTRAL_MARK_5_P3",
    },
  },

  // ============================================================================
  // RÉGIMEN EXTRAORDINARIO V20 (20 años o más de antigüedad efectiva)
  // ============================================================================
  {
    id: "V20_MARK_0_ENJOY_10_WITH_048",
    regime: "EXTRAORDINARIO_V20",
    inclusionMark: 0,
    allowedFromContinuity: [0, 1, 2, 3, 6, 7, 8],
    resultingContinuity: 0,
    upoDelta: 1,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FIXED", days: 10 },
    concept029Rule: { type: "FIXED", days: 10 },
    concept048Rule: { type: "FIXED", days: 10 },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 10 CCT / Tabla 1A74-022-065 (V20 Marca 0: 10 días disfrute + 10 días 029 + 10 días 048)",
      ruleId: "V20_MARK_0_ENJOY_10_WITH_048",
    },
  },
  {
    id: "V20_MARK_6_ENJOY_15_NO_048",
    regime: "EXTRAORDINARIO_V20",
    inclusionMark: 6,
    allowedFromContinuity: [0, 1, 2, 3, 6, 7, 8],
    resultingContinuity: 0,
    upoDelta: 1,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FIXED", days: 15 },
    concept029Rule: { type: "FIXED", days: 15 },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 penúltimo párrafo CCT / Tabla 1A74-022-065 (V20 Marca 6: 15 días disfrute + 15 días 029, sin 048)",
      ruleId: "V20_MARK_6_ENJOY_15_NO_048",
    },
  },
  {
    id: "V20_MARK_7_WORK_30_DAYS_048",
    regime: "EXTRAORDINARIO_V20",
    inclusionMark: 7,
    allowedFromContinuity: [0, 1, 2, 3, 6, 7, 8],
    resultingContinuity: 0,
    upoDelta: 1,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FIXED", days: 0 },
    concept029Rule: { type: "NONE" },
    concept048Rule: { type: "FIXED", days: 30 },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 10 CCT / Tabla 1A74-022-065 (V20 Marca 7: 0 días disfrute, 0 días 029, 30 días 048)",
      ruleId: "V20_MARK_7_WORK_30_DAYS_048",
    },
  },
  {
    id: "V20_MARK_8_RETIREMENT_ACCREDITATION",
    regime: "EXTRAORDINARIO_V20",
    inclusionMark: 8,
    allowedFromContinuity: [0, 1, 2, 3, 6, 7, 8],
    resultingContinuity: 0,
    upoDelta: 1,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FIXED", days: 0 },
    concept029Rule: { type: "FIXED", days: 15 },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "CCT_2025_2027",
      clauseOrSection: "Cláusula 47 párrafo 10 CCT / Tabla 1A74-022-065 (V20 Marca 8: 0 días disfrute, 15 días 029, sin 048, anticipa 30 días jubilación)",
      ruleId: "V20_MARK_8_RETIREMENT_ACCREDITATION",
    },
  },

  // ============================================================================
  // RÉGIMEN ESTATUTO DE TRABAJADORES DE CONFIANZA "A"
  // ============================================================================
  {
    id: "ESTATUTO_MARK_0_CONTINUOUS",
    regime: "ESTATUTO",
    inclusionMark: 0,
    allowedFromContinuity: [0, 6],
    resultingContinuity: 0,
    upoDelta: 2,
    stage: "FULL_OR_CLOSED_OPTION",
    enjoyedDaysRule: { type: "FULL_ANNUAL" },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "FULL" },
    citation: {
      source: "ESTATUTO_CONFIANZA_A",
      clauseOrSection: "Estatuto de Trabajadores de Confianza A / Tabla 1A74-022-065 (Marca 0 desde 0 o 6 -> 0, +2 UPO)",
      ruleId: "ESTATUTO_MARK_0_CONTINUOUS",
    },
  },
  {
    id: "ESTATUTO_MARK_2_FIRST_PERIOD",
    regime: "ESTATUTO",
    inclusionMark: 2,
    allowedFromContinuity: [0, 6],
    resultingContinuity: 3,
    upoDelta: 1,
    stage: "FIRST_COMPLETE_PERIOD",
    enjoyedDaysRule: { type: "FRACTION", part: 1 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "ESTATUTO_CONFIANZA_A",
      clauseOrSection: "Estatuto de Trabajadores de Confianza A / Tabla 1A74-022-065 (Marca 2 desde 0 o 6 -> 3, +1 UPO)",
      ruleId: "ESTATUTO_MARK_2_FIRST_PERIOD",
    },
  },
  {
    id: "ESTATUTO_MARK_3_SECOND_PERIOD",
    regime: "ESTATUTO",
    inclusionMark: 3,
    allowedFromContinuity: [3],
    resultingContinuity: 6,
    upoDelta: 1,
    stage: "SECOND_COMPLETE_PERIOD",
    enjoyedDaysRule: { type: "FRACTION", part: 2 },
    concept029Rule: { type: "SAME_AS_ENJOYED" },
    concept048Rule: { type: "NONE" },
    citation: {
      source: "ESTATUTO_CONFIANZA_A",
      clauseOrSection: "Estatuto de Trabajadores de Confianza A / Tabla 1A74-022-065 (Marca 3 desde 3 -> 6, +1 UPO, compatible 0 o 2)",
      ruleId: "ESTATUTO_MARK_3_SECOND_PERIOD",
    },
  },
];

export function findVacationMarkRule(
  regime: VacationRegime,
  inclusionMark: number,
  currentContinuity = 0
): VacationMarkRule | undefined {
  return (
    VACATION_MARK_RULES.find(
      (r) =>
        r.regime === regime &&
        r.inclusionMark === inclusionMark &&
        r.allowedFromContinuity.includes(currentContinuity)
    ) ??
    VACATION_MARK_RULES.find(
      (r) => r.regime === regime && r.inclusionMark === inclusionMark
    )
  );
}
