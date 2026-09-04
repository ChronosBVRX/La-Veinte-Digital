import type { ContractType, EffectiveSeniority, VacationRegime } from "./types";
const CCT_ANNUAL_DAYS_MIN = 16;
const CCT_ANNUAL_DAYS_MAX = 20;


export const RADIATION_DAYS_BY_SENIORITY: Record<number, [number, number, number]> = {
  1: [7, 8, 7],
  2: [8, 8, 8],
  3: [8, 9, 8],
  4: [9, 9, 9],
  5: [9, 10, 9],
};

export function getCctAnnualDays(completedYears: number): number {
  if (completedYears < 1) return 0;
  return Math.min(CCT_ANNUAL_DAYS_MIN + (completedYears - 1), CCT_ANNUAL_DAYS_MAX);
}

export function getEstatutoAnnualDays(completedYears: number): number {
  if (completedYears < 1) return 0;
  if (completedYears === 1) return 16;
  if (completedYears === 2) return 17;
  if (completedYears === 3) return 18;
  if (completedYears === 4) return 19;
  if (completedYears === 5) return 20;
  if (completedYears >= 6 && completedYears <= 10) return 22;
  if (completedYears >= 11 && completedYears <= 15) return 24;
  if (completedYears >= 16 && completedYears <= 20) return 26;
  if (completedYears >= 21 && completedYears <= 25) return 28;
  if (completedYears >= 26 && completedYears <= 30) return 30;
  if (completedYears >= 31 && completedYears <= 35) return 32;
  const extraQuinquennia = Math.floor((completedYears - 35) / 5);
  return 32 + extraQuinquennia * 2;
}

export function getRadiationDaysForPeriod(completedYears: number, periodIndex: 0 | 1 | 2): number {
  if (completedYears <= 1) return RADIATION_DAYS_BY_SENIORITY[1][periodIndex];
  if (completedYears === 2) return RADIATION_DAYS_BY_SENIORITY[2][periodIndex];
  if (completedYears === 3) return RADIATION_DAYS_BY_SENIORITY[3][periodIndex];
  if (completedYears === 4) return RADIATION_DAYS_BY_SENIORITY[4][periodIndex];
  if (completedYears === 5) return RADIATION_DAYS_BY_SENIORITY[5][periodIndex];
  return 10;
}

export function calculateCompletedYears(seniority: EffectiveSeniority): number {
  return seniority.years;
}

/**
 * Días de ayuda para actividades culturales y recreativas (concepto 048) según
 * la Cláusula 47 del CCT IMSS-SNTSS.
 */
export function getCctCulturalHelpDays(completedYears: number): number {
  if (completedYears < 1) return 0;
  if (completedYears === 1) return 23;
  if (completedYears === 2) return 25;
  if (completedYears === 3) return 27;
  if (completedYears === 4) return 29;
  return 31;
}

export const RADIATION_CULTURAL_HELP_DAYS: Record<number | "MORE_THAN_5", number> = {
  1: 8.6,
  2: 9.3,
  3: 10.6,
  4: 11.3,
  5: 12.6,
  MORE_THAN_5: 13.3,
};

/**
 * Días de ayuda para actividades culturales y recreativas (concepto 048) por periodo
 * para trabajadores cuatrimestrales expuestos a emanaciones radiactivas
 * según Procedimiento 1A74-003-025, Anexo 1.
 */
export function getRadiationCulturalHelpDays(completedYears: number): number {
  if (completedYears <= 1) return 8.6;
  if (completedYears === 2) return 9.3;
  if (completedYears === 3) return 10.6;
  if (completedYears === 4) return 11.3;
  if (completedYears === 5) return 12.6;
  return 13.3;
}

export function determineVacationRegime(
  contractType: ContractType,
  completedYears: number,
  hasContinuousRadiationExposure: boolean | "UNSURE",
  hasV20Mark: boolean
): VacationRegime {
  if (contractType === "CONFIANZA_A_ESTATUTO") return "ESTATUTO";
  if (hasV20Mark && completedYears >= 20) return "EXTRAORDINARIO_V20";
  if (hasContinuousRadiationExposure === true) return "CUATRIMESTRAL";
  if (hasContinuousRadiationExposure === "UNSURE") return "SEMESTRAL";
  return "SEMESTRAL";
}

export function getVacationDivision(totalDays: number): [number, number] {
  return [Math.floor(totalDays / 2), Math.ceil(totalDays / 2)];
}

/**
 * Unidades a disfrutar según régimen e inclusión.
 * - CUATRIMESTRAL: tabla RADIATION_DAYS por periodo (0|1|2) del año.
 * - EXTRAORDINARIO_V20: 15 días por fracción (marca 6/7/8) o el total (marca 0).
 * - SEMESTRAL/ESTATUTO: completo (marca 0), primera parte (1/2/4) o segunda (3/9).
 *
 * Nota normativa (hallazgo de auditoría #9): las marcas 2 y 3 ("periodo
 * completo") devuelven la mitad del año vacacional (floor/ceil), no el total.
 * Es el desglose semestral esperado: cada "periodo completo" corresponde a la
 * mitad del año y ambas partes suman el total anual. Sin embargo, la semántica
 * exacta de la marca está sujeta a confirmación con la normativa vigente; el
 * motor no la corrige por intuición y expone el desglose en la traza
 * `UNITS_COMPLETE_PERIOD` para revisión.
 */
export function getUnitsForInclusion(
  regime: VacationRegime,
  totalDays: number,
  inclusionMark: number,
  completedYears: number,
  nextPeriodNumber: number
): number {
  if (regime === "CUATRIMESTRAL") {
    const periodIndex = ((Math.max(1, nextPeriodNumber) - 1) % 3) as 0 | 1 | 2;
    return getRadiationDaysForPeriod(completedYears, periodIndex);
  }
  if (regime === "EXTRAORDINARIO_V20") {
    if (inclusionMark === 0) return 10;
    if (inclusionMark === 6) return 15;
    if (inclusionMark === 7) return 0;
    if (inclusionMark === 8) return 0;
    return 10;
  }
  const [firstPart, secondPart] = getVacationDivision(totalDays);
  if (inclusionMark === 0) return totalDays;
  if (inclusionMark === 1 || inclusionMark === 2 || inclusionMark === 4) return firstPart;
  if (inclusionMark === 3 || inclusionMark === 9) return secondPart;
  return totalDays;
}

export function isEligibleForV20(completedYears: number): boolean {
  return completedYears >= 20;
}
