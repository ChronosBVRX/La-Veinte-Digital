import type { WorkScheduleType, WorkScheduleDefinition } from "./types";

export const ACCUMULATED_DAY_JOURNEYS: Record<number, number> = {
  7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 5, 13: 5,
  14: 6, 15: 6, 16: 6, 17: 7, 18: 7, 19: 8, 20: 8,
};

export const ACCUMULATED_NIGHT_VELADAS: Record<number, number> = {
  7: 4, 8: 5, 9: 5, 10: 6, 11: 7, 12: 7, 13: 8,
  14: 8, 15: 9, 16: 10, 17: 10, 18: 11, 19: 11, 20: 12,
};

export function getAccumulatedDayJourneys(workedHours: number): number {
  if (workedHours in ACCUMULATED_DAY_JOURNEYS) return ACCUMULATED_DAY_JOURNEYS[workedHours];
  throw new Error(`No hay equivalencia definida para jornada de ${workedHours} horas. Se requiere revisión administrativa.`);
}

export function getAccumulatedNightVeladas(workedHours: number): number {
  if (workedHours in ACCUMULATED_NIGHT_VELADAS) return ACCUMULATED_NIGHT_VELADAS[workedHours];
  throw new Error(`No hay equivalencia definida para velada de ${workedHours} horas. Se requiere revisión administrativa.`);
}

export function getUnitType(scheduleType: WorkScheduleType): "WORKDAY" | "JOURNEY" | "VELADA" {
  switch (scheduleType) {
    case "ACCUMULATED_WEEKEND_DAY": return "JOURNEY";
    case "ACCUMULATED_NIGHT": return "VELADA";
    default: return "WORKDAY";
  }
}

export function isWorkDay(date: string, schedule: WorkScheduleDefinition): boolean {
  if (!schedule.workingDays || schedule.workingDays.length === 0) return true;
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay();
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return schedule.workingDays.includes(adjustedDay);
}

export function getNextWorkDay(date: string, schedule: WorkScheduleDefinition): string {
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + 1);
  while (!isWorkDay(fmtDate(dateObj), schedule)) {
    dateObj.setDate(dateObj.getDate() + 1);
  }
  return fmtDate(dateObj);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
