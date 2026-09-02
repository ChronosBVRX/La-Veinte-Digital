import type {
  SemestralContinuity, SemestralInclusionMark,
  CuatrimestralContinuity,
  V20Continuity, V20InclusionMark,
  SemestralTransition, CuatrimestralStep, VacationStage,
} from "./types";

export const SEMESTRAL_TRANSITIONS: SemestralTransition[] = [
  { currentContinuity: [0, 2, 6, 13], inclusionMark: 0, stage: "FULL_OR_CLOSED_OPTION", nextContinuity: 0, upoIncrement: 2 },
  { currentContinuity: [0, 2, 6, 13], inclusionMark: 1, stage: "FIRST_FRACTION", nextContinuity: 1, upoIncrement: 1 },
  { currentContinuity: [1], inclusionMark: 1, stage: "SECOND_FRACTION", nextContinuity: 2, upoIncrement: 1 },
  { currentContinuity: [0, 2, 6, 13], inclusionMark: 2, stage: "FIRST_COMPLETE_PERIOD", nextContinuity: 3, upoIncrement: 1 },
  { currentContinuity: [3], inclusionMark: 3, stage: "SECOND_COMPLETE_PERIOD", nextContinuity: 6, upoIncrement: 1 },
  { currentContinuity: [0, 2, 6, 13], inclusionMark: 4, stage: "FIRST_FRACTION_4_9", nextContinuity: 4, upoIncrement: 1 },
  { currentContinuity: [4], inclusionMark: 9, stage: "SECOND_FRACTION_4_9", nextContinuity: 13, upoIncrement: 1 },
  { currentContinuity: [0, 2, 6, 13], inclusionMark: 9, stage: "FIRST_FRACTION_9_4", nextContinuity: 9, upoIncrement: 1 },
  { currentContinuity: [9], inclusionMark: 4, stage: "SECOND_FRACTION_9_4", nextContinuity: 13, upoIncrement: 1 },
];

export const SEMESTRAL_CLOSED_STATES: SemestralContinuity[] = [0, 2, 6, 13];

const CUATRIMESTRAL_OPTION_A: CuatrimestralStep[] = [
  { periodIndex: 1, inclusionMark: 0, nextContinuity: 1, option: "A" },
  { periodIndex: 2, inclusionMark: 0, nextContinuity: 2, option: "A" },
  { periodIndex: 3, inclusionMark: 0, nextContinuity: 3, option: "A" },
];

const CUATRIMESTRAL_OPTION_B: CuatrimestralStep[] = [
  { periodIndex: 1, inclusionMark: 2, nextContinuity: 4, option: "B" },
  { periodIndex: 2, inclusionMark: 5, nextContinuity: 9, option: "B" },
  { periodIndex: 3, inclusionMark: 5, nextContinuity: 14, option: "B" },
];

export function getSemestralTransition(
  currentContinuity: SemestralContinuity,
  inclusionMark: SemestralInclusionMark
): SemestralTransition | undefined {
  return SEMESTRAL_TRANSITIONS.find(
    (t) => t.currentContinuity.includes(currentContinuity) && t.inclusionMark === inclusionMark
  );
}

export function getCompatibleSemestralInclusionMarks(
  currentContinuity: SemestralContinuity
): SemestralInclusionMark[] {
  return SEMESTRAL_TRANSITIONS
    .filter((t) => t.currentContinuity.includes(currentContinuity))
    .map((t) => t.inclusionMark);
}

function getCompatibleEstatutoMarks(currentContinuity: number): number[] {
  if (currentContinuity === 0) return [0, 2];
  if (currentContinuity === 3) return [3];
  if (currentContinuity === 6) return [0];
  return [];
}

/**
 * Marcas de inclusión compatibles desde una continuidad dada, por régimen.
 * Es la versión no semestral de `getCompatibleSemestralInclusionMarks`:
 * CUATRIMESTRAL deriva de las opciones A/B, V20 y ESTATUTO de sus transiciones.
 */
export function getCompatibleInclusionMarks(
  regime: "SEMESTRAL" | "CUATRIMESTRAL" | "EXTRAORDINARIO_V20" | "ESTATUTO",
  currentContinuity: number
): number[] {
  switch (regime) {
    case "SEMESTRAL":
      return getCompatibleSemestralInclusionMarks(currentContinuity as SemestralContinuity);
    case "CUATRIMESTRAL":
      return getCompatibleCuatrimestralOptions(currentContinuity as CuatrimestralContinuity)
        .map((s) => s.inclusionMark);
    case "EXTRAORDINARIO_V20":
      return getCompatibleV20Options(currentContinuity as V20Continuity);
    case "ESTATUTO":
      return getCompatibleEstatutoMarks(currentContinuity);
    default:
      return [];
  }
}

