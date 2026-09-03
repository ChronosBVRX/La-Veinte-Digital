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
  const due = new Date(Date.UTC(dY, dM - 1, dD));
  const requested = new Date(Date.UTC(rY, rM - 1, rD));
  const diffMs = due.getTime() - requested.getTime();
  const daysInAdvance = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (regime === "EXTRAORDINARIO_V20" && completedYears < 20) {
    return {
      allowed: false,
      dueDate,
      earliestAllowedDate: dueDate,
      requestedDate: requestedStartDate,
      daysInAdvance: Math.max(0, daysInAdvance),
      reasonCode: "V20_REQUIRES_20_YEARS",
      friendlyMessage: "Las vacaciones extraordinarias V20 requieren tener al menos 20 años de antigüedad cumplidos.",
    };
  }

  if (isFirstPeriod && completedYears < 1 && daysInAdvance > 0) {
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

  // Fecha posterior o igual a "por vencer": válida con anticipación cero.
  // "Por vencer" representa la fecha de adquisición del derecho, no el último día permitido.
  if (daysInAdvance <= 0) {
    const daysPastDue = Math.floor((requested.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    // Prescripción general de 2 años (730 días naturales).
    if (daysPastDue > 730) {
      return {
        allowed: false,
        dueDate,
        earliestAllowedDate: getEarliestDate(dueDate, maxAnticipationDays),
        requestedDate: requestedStartDate,
        daysInAdvance: 0,
        reasonCode: "PRESCRIPTION_EXCEEDED",
        friendlyMessage: "El periodo vacacional ha prescrito (límite de 2 años posteriores a su fecha de adquisición por vencer).",
      };
    }

    return {
      allowed: true,
      dueDate,
      earliestAllowedDate: getEarliestDate(dueDate, maxAnticipationDays),
      requestedDate: requestedStartDate,
      daysInAdvance: 0,
      friendlyMessage: "La fecha es posterior a la fecha por vencer (adquisición del derecho). No requiere anticipación y está dentro del periodo legal de disfrute.",
    };
  }

  // Fecha anterior a "por vencer": se evalúa anticipación.
  if (regime === "ESTATUTO") {
    return {
      allowed: false,
      dueDate,
      earliestAllowedDate: dueDate,
      requestedDate: requestedStartDate,
      daysInAdvance,
      reasonCode: "ESTATUTO_NO_ANTICIPATION",
      friendlyMessage: "El régimen de Estatuto no permite anticipación vacacional. Las vacaciones deben disfrutarse a partir de la fecha de vencimiento dentro del año calendario.",
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
    case "ESTATUTO": return 0;
    default: return 120;
  }
}

function getEarliestDate(dueDate: string, maxDays: number): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() - maxDays);
  return fmtDate(dateObj);
}

export function calculateVacationRange(input: VacationDateCalculationInput): VacationDateCalculationResult {
  const excludedWeeklyRestDates: string[] = [];
  const excludedMandatoryRestDates: string[] = [];
  const consumedDates: string[] = [];
  const [sy, sm, sd] = input.startDate.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  let vacationUnits = 0;
  let i = 0;
  let truncated = false;

  while (vacationUnits < input.entitlementUnits) {
    if (i > 365) {
      truncated = true;
      break;
    }
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
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
      consumedDates.push(dateStr);
      vacationUnits++;
    }
    i++;
  }

  const lastDate = consumedDates[consumedDates.length - 1] ?? input.startDate;
  const returnDate = getReturnDate(lastDate, input.weeklyRestDays, input.mandatoryRestDates, input.workSchedule);

  let exceedsContractEnd = false;
  if (input.contractEndDate && /^\d{4}-\d{2}-\d{2}$/.test(input.contractEndDate)) {
    if (input.startDate > input.contractEndDate || lastDate > input.contractEndDate) {
      exceedsContractEnd = true;
    }
  }

  return {
    startDate: input.startDate,
    lastVacationDate: lastDate,
    returnToWorkDate: returnDate,
    consumedDates,
    excludedWeeklyRestDates,
    excludedMandatoryRestDates,
    totalCalendarDays: consumedDates.length + excludedWeeklyRestDates.length + excludedMandatoryRestDates.length,
    totalVacationUnits: input.entitlementUnits,
    truncated,
    exceedsContractEnd,
    contractEndDate: input.contractEndDate,
  };
}

function getReturnDate(
  lastVacationDate: string,
  weeklyRestDays: number[],
  mandatoryDates: string[],
  schedule: WorkScheduleDefinition
): string {
  const [ly, lm, ld] = lastVacationDate.split("-").map(Number);
  const d = new Date(Date.UTC(ly, lm - 1, ld));
  d.setUTCDate(d.getUTCDate() + 1);
  let attempts = 0;
  while (attempts < 30) {
    const dateStr = fmtDate(d);
    if (!isWeeklyRest(dateStr, weeklyRestDays) && !isMandatoryRest(dateStr, mandatoryDates) && isWorkDay(dateStr, schedule)) {
      return dateStr;
    }
    d.setUTCDate(d.getUTCDate() + 1);
    attempts++;
  }
  return fmtDate(d);
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function validateModification(
  originallyScheduledDate: string,
  newDate: string,
  requestDate?: string
): { allowed: boolean; requiresSpecialProcess: boolean; requiresNormativeReview?: boolean; friendlyMessage: string } {
  const referenceDate = requestDate ?? newDate;
  const [oy, om, od] = originallyScheduledDate.split("-").map(Number);
  const [ny, nm, nd] = newDate.split("-").map(Number);
  const [ry, rm, rd] = referenceDate.split("-").map(Number);
  const original = new Date(oy, om - 1, od);
  const proposed = new Date(ny, nm - 1, nd);
  const request = new Date(ry, rm - 1, rd);
  const diffMs = original.getTime() - request.getTime();
  const daysBefore = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysBefore < 0) {
    return {
      allowed: false,
      requiresSpecialProcess: true,
      friendlyMessage: "No puedes modificar un periodo que ya inició.",
    };
  }

  if (proposed < request) {
    return {
      allowed: false,
      requiresSpecialProcess: true,
      friendlyMessage: "La nueva fecha no puede ser anterior a la fecha de la solicitud.",
    };
  }

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
