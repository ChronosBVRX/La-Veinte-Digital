import type { VacationRegime, AnticipationResult, VacationDateCalculationInput, VacationDateCalculationResult, WorkScheduleDefinition } from "./types";
import { isWeeklyRest, isMandatoryRest } from "./holidays";
import { isWorkDay } from "./schedules";

export function validateAnticipation(
  regime: VacationRegime,
  dueDate: string,
  requestedStartDate: string,
  isFirstPeriod: boolean,
  completedYears: number
): AnticipationResult {
  const maxAnticipationDays = getMaxAnticipation(regime);
  const [dY, dM, dD] = dueDate.split("-").map(Number);
  const [rY, rM, rD] = requestedStartDate.split("-").map(Number);
  const due = new Date(dY, dM - 1, dD);
  const requested = new Date(rY, rM - 1, rD);
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
  const [y, m, d] = dueDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() - maxDays);
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
}

export function calculateVacationRange(input: VacationDateCalculationInput): VacationDateCalculationResult {
  const excludedWeeklyRestDates: string[] = [];
  const excludedMandatoryRestDates: string[] = [];
  const consumedDates: string[] = [];
  const [sy, sm, sd] = input.startDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  let vacationUnits = 0;
  let i = 0;

  while (vacationUnits < input.entitlementUnits) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = fmtDate(d);

    const isRest = isWeeklyRest(dateStr, input.weeklyRestDays);
    const isMand = isMandatoryRest(dateStr, input.mandatoryRestDates);
    const isWorkable = isWorkDay(dateStr, input.workSchedule);

    if (isRest) {
      excludedWeeklyRestDates.push(dateStr);
    } else if (isMand) {
      excludedMandatoryRestDates.push(dateStr);
    } else if (isWorkable) {
      // Solo los días laborables consumen unidades de vacaciones.
      // Los días no laborables del horario (p. ej. entre semana para
      // horario acumulado de fin de semana) alargan el periodo sin consumir.
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
  const [ly, lm, ld] = lastVacationDate.split("-").map(Number);
  const d = new Date(ly, lm - 1, ld);
  d.setDate(d.getDate() + 1);
  let attempts = 0;
  while (attempts < 30) {
    const dateStr = fmtDate(d);
    if (!isWeeklyRest(dateStr, weeklyRestDays) && !isMandatoryRest(dateStr, mandatoryDates) && isWorkDay(dateStr, schedule)) {
      return dateStr;
    }
    d.setDate(d.getDate() + 1);
    attempts++;
  }
  return fmtDate(d);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function validateModification(
  originallyScheduledDate: string,
  newDate: string
): { allowed: boolean; requiresSpecialProcess: boolean; requiresNormativeReview?: boolean; friendlyMessage: string } {
  const [oy, om, od] = originallyScheduledDate.split("-").map(Number);
  const [ny, nm, nd] = newDate.split("-").map(Number);
  const original = new Date(oy, om - 1, od);
  const proposed = new Date(ny, nm - 1, nd);
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
      requiresNormativeReview: true,
      friendlyMessage: "El cambio se solicita con menos de 45 días de anticipación. Se permite solo con autorización de las áreas correspondientes; la regla exacta requiere revisión normativa.",
    };
  }

  if (daysBefore >= 0 && daysBefore < 15) {
    return {
      allowed: false,
      requiresSpecialProcess: true,
      requiresNormativeReview: true,
      friendlyMessage: "La modificación queda dentro del margen excepcional de 15 días naturales previos al periodo programado. No puede aplicarse automáticamente: requiere autorización expresa de Servicios de Personal.",
    };
  }

  return {
    allowed: false,
    requiresSpecialProcess: true,
    friendlyMessage: "No puedes modificar un periodo que ya inició.",
  };
}

export function calculateReturnDate(
  startDate: string,
  entitlementUnits: number,
  unitType: "WORKDAY" | "JOURNEY" | "VELADA",
  weeklyRestDays: number[],
  mandatoryDates: string[],
  workSchedule?: WorkScheduleDefinition
): { lastDate: string; returnDate: string } {
  const result = calculateVacationRange({
    startDate,
    entitlementUnits,
    unitType,
    weeklyRestDays,
    mandatoryRestDates: mandatoryDates,
    workSchedule: workSchedule ?? { type: "ORDINARY" },
  });
  return { lastDate: result.lastVacationDate, returnDate: result.returnToWorkDate };
}

/**
 * Determina si el periodo por disfrutar es el primer periodo vacacional del
 * trabajador: no hay periodos vencidos ni días disfrutados y es el periodo 1.
 */
export function isFirstPeriod(
  nextPeriodNumber: number,
  expiredVacationPeriods: number,
  enjoyedVacationDays: number
): boolean {
  return nextPeriodNumber <= 1 && expiredVacationPeriods === 0 && enjoyedVacationDays === 0;
}
