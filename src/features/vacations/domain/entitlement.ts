import type { ContractType, EffectiveSeniority, VacationRegime } from "./types";
const CCT_ANNUAL_DAYS_MIN = 16;
const CCT_ANNUAL_DAYS_MAX = 20;

const ESTATUTO_DAYS: Record<number, number> = {
  1: 16, 2: 17, 3: 18, 4: 19, 5: 20,
  10: 22, 15: 24, 20: 26, 25: 28, 30: 30, 35: 32,
};

const RADIATION_DAYS: Record<number, number[]> = {
  0: [7, 8, 7],
  1: [8, 8, 8],
  2: [8, 9, 8],
  3: [9, 9, 9],
  4: [9, 10, 9],
  5: [10, 10, 10],
};

export function getCctAnnualDays(completedYears: number): number {
  if (completedYears < 1) return 0;
  return Math.min(CCT_ANNUAL_DAYS_MIN + (completedYears - 1), CCT_ANNUAL_DAYS_MAX);
}

export function getEstatutoAnnualDays(completedYears: number): number {
  if (completedYears < 1) return 0;
  if (completedYears <= 35) {
    const thresholds = Object.keys(ESTATUTO_DAYS).map(Number).sort((a, b) => a - b);
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (completedYears >= thresholds[i]) {
        return ESTATUTO_DAYS[thresholds[i]];
      }
    }
  }
  const base = 32;
  const extraQuinquennia = Math.floor(Math.max(0, completedYears - 35) / 5);
  return base + extraQuinquennia * 2;
}

export function getRadiationDaysForPeriod(completedYears: number, periodIndex: 0 | 1 | 2): number {
  const index = Math.min(completedYears, 5);
  return RADIATION_DAYS[index][periodIndex];
}

export function calculateCompletedYears(seniority: EffectiveSeniority): number {
  return seniority.years;
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
    if (inclusionMark === 0) return totalDays;
    return 15;
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
