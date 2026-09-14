import { describe, expect, it } from "vitest";
import { calculateLactation, getLactationModalities } from "@/features/representacion/lib/lactation";

describe("lactancia — 365 días calendario", () => {
  it("15/05/2026 → 14/05/2027 (caso operativo del Excel)", () => {
    const r = calculateLactation("2026-05-15", "2026-05-15");
    expect(r.periodEnd).toBe("2027-05-14");
    expect(r.totalDays).toBe(365);
    expect(r.dayNumber).toBe(1);
  });
  it("febrero bisiesto incluido: inicio 2024-02-15", () => {
    const r = calculateLactation("2024-02-15", "2024-03-01");
    expect(r.periodEnd).toBe("2025-02-13");
    expect(r.monthlyBreakdown.reduce((a, m) => a + m.days, 0)).toBe(365);
  });
  it("cambio de año: desglose suma 365", () => {
    const r = calculateLactation("2026-12-20", "2027-01-10");
    expect(r.periodEnd).toBe("2027-12-19");
    expect(r.monthlyBreakdown.reduce((a, m) => a + m.days, 0)).toBe(365);
    expect(r.elapsedDays).toBe(22);
    expect(r.remainingDays).toBe(343);
  });
  it("después del periodo: restantes 0", () => {
    const r = calculateLactation("2025-01-01", "2026-06-01");
    expect(r.remainingDays).toBe(0);
  });
  it("modalidades 8h no exigen acuerdo; 6.5h y acumulada sí", () => {
    expect(getLactationModalities("8h").every((m) => !m.requiresAgreement)).toBe(true);
    expect(getLactationModalities("lte6_5h")[0].requiresAgreement).toBe(true);
    expect(getLactationModalities("accumulated")[0].requiresAgreement).toBe(true);
  });
});
