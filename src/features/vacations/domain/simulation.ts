import type { VacationSimulationInput, VacationSimulationResult, RuleTrace, NormativeConflict, AnticipationResult } from "./types";
import { calculateCompletedYears, getCctAnnualDays, getEstatutoAnnualDays, getUnitsForInclusion } from "./entitlement";
import { applyInclusionMark, getCompatibleInclusionMarks } from "./continuity";
import { validateAnticipation, calculateReturnDate, isFirstPeriod } from "./validation";
import { detectNormativeConflicts } from "./conflicts";
import { getUnitType, getWorkScheduleForProfile } from "./schedules";
import { getMandatoryRestDatesForRange } from "./holidays";

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
  const proposedInclusionMark = input.selectedInclusionMark ?? 0;
  let resultingContinuityMark: number | undefined;
  let upoIncrement = 0;
  let transitionBlocked = false;

  const transitionResult = applyInclusionMark(regime, input.continuityMark, proposedInclusionMark);

  if ("error" in transitionResult) {
    transitionBlocked = true;
    warnings.push(transitionResult.error);
    const compatMarks = getCompatibleInclusionMarks(regime, input.continuityMark);
    compatibleOptions = compatMarks.map((m) => getFriendlyOptionName(regime, m, input.continuityMark));
  } else {
    resultingContinuityMark = transitionResult.nextContinuity;
    upoIncrement = transitionResult.upoIncrement;
  }

  traces.push({
    ruleCode: "APPLY_INCLUSION_MARK",
    result: transitionBlocked ? "BLOCKED" : "APPLIED",
    input: { regime, continuityMark: input.continuityMark, proposedInclusionMark },
    output: { resultingContinuityMark, upoIncrement },
    explanation: transitionBlocked
      ? `La marca de inclusión ${proposedInclusionMark} no es válida desde la continuidad ${input.continuityMark}.`
      : `Marca de continuidad ${input.continuityMark} → inclusión ${proposedInclusionMark} → continuidad resultante ${resultingContinuityMark}.`,
  });

  const unitType = getUnitType(input.workerProfile.workScheduleType ?? "ORDINARY");
  const vacationDays = cctDays;

  let unitsUsed: number | undefined;
  if (!transitionBlocked) {
    unitsUsed = getUnitsForInclusion(
      regime,
      vacationDays,
      proposedInclusionMark,
      completedYears,
      input.nextPeriodNumber
    );

    if ((regime === "SEMESTRAL" || regime === "ESTATUTO") && (proposedInclusionMark === 2 || proposedInclusionMark === 3)) {
      traces.push({
        ruleCode: "UNITS_COMPLETE_PERIOD",
        result: "APPLIED",
        input: { regime, inclusionMark: proposedInclusionMark, totalDays: vacationDays },
        output: unitsUsed,
        explanation: `La marca ${proposedInclusionMark} corresponde a un periodo completo dentro del año vacacional: la primera parte (marca 2) y la segunda (marca 3) equivalen cada una a la mitad semestral del periodo anual (${vacationDays} → ${Math.floor(vacationDays / 2)} + ${Math.ceil(vacationDays / 2)}). El desglose está sujeto a confirmación normativa.`,
      });
    }
  }

  const firstPeriod = isFirstPeriod(
    input.nextPeriodNumber,
    input.expiredVacationPeriods,
    input.enjoyedVacationDays
  );

  let anticipationResult: AnticipationResult | undefined;
  if (input.selectedStartDate && input.dueDate && !transitionBlocked) {
    anticipationResult = validateAnticipation(
      regime,
      input.dueDate,
      input.selectedStartDate,
      firstPeriod,
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
  const anticipationBlocked = anticipationResult ? !anticipationResult.allowed : false;
  if (input.selectedStartDate && !transitionBlocked && !anticipationBlocked && unitsUsed !== undefined) {
    const dateResult = calculateReturnDate(
      input.selectedStartDate,
      unitsUsed,
      unitType,
      input.workerProfile.weeklyRestDays ?? [],
      getMandatoryRestDatesForRange(input.selectedStartDate, 400),
      getWorkScheduleForProfile(input.workerProfile)
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
    status: transitionBlocked ? "BLOCKED" : "COMPUTED",
    regime,
    periodNumber: input.nextPeriodNumber,
    startDate: input.selectedStartDate,
    endDate: lastDate || undefined,
    returnDate: returnDateStr || undefined,
    unitsUsed,
    unitType,
    originalContinuityMark: input.continuityMark,
    proposedInclusionMark,
    resultingContinuityMark,
    affectedUPO: transitionBlocked ? undefined : input.nextPeriodNumber + upoIncrement,
    dueDate: input.dueDate,
    anticipationDays: anticipationResult?.daysInAdvance ?? 0,
    requiresSpecialProcess: transitionBlocked || anticipationBlocked,
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

function getFriendlyOptionName(regime: string, inclusionMark: number, currentContinuity: number): string {
  if (regime === "SEMESTRAL") {
    switch (inclusionMark) {
      case 0: return "Disfrutar el periodo de manera continua";
      case 1: return currentContinuity === 1
        ? "Completar la segunda parte"
        : "Dividirlo en dos partes semejantes (primera parte)";
      case 2: return "Solicitar un periodo completo (primera parte)";
      case 3: return "Completar la segunda parte del periodo";
      case 4: return currentContinuity === 9
        ? "Completar la segunda parte (modalidad especial)"
        : "Revisar una modalidad especial (primera parte)";
      case 9: return currentContinuity === 4
        ? "Completar la segunda parte (modalidad especial)"
        : "Revisar una modalidad especial (segunda parte)";
      default: return `Opción ${inclusionMark}`;
    }
  }
  if (regime === "CUATRIMESTRAL") {
    switch (inclusionMark) {
      case 0: return "Disfrutar el periodo en una sola parte (opción A)";
      case 2: return "Disfrutar el periodo en una sola parte (opción B)";
      case 5: return "Completar la segunda parte (opción B)";
      default: return `Opción ${inclusionMark}`;
    }
  }
  if (regime === "EXTRAORDINARIO_V20") {
    switch (inclusionMark) {
      case 0: return "Disfrutar el periodo extraordinario de manera continua";
      case 6: return "Solicitar la primera fracción extraordinaria";
      case 7: return "Completar la segunda fracción extraordinaria";
      case 8: return "Completar el periodo extraordinario";
      default: return `Opción ${inclusionMark}`;
    }
  }
  if (regime === "ESTATUTO") {
    switch (inclusionMark) {
      case 0: return "Disfrutar el periodo de manera continua";
      case 2: return "Solicitar un periodo completo (primera parte)";
      case 3: return "Completar la segunda parte del periodo";
      default: return `Opción ${inclusionMark}`;
    }
  }
  return `Opción compatible`;
}
