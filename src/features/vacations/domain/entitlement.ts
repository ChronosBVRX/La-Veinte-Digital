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

export function isEligibleForV20(completedYears: number): boolean {
  return completedYears >= 20;
}
