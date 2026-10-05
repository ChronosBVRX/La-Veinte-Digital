import type { ContractType, EffectiveSeniority, VacationEntitlementUnits, VacationRegime, WorkScheduleType } from "./types";
import { RADIATION_DAYS_BY_SENIORITY as NORMATIVE_RADIATION_DAYS } from "./normative-rules-table";
import { ACCUMULATED_DAY_JOURNEYS, ACCUMULATED_NIGHT_VELADAS } from "./schedules";

const CCT_ANNUAL_DAYS_MIN = 16;
const CCT_ANNUAL_DAYS_MAX = 20;

/**
 * Tabla contractual de días hábiles por periodo cuatrimestral para personal
 * expuesto a emanaciones radiactivas (Cláusula 47 del CCT IMSS-SNTSS):
 * 0 años (primer año): [7, 8, 7] = 22
 * 1 año:  [8, 8, 8] = 24
 * 2 años: [8, 9, 8] = 25
 * 3 años: [9, 9, 9] = 27
 * 4 años: [9, 10, 9] = 28
 * 5+ años: [10, 10, 10] = 30
 */
export const RADIATION_DAYS_BY_SENIORITY: Record<number, [number, number, number]> = NORMATIVE_RADIATION_DAYS;

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
  const normalizedYears = Math.max(0, Math.min(5, Math.floor(completedYears)));
  return RADIATION_DAYS_BY_SENIORITY[normalizedYears][periodIndex];
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
 * Calcula los días del segundo periodo vacacional (Marca 3 en régimen semestral: 10 a 15 días hábiles)
 * conforme a la Cláusula 47 del CCT y la Tabla de Marcas 1A74-022-065.
 */
export function getSecondCompletePeriodDays(completedYears: number, totalDays?: number): number {
  const baseDays = totalDays && totalDays >= 15 ? totalDays : Math.max(15, getCctAnnualDays(completedYears));
  return Math.min(15, Math.max(10, baseDays - 5));
}

/**
 * Unidades (días hábiles de derecho vacacional) a disfrutar según régimen, marca de inclusión
 * y estado de continuidad actual, conforme a Cláusula 47 del CCT y Tabla 1A74-022-065:
 * - CUATRIMESTRAL: tabla RADIATION_DAYS_BY_SENIORITY (0..5+) por periodo (0|1|2) en Marca 0,
 *   o 15 días hábiles por cuatrimestre en Modalidad B (Marcas 2 y 5).
 * - EXTRAORDINARIO_V20: Marca 0 (10 días), Marca 6 (15 días), Marca 7 (0 días), Marca 8 (0 días).
 * - ESTATUTO: Marca 0 (totalDays), Marca 2 (primera mitad), Marca 3 (segunda mitad).
 * - SEMESTRAL:
 *   - Marca 0: periodo único anual continuo (15 a 20 días: totalDays).
 *   - Marca 1: primera fracción (7–10 días = floor(totalDays/2)) cuando inicia ciclo,
 *              segunda fracción (8–10 días = ceil(totalDays/2)) cuando cierra desde continuidad 1.
 *   - Marca 2: disfruta primer periodo completo continuo de 15 a 20 días (sin 048, abre continuidad 3).
 *   - Marca 3: disfruta segundo periodo de 10 a 15 días según antigüedad efectiva (sin 048, cierra continuidad 6).
 *   - Marca 4 / Marca 9: primera fracción (floor) al abrir ciclo, segunda fracción (ceil) al cerrar ciclo.
 */
export function getUnitsForInclusion(
  regime: VacationRegime,
  totalDays: number,
  inclusionMark: number,
  completedYears: number,
  nextPeriodNumber: number,
  currentContinuity?: number
): number {
  if (regime === "CUATRIMESTRAL") {
    // Cláusula 47, párrafo 16 del CCT: Modalidad B (Mayor Descanso con Marcas 2 y 5)
    // otorga hasta 15 días hábiles en cada periodo cuatrimestral a cambio de no percibir la ayuda 048.
    if (inclusionMark === 2 || inclusionMark === 5) {
      return 15;
    }
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

  if (regime === "ESTATUTO") {
    if (inclusionMark === 0) return totalDays;
    if (inclusionMark === 2) return firstPart;
    if (inclusionMark === 3) return secondPart;
    return totalDays;
  }

  // Régimen SEMESTRAL
  if (inclusionMark === 0) return totalDays;
  if (inclusionMark === 1) {
    if (currentContinuity === 1) return secondPart;
    return firstPart;
  }
  if (inclusionMark === 2) {
    return Math.min(20, Math.max(15, totalDays));
  }
  if (inclusionMark === 3) {
    return getSecondCompletePeriodDays(completedYears, totalDays);
  }
  if (inclusionMark === 4) {
    if (currentContinuity === 9) return secondPart;
    return firstPart;
  }
  if (inclusionMark === 9) {
    if (currentContinuity === 4) return secondPart;
    if (currentContinuity !== undefined) return firstPart;
    return secondPart;
  }
  return totalDays;
}

/**
 * Desacopla los días hábiles de vacaciones (para prima 029 y derecho sustantivo)
 * de su equivalencia en jornadas/veladas de ausencia para trabajadores de jornada acumulada
 * (Procedimiento 1A74-003-025).
 */
export function resolveVacationEntitlementUnits(
  vacationDays: number,
  scheduleType: WorkScheduleType = "ORDINARY"
): VacationEntitlementUnits {
  if (scheduleType === "ACCUMULATED_WEEKEND_DAY") {
    const journeyEquivalent = ACCUMULATED_DAY_JOURNEYS[vacationDays] ?? Math.max(1, Math.round(vacationDays * 0.4));
    return {
      vacationDays,
      journeyEquivalent,
      journeyType: "JOURNEY",
    };
  }
  if (scheduleType === "ACCUMULATED_NIGHT") {
    const journeyEquivalent = ACCUMULATED_NIGHT_VELADAS[vacationDays] ?? Math.max(1, Math.round(vacationDays * 0.6));
    return {
      vacationDays,
      journeyEquivalent,
      journeyType: "VELADA",
    };
  }
  return {
    vacationDays,
    journeyEquivalent: vacationDays,
    journeyType: "WORKDAY",
  };
}

export function isEligibleForV20(completedYears: number): boolean {
  return completedYears >= 20;
}
