// Cálculo administrativo de maternidad — CCT 2025-2027 Cl. 77.
// Reproduce el Excel operativo: E7=90+B7-1, F7=E7+1, H7=F7+365-1.
// Días naturales inclusivos. No es incapacidad médica emitida por el sistema.

import { MATERNITY_RULE_VERSION } from "./normative";

export interface MaternityResult {
  incapacityStart: string; // yyyy-mm-dd
  incapacityEnd: string;
  returnToWork: string;
  lactationStart: string;
  lactationEnd: string;
  incapacityDays: 90;
  lactationDays: 365;
  ruleVersion: string;
}

function toISODateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODateLocal(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function addDaysISO(iso: string, days: number): string {
  const d = parseISODateLocal(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODateUTC(d);
}

export function calculateMaternity(incapacityStartISO: string): MaternityResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incapacityStartISO)) {
    throw new Error("Fecha de inicio inválida (se espera yyyy-mm-dd).");
  }
  const start = parseISODateLocal(incapacityStartISO);
  if (Number.isNaN(start.getTime())) throw new Error("Fecha de inicio inválida.");
  // 90 días inclusivos: inicio + 89
  const incapacityEnd = addDaysISO(incapacityStartISO, 89);
  const returnToWork = addDaysISO(incapacityEnd, 1);
  const lactationEnd = addDaysISO(returnToWork, 364);
  return {
    incapacityStart: incapacityStartISO,
    incapacityEnd,
    returnToWork,
    lactationStart: returnToWork,
    lactationEnd,
    incapacityDays: 90,
    lactationDays: 365,
    ruleVersion: MATERNITY_RULE_VERSION,
  };
}

/** Días naturales inclusivos entre dos fechas ISO (fin - inicio + 1). */
export function inclusiveDaysBetween(startISO: string, endISO: string): number {
  const a = parseISODateLocal(startISO).getTime();
  const b = parseISODateLocal(endISO).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}
