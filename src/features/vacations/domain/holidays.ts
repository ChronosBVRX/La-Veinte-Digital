import type { AnnualVacationCalendar } from "./types";

export function getMandatoryRestDates(year: number): string[] {
  const dates: string[] = [];
  dates.push(`${year}-01-01`);
  const firstMondayFeb = getNthWeekdayOfMonth(year, 2, 1, 1);
  if (firstMondayFeb) dates.push(firstMondayFeb);
  const thirdMondayMar = getNthWeekdayOfMonth(year, 3, 3, 1);
  if (thirdMondayMar) dates.push(thirdMondayMar);
  dates.push(`${year}-05-01`);
  dates.push(`${year}-05-10`);
  dates.push(`${year}-09-15`);
  dates.push(`${year}-09-16`);
  const thirdMondayNov = getNthWeekdayOfMonth(year, 11, 3, 1);
  if (thirdMondayNov) dates.push(thirdMondayNov);
  dates.push(`${year}-12-25`);
  const easterWeek = getEasterWeek(year);
  dates.push(...easterWeek);
  return dates;
}

function getNthWeekdayOfMonth(year: number, month: number, n: number, weekday: number): string | null {
  const day = 1 + (weekday - new Date(year, month - 1, 1).getDay() + 7) % 7 + (n - 1) * 7;
  if (day > new Date(year, month, 0).getDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getEasterWeek(year: number): string[] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterSunday = new Date(year, month - 1, day);
  const thursday = new Date(easterSunday);
  thursday.setDate(easterSunday.getDate() - 3);
  const friday = new Date(easterSunday);
  friday.setDate(easterSunday.getDate() - 2);
  const saturday = new Date(easterSunday);
  saturday.setDate(easterSunday.getDate() - 1);
  return [
    formatDate(thursday),
    formatDate(friday),
    formatDate(saturday),
  ];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isMandatoryRest(date: string, mandatoryDates: string[]): boolean {
  return mandatoryDates.includes(date);
}

export function isWeeklyRest(date: string, weeklyRestDays: number[]): boolean {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return weeklyRestDays.includes(adjustedDay);
}

export function countExcludedDates(
  startDate: string,
  totalDays: number,
  weeklyRestDays: number[],
  mandatoryDates: string[]
): { excludedDates: string[]; includedDates: string[] } {
  const excludedDates: string[] = [];
  const includedDates: string[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < totalDays * 2; i++) {
    if (includedDates.length >= totalDays) break;
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDate(d);
    if (isWeeklyRest(dateStr, weeklyRestDays) || isMandatoryRest(dateStr, mandatoryDates)) {
      excludedDates.push(dateStr);
    } else {
      includedDates.push(dateStr);
    }
  }
  return { excludedDates, includedDates };
}
