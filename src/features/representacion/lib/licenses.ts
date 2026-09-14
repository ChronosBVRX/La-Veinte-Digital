// Licencias — Procedimiento 1A74-003-034, formato 1A74-009-036.
// Clasificación visual de rangos sin goce; nunca es autorización.

export type LicenseRangeType = "with_pay" | "r1_3" | "r4_60" | "r61_365";

export interface LicenseCalcInput {
  withPay: boolean;
  startISO: string;
  endISO: string;
}

export interface LicenseCalcResult {
  totalDays: number;
  rangeType: LicenseRangeType;
  rangeLabel: string;
}

export function classifyLicenseRange(withPay: boolean, totalDays: number): LicenseRangeType {
  if (withPay) return "with_pay";
  if (totalDays >= 1 && totalDays <= 3) return "r1_3";
  if (totalDays >= 4 && totalDays <= 60) return "r4_60";
  return "r61_365";
}

export function rangeLabel(range: LicenseRangeType): string {
  switch (range) {
    case "with_pay":
      return "Licencia con sueldo";
    case "r1_3":
      return "Licencia sin sueldo de 1 a 3 días";
    case "r4_60":
      return "Licencia sin sueldo de 4 a 60 días";
    case "r61_365":
      return "Licencia sin sueldo de 61 a 365 días";
  }
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function calculateLicense(input: LicenseCalcInput): LicenseCalcResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startISO) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endISO)) {
    throw new Error("Fechas inválidas (yyyy-mm-dd).");
  }
  const a = parseISODate(input.startISO);
  const b = parseISODate(input.endISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) throw new Error("Fechas inválidas.");
  if (b.getTime() < a.getTime()) throw new Error("La fecha de término debe ser igual o posterior al inicio.");
  const totalDays = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  if (!input.withPay && totalDays > 365) throw new Error("El rango sin goce máximo es 365 días.");
  const rangeType = classifyLicenseRange(input.withPay, totalDays);
  return { totalDays, rangeType, rangeLabel: rangeLabel(rangeType) };
}

export const DEBT_PENDING_LABEL = "Pendiente de certificación";