export function getCompatibleCuatrimestralOptions(
  currentContinuity: CuatrimestralContinuity
): CuatrimestralStep[] {
  // Los estados cerrados (0, 3, 14) solo pueden reabrirse mediante una nueva inclusión 0 o 2.
  if ([0, 3, 14].includes(currentContinuity)) {
    return [CUATRIMESTRAL_OPTION_A[0], CUATRIMESTRAL_OPTION_B[0]];
  }
  if (currentContinuity === 1) {
    return [CUATRIMESTRAL_OPTION_A[1]];
  }
  if (currentContinuity === 2) {
    return [CUATRIMESTRAL_OPTION_A[2]];
  }
  if (currentContinuity === 4) {
    return [CUATRIMESTRAL_OPTION_B[1]];
  }
  if (currentContinuity === 9) {
    return [CUATRIMESTRAL_OPTION_B[2]];
  }
  return [];
}

export function getCompatibleV20Options(currentContinuity?: V20Continuity): V20InclusionMark[] {
  void currentContinuity;
  // En V20 nunca se fracciona: las 4 opciones normativas (0, 6, 7, 8) están disponibles
  return [0, 6, 7, 8];
}

export function applyInclusionMark(
  regime: "SEMESTRAL" | "CUATRIMESTRAL" | "EXTRAORDINARIO_V20" | "ESTATUTO",
  currentContinuity: number,
  inclusionMark: number
): { nextContinuity: number; upoIncrement: number; stage: VacationStage } | { error: string } {
  if (regime === "SEMESTRAL") {
    const transition = getSemestralTransition(currentContinuity as SemestralContinuity, inclusionMark as SemestralInclusionMark);
    if (!transition) return { error: "Esta combinación no es compatible. Primero debes completar la parte anterior de tus vacaciones." };
    return { nextContinuity: transition.nextContinuity, upoIncrement: transition.upoIncrement, stage: transition.stage };
  }
  if (regime === "CUATRIMESTRAL") {
    const options = getCompatibleCuatrimestralOptions(currentContinuity as CuatrimestralContinuity);
    const step = options.find((s) => s.inclusionMark === inclusionMark);
    if (!step) return { error: "Esta marca de inclusión no es compatible con tu estado actual en el régimen cuatrimestral." };
    const stage = step.option === "A" ? "CUATRIMESTRAL_SEQUENCE_A" : "CUATRIMESTRAL_SEQUENCE_B";
    return { nextContinuity: step.nextContinuity, upoIncrement: 1, stage };
  }
  if (regime === "EXTRAORDINARIO_V20") {
    if (![0, 6, 7, 8].includes(inclusionMark as V20InclusionMark)) {
      return { error: "Las vacaciones extraordinarias V20 no admiten fraccionamiento. Solo admiten las opciones 0, 6, 7 y 8." };
    }
    // Cada opción de V20 suma 1 UPO y cierra el ejercicio
    return { nextContinuity: 0, upoIncrement: 1, stage: "FULL_OR_CLOSED_OPTION" };
  }
  if (regime === "ESTATUTO") {
    if (currentContinuity === 0 && inclusionMark === 0) {
      return { nextContinuity: 0, upoIncrement: 2, stage: "FULL_OR_CLOSED_OPTION" };
    }
    if (currentContinuity === 0 && inclusionMark === 2) {
      return { nextContinuity: 3, upoIncrement: 1, stage: "FIRST_COMPLETE_PERIOD" };
    }
    if (currentContinuity === 3 && inclusionMark === 3) {
      return { nextContinuity: 6, upoIncrement: 1, stage: "SECOND_COMPLETE_PERIOD" };
    }
    if (currentContinuity === 6 && inclusionMark === 0) {
      return { nextContinuity: 0, upoIncrement: 2, stage: "FULL_OR_CLOSED_OPTION" };
    }
    return { error: "Marca de inclusión no válida desde tu estado actual en el régimen Estatuto." };
  }
  return { error: "Régimen no reconocido." };
}

export function isCycleClosed(regime: string, continuity: number): boolean {
  if (regime === "SEMESTRAL") return SEMESTRAL_CLOSED_STATES.includes(continuity as SemestralContinuity);
  if (regime === "CUATRIMESTRAL") return [0, 3, 14].includes(continuity);
  if (regime === "EXTRAORDINARIO_V20") return true;
  if (regime === "ESTATUTO") return [0, 6].includes(continuity);
  return false;
}
