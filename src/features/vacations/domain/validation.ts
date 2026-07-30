import type { VacationRegime, VacationRole, EffectiveSeniority, AnticipationResult, VacationDateCalculationInput, VacationDateCalculationResult, WorkScheduleDefinition } from "./types";
import { isWeeklyRest, isMandatoryRest } from "./holidays";
import { isWorkDay, getUnitType } from "./schedules";

export function validateAnticipation(
  regime: VacationRegime,
  dueDate: string,
  requestedStartDate: string,
  isFirstPeriod: boolean,
  completedYears: number
): AnticipationResult {
  const maxAnticipationDays = getMaxAnticipation(regime);
  const due = new Date(dueDate);
  const requested = new Date(requestedStartDate);
  const diffMs = due.getTime() - requested.getTime();
  const daysInAdvance = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (isFirstPeriod && completedYears < 1) {
    return {
      allowed: false,
      dueDate,
      earliestAllowedDate: dueDate,
      requestedDate: requestedStartDate,
      daysInAdvance,
      reasonCode: "FIRST_PERIOD_BEFORE_YEAR",
      friendlyMessage: "Tu primer periodo vacacional no puede solicitarse antes de cumplir tu primer año de servicio.",
    };
  }

  if (daysInAdvance < 0) {
    return {
      allowed: false,
      dueDate,
      earliestAllowedDate: getEarliestDate(dueDate, 0),
      requestedDate: requestedStartDate,
      daysInAdvance,
      reasonCode: "AFTER_DUE_DATE",
      friendlyMessage: "La fecha solicitada es posterior a la fecha de vencimiento. Debes programar antes del vencimiento.",
    };
  }

  if (daysInAdvance > maxAnticipationDays) {
    const earliest = getEarliestDate(dueDate, maxAnticipationDays);
    return {
      allowed: false,
      dueDate,
      earliestAllowedDate: earliest,
      requestedDate: requestedStartDate,
      daysInAdvance,
      reasonCode: "EXCEEDS_ANTICIPATION",
      friendlyMessage: `La fecha más próxima que podrías programar es el ${earliest}. Solo puedes anticipar hasta ${maxAnticipationDays} días antes del vencimiento.`,
    };
  }

  return {
    allowed: true,
    dueDate,
    earliestAllowedDate: getEarliestDate(dueDate, maxAnticipationDays),
    requestedDate: requestedStartDate,
    daysInAdvance,
    friendlyMessage: `La fecha está dentro del límite de ${maxAnticipationDays} días de anticipación.`,
  };
}

function getMaxAnticipation(regime: VacationRegime): number {
  switch (regime) {
    case "SEMESTRAL": return 120;
    case "CUATRIMESTRAL": return 105;
    case "EXTRAORDINARIO_V20": return 120;
    case "ESTATUTO": return 120;
    default: return 120;
  }
}

function getEarliestDate(dueDate: string, maxDays: number): string {
  const d = new Date(dueDate);
  d.setDate(d.getDate() - maxDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calculateVacationRange(input: VacationDateCalculationInput): VacationDateCalculationResult {
  const excludedWeeklyRestDates: string[] = [];
  const excludedMandatoryRestDates: string[] = [];
  const consumedDates: string[] = [];
  const start = new Date(input.startDate);
  let vacationUnits = 0;
  let i = 0;

  while (vacationUnits < input.entitlementUnits) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDate(d);

    const isRest = isWeeklyRest(dateStr, input.weeklyRestDays);
    const isMand = isMandatoryRest(dateStr, input.mandatoryRestDates);
    const isWorkable = isWorkDay(dateStr, input.workSchedule);

    if (isRest) {
      excludedWeeklyRestDates.push(dateStr);
    } else if (isMand) {
      excludedMandatoryRestDates.push(dateStr);
    } else if (input.unitType === "WORKDAY" || isWorkable) {
      consumedDates.push(dateStr);
      vacationUnits++;
    } else {
      consumedDates.push(dateStr);
      vacationUnits++;
    }
    i++;
    if (i > 365) break;
  }

  const lastDate = consumedDates[consumedDates.length - 1];
  const returnDate = getReturnDate(lastDate, input.weeklyRestDays, input.mandatoryRestDates, input.workSchedule);

  return {
    startDate: input.startDate,
    lastVacationDate: lastDate,
    returnToWorkDate: returnDate,
    consumedDates,
    excludedWeeklyRestDates,
    excludedMandatoryRestDates,
    totalCalendarDays: consumedDates.length + excludedWeeklyRestDates.length + excludedMandatoryRestDates.length,
    totalVacationUnits: input.entitlementUnits,
  };
}

function getReturnDate(
  lastVacationDate: string,
  weeklyRestDays: number[],
  mandatoryDates: string[],
  schedule: WorkScheduleDefinition
): string {
  const d = new Date(lastVacationDate);
  d.setDate(d.getDate() + 1);
  let attempts = 0;
  while (attempts < 30) {
    const dateStr = formatDate(d);
    if (!isWeeklyRest(dateStr, weeklyRestDays) && !isMandatoryRest(dateStr, mandatoryDates) && isWorkDay(dateStr, schedule)) {
      return dateStr;
    }
    d.setDate(d.getDate() + 1);
    attempts++;
  }
  return formatDate(d);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function validateModification(
  originallyScheduledDate: string,
  newDate: string
): { allowed: boolean; requiresSpecialProcess: boolean; friendlyMessage: string } {
  const original = new Date(originallyScheduledDate);
  const proposed = new Date(newDate);
  const diffMs = original.getTime() - proposed.getTime();
  const daysBefore = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysBefore >= 45) {
    return {
      allowed: true,
      requiresSpecialProcess: true,
      friendlyMessage: "Para cambiar esta fecha debes solicitarlo con al menos 45 días de anticipación. Este cambio requiere formato fuera de calendario.",
    };
  }

  if (daysBefore >= 15 && daysBefore < 45) {
    return {
      allowed: true,
      requiresSpecialProcess: true,
      friendlyMessage: "Esta propuesta se encuentra dentro del margen excepcional de 15 días naturales, pero requiere autorización de las áreas correspondientes.",
    };
  }

  if (daysBefore < 0) {
    return {
      allowed: false,
      requiresSpecialProcess: true,
      friendlyMessage: "No puedes modificar un periodo que ya inició.",
    };
  }

  return {
    allowed: true,
    requiresSpecialProcess: false,
    friendlyMessage: "Puedes solicitar la modificación dentro del plazo ordinario.",
  };
}

export function calculateReturnDate(
  startDate: string,
  entitlementUnits: number,
  unitType: "WORKDAY" | "JOURNEY" | "VELADA",
  weeklyRestDays: number[],
  mandatoryDates: string[]
): { lastDate: string; returnDate: string } {
  const result = calculateVacationRange({
    startDate,
    entitlementUnits,
    unitType,
    weeklyRestDays,
    mandatoryRestDates: mandatoryDates,
    workSchedule: { type: "ORDINARY" },
  });
  return { lastDate: result.lastVacationDate, returnDate: result.returnToWorkDate };
}
