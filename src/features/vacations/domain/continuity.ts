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

export function getCompatibleCuatrimestralOptions(
  currentContinuity: CuatrimestralContinuity
): CuatrimestralStep[] {
  if ([0, 3, 14].includes(currentContinuity)) {
    return [...CUATRIMESTRAL_OPTION_A, ...CUATRIMESTRAL_OPTION_B];
  }
  if ([1, 2].includes(currentContinuity)) {
    const nextIdx = currentContinuity;
    if (nextIdx < CUATRIMESTRAL_OPTION_A.length) {
      return [CUATRIMESTRAL_OPTION_A[nextIdx]];
    }
  }
  if ([4, 9].includes(currentContinuity)) {
    if (currentContinuity === 4) return [CUATRIMESTRAL_OPTION_B[1]];
    if (currentContinuity === 9) return [CUATRIMESTRAL_OPTION_B[2]];
  }
  return [];
}

export function getCompatibleV20Options(currentContinuity: V20Continuity): V20InclusionMark[] {
  switch (currentContinuity) {
    case 0: return [0, 6];
    case 1: return [];
    case 2: return [7];
    case 3: return [8];
    default: return [];
  }
}

const V20_TRANSITIONS: {
  currentContinuity: V20Continuity;
  inclusionMark: V20InclusionMark;
  nextContinuity: V20Continuity;
  upoIncrement: number;
}[] = [
  { currentContinuity: 0, inclusionMark: 0, nextContinuity: 1, upoIncrement: 2 },
  { currentContinuity: 0, inclusionMark: 6, nextContinuity: 2, upoIncrement: 1 },
  { currentContinuity: 2, inclusionMark: 7, nextContinuity: 3, upoIncrement: 1 },
  { currentContinuity: 3, inclusionMark: 8, nextContinuity: 0, upoIncrement: 1 },
];

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
    if (!step) return { error: "Esta marca de inclusión no es compatible con tu estado actual." };
    const stage = step.option === "A" ? "CUATRIMESTRAL_SEQUENCE_A" : "CUATRIMESTRAL_SEQUENCE_B";
    return { nextContinuity: step.nextContinuity, upoIncrement: 1, stage };
  }
  if (regime === "EXTRAORDINARIO_V20") {
    const transition = V20_TRANSITIONS.find(
      (t) => t.currentContinuity === (currentContinuity as V20Continuity) && t.inclusionMark === (inclusionMark as V20InclusionMark)
    );
    if (!transition) {
      return { error: "Esta marca de inclusión no es compatible con tu estado actual del periodo extraordinario V20." };
    }
    return { nextContinuity: transition.nextContinuity, upoIncrement: transition.upoIncrement, stage: "FULL_OR_CLOSED_OPTION" };
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
  if (regime === "EXTRAORDINARIO_V20") return continuity === 0 || continuity === 3;
  if (regime === "ESTATUTO") return [0, 6].includes(continuity);
  return false;
}
