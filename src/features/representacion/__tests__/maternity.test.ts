import { describe, expect, it } from "vitest";
import { calculateMaternity, inclusiveDaysBetween } from "@/features/representacion/lib/maternity";

describe("maternidad — 90 días naturales inclusivos", () => {
  it("2026-01-01 → 2026-03-31 (90 días)", () => {
    const r = calculateMaternity("2026-01-01");
    expect(r.incapacityEnd).toBe("2026-03-31");
    expect(r.returnToWork).toBe("2026-04-01");
    expect(inclusiveDaysBetween(r.incapacityStart, r.incapacityEnd)).toBe(90);
  });
  it("cambio de mes: 2026-05-18 (fórmula del Excel E7=90+B7-1)", () => {
    const r = calculateMaternity("2026-05-18");
    expect(r.incapacityEnd).toBe("2026-08-15");
    expect(r.returnToWork).toBe("2026-08-16");
    expect(r.lactationEnd).toBe("2027-08-15");
  });
  it("año bisiesto: inicio 2024-02-29", () => {
    const r = calculateMaternity("2024-02-29");
    expect(inclusiveDaysBetween(r.incapacityStart, r.incapacityEnd)).toBe(90);
    expect(r.incapacityEnd).toBe("2024-05-28");
  });
  it("febrero no bisiesto: inicio 2026-02-01", () => {
    const r = calculateMaternity("2026-02-01");
    expect(r.incapacityEnd).toBe("2026-05-01");
    expect(inclusiveDaysBetween(r.incapacityStart, r.incapacityEnd)).toBe(90);
  });
  it("cambio de año: inicio 2026-12-15", () => {
    const r = calculateMaternity("2026-12-15");
    expect(r.incapacityEnd).toBe("2027-03-14");
    expect(r.returnToWork).toBe("2027-03-15");
    expect(r.lactationEnd).toBe("2028-03-13");
  });
  it("rechaza fecha inválida", () => {
    expect(() => calculateMaternity("no-fecha")).toThrow();
  });
});
