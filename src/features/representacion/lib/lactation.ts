// Lactancia — CCT 2025-2027 Cl. 77: 365 días naturales desde la reanudación.
// El plazo contractual es calendario; los días laborables son solo info secundaria.

import { LACTATION_RULE_VERSION } from "./normative";

export type LactationWorkdayType = "8h" | "lte6_5h" | "accumulated";

export interface LactationModalityOption {
  id: string;
  title: string;
  detail: string;
  requiresAgreement: boolean;
}

export interface LactationMonthlySlice {
  year: number;
  month: number; // 1-12
  label: string;
  days: number;
}

export interface LactationResult {
  returnToWork: string;
  periodStart: string;
  periodEnd: string;
  totalDays: 365;
  elapsedDays: number;
  remainingDays: number;
  dayNumber: number; // 1..365 o 366 si ya terminó
  monthlyBreakdown: LactationMonthlySlice[];
  ruleVersion: string;
}

const MONTH_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calculateLactation(returnToWorkISO: string, todayISO?: string): LactationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(returnToWorkISO)) throw new Error("Fecha de reanudación inválida.");
  const start = parseISO(returnToWorkISO);
  if (Number.isNaN(start.getTime())) throw new Error("Fecha de reanudación inválida.");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 364);
  const today = todayISO ? parseISO(todayISO) : new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const elapsed = Math.max(0, Math.min(365, Math.round((todayUTC.getTime() - start.getTime()) / 86_400_000) + 1));
  const remainingDays = todayUTC.getTime() > end.getTime() ? 0 : 365 - elapsed;
  // Desglose mensual calendario (reproduce el "conteo mensual" del Excel)
  const monthly: LactationMonthlySlice[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(y, m + 1, 0));
    const sliceEnd = monthEnd.getTime() > end.getTime() ? end : monthEnd;
    const days = Math.round((sliceEnd.getTime() - cursor.getTime()) / 86_400_000) + 1;
    monthly.push({ year: y, month: m + 1, label: MONTH_LABELS[m], days });
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return {
    returnToWork: returnToWorkISO,
    periodStart: returnToWorkISO,
    periodEnd: toISO(end),
    totalDays: 365,
    elapsedDays: todayUTC.getTime() < start.getTime() ? 0 : Math.min(365, elapsed),
    remainingDays,
    dayNumber: todayUTC.getTime() < start.getTime() ? 0 : Math.min(366, elapsed + (todayUTC.getTime() > end.getTime() ? 1 : 0)),
    monthlyBreakdown: monthly,
    ruleVersion: LACTATION_RULE_VERSION,
  };
}

export function getLactationModalities(workday: LactationWorkdayType): LactationModalityOption[] {
  if (workday === "8h") {
    return [
      {
        id: "8h-reduccion-1h",
        title: "Reducción de 1 hora diaria",
        detail: "Modalidad para jornada de 8 horas conforme a Cl. 77. Sujeta a registro operativo.",
        requiresAgreement: false,
      },
      {
        id: "8h-dos-medias-horas",
        title: "Dos descansos de 30 minutos",
        detail: "Alternativa normativa para jornada de 8 horas conforme a Cl. 77.",
        requiresAgreement: false,
      },
    ];
  }
  if (workday === "lte6_5h") {
    return [
      {
        id: "65h-descanso-30",
        title: "Descanso de 30 minutos",
        detail: "Alternativa correspondiente a jornada de 6.5 horas o menos, conforme a Cl. 77. Modalidad sujeta a acuerdo con el Instituto.",
        requiresAgreement: true,
      },
    ];
  }
  return [
    {
      id: "acum-modalidad-especifica",
      title: "Modalidad específica de jornada acumulada",
      detail: "Jornada acumulada nocturna o diurna: aplica la modalidad específica conforme al CCT. Modalidad sujeta a acuerdo con el Instituto.",
      requiresAgreement: true,
    },
  ];
}

export const LACTATION_AGREEMENT_NOTICE = "Modalidad sujeta a acuerdo con el Instituto.";
