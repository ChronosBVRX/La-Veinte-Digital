import type { VacationSimulationInput, VacationSimulationResult, RuleTrace, NormativeConflict, AnticipationResult } from "./types";
import { calculateCompletedYears, getCctAnnualDays, getEstatutoAnnualDays, getVacationDivision, determineVacationRegime } from "./entitlement";
import { applyInclusionMark, getCompatibleSemestralInclusionMarks } from "./continuity";
import { validateAnticipation, calculateReturnDate } from "./validation";
import { detectNormativeConflicts } from "./conflicts";
import { getUnitType } from "./schedules";

export function buildSimulationResult(input: VacationSimulationInput): VacationSimulationResult {
  const traces: RuleTrace[] = [];
  const warnings: string[] = [];
  const completedYears = calculateCompletedYears(input.workerProfile.effectiveSeniority);

  traces.push({
    ruleCode: "CALC_COMPLETED_YEARS",
    result: "APPLIED",
    input: input.workerProfile.effectiveSeniority,
    output: completedYears,
    explanation: `Antigüedad efectiva: ${completedYears} años.`,
  });

  const regime = input.regime;

  const cctDays = regime === "ESTATUTO"
    ? getEstatutoAnnualDays(completedYears)
    : getCctAnnualDays(completedYears);

  traces.push({
    ruleCode: regime === "ESTATUTO" ? "ESTATUTO_ANNUAL_DAYS" : "CCT_ANNUAL_DAYS",
    result: "APPLIED",
    input: { completedYears },
    output: cctDays,
    explanation: `Días hábiles anuales según ${regime === "ESTATUTO" ? "Estatuto" : "CCT"}: ${cctDays}.`,
  });

  let compatibleOptions: string[] = [];
  let proposedInclusionMark = input.selectedInclusionMark ?? 0;
  let resultingContinuityMark = input.continuityMark;
  let upoIncrement = 0;

  const transitionResult = applyInclusionMark(regime, input.continuityMark, proposedInclusionMark);

  if ("error" in transitionResult) {
    warnings.push(transitionResult.error);
    const compatMarks = getCompatibleSemestralInclusionMarks(input.continuityMark as any);
    compatibleOptions = compatMarks.map((m) => getFriendlyOptionName(regime, m));
  } else {
    resultingContinuityMark = transitionResult.nextContinuity;
    upoIncrement = transitionResult.upoIncrement;
  }

  traces.push({
    ruleCode: "APPLY_INCLUSION_MARK",
    result: "APPLIED",
    input: { regime, continuityMark: input.continuityMark, proposedInclusionMark },
    output: { resultingContinuityMark, upoIncrement },
    explanation: `Marca de continuidad ${input.continuityMark} → inclusión ${proposedInclusionMark} → continuidad resultante ${resultingContinuityMark}.`,
  });

  const unitType = getUnitType(input.workerProfile.workScheduleType ?? "ORDINARY");
  const vacationDays = cctDays;

  const [firstPart] = getVacationDivision(vacationDays);

  let anticipationResult: AnticipationResult | undefined;
  if (input.selectedStartDate && input.dueDate) {
    anticipationResult = validateAnticipation(
      regime,
      input.dueDate,
      input.selectedStartDate,
      false,
      completedYears
    );
    traces.push({
      ruleCode: "VALIDATE_ANTICIPATION",
      result: anticipationResult.allowed ? "APPLIED" : "BLOCKED",
      input: { regime, dueDate: input.dueDate, requestedStartDate: input.selectedStartDate, completedYears },
      output: anticipationResult,
      explanation: anticipationResult.friendlyMessage,
    });
    if (!anticipationResult.allowed) {
      warnings.push(anticipationResult.friendlyMessage);
    }
  }

  let lastDate = "";
  let returnDateStr = "";
  if (input.selectedStartDate) {
    const dateResult = calculateReturnDate(
      input.selectedStartDate,
      firstPart,
      unitType,
      input.workerProfile.weeklyRestDays ?? [],
      getMandatoryRestDates(input.selectedStartDate)
    );
    lastDate = dateResult.lastDate;
    returnDateStr = dateResult.returnDate;
  }

  const normativeConflicts: NormativeConflict[] = detectNormativeConflicts(
    regime,
    completedYears,
    proposedInclusionMark,
    0,
    cctDays
  );

  if (normativeConflicts.length > 0) {
    traces.push({
      ruleCode: "DETECT_NORMATIVE_CONFLICTS",
      result: "WARNING",
      input: { regime, completedYears, inclusionMark: proposedInclusionMark, cctDays },
      output: normativeConflicts,
      explanation: `Se detectaron ${normativeConflicts.length} conflicto(s) normativo(s).`,
    });
  }

  const requiresNormativeReview = normativeConflicts.some((c) => c.requiresReview);

  return {
    regime,
    periodNumber: input.nextPeriodNumber,
    startDate: input.selectedStartDate,
    endDate: lastDate || undefined,
    returnDate: returnDateStr || undefined,
    unitsUsed: firstPart,
    unitType,
    originalContinuityMark: input.continuityMark,
    proposedInclusionMark,
    resultingContinuityMark,
    affectedUPO: input.nextPeriodNumber + upoIncrement,
    dueDate: input.dueDate,
    anticipationDays: anticipationResult?.daysInAdvance ?? 0,
    requiresSpecialProcess: false,
    requiresNormativeReview,
    normativeConflicts,
    warnings,
    traces,
    calendarVersion: input.calendarId,
    ruleVersionId: "v1",
    compatibleOptions: compatibleOptions.length > 0 ? compatibleOptions : undefined,
    anticipationResult,
  };
}

function getFriendlyOptionName(regime: string, inclusionMark: number): string {
  if (regime === "SEMESTRAL") {
    switch (inclusionMark) {
      case 0: return "Disfrutar el periodo de manera continua";
      case 1: return "Dividirlo en dos partes semejantes (primera parte)";
      case 2: return "Solicitar un periodo completo (primera parte)";
      case 3: return "Completar la segunda parte del periodo";
      case 4: return "Revisar una modalidad especial (primera parte)";
      case 9: return "Revisar una modalidad especial (segunda parte)";
      default: return `Opción ${inclusionMark}`;
    }
  }
  return `Opción compatible`;
}

function getMandatoryRestDates(startDate: string): string[] {
  const year = new Date(startDate).getFullYear();
  return [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-10`,
    `${year}-09-15`,
    `${year}-09-16`,
    `${year}-12-25`,
  ];
}
