import { describe, expect, it } from "vitest";
import { calculateLicense, classifyLicenseRange } from "@/features/representacion/lib/licenses";
import { buildLicenseExcel } from "@/features/representacion/services/license-excel";
import { buildLicenseLetterDocxDirect } from "@/features/representacion/services/license-word";
import { buildFolio, casePrefix } from "@/features/representacion/lib/folio";

describe("licencias", () => {
  it("con goce 2 días", () => {
    const r = calculateLicense({ withPay: true, startISO: "2026-08-31", endISO: "2026-09-01" });
    expect(r.totalDays).toBe(2);
    expect(r.rangeType).toBe("with_pay");
  });
  it("sin goce 1-3 / 4-60 / 61-365", () => {
    expect(classifyLicenseRange(false, 2)).toBe("r1_3");
    expect(classifyLicenseRange(false, 15)).toBe("r4_60");
    expect(classifyLicenseRange(false, 200)).toBe("r61_365");
  });
  it("rechaza fin anterior al inicio y >365 sin goce", () => {
    expect(() => calculateLicense({ withPay: false, startISO: "2026-09-02", endISO: "2026-09-01" })).toThrow();
    expect(() => calculateLicense({ withPay: false, startISO: "2026-01-01", endISO: "2027-01-02" })).toThrow();
  });
  it("prórroga: cálculo de días consistente", () => {
    const r = calculateLicense({ withPay: false, startISO: "2026-10-16", endISO: "2026-10-30" });
    expect(r.totalDays).toBe(15);
  });
  it("Excel generado abre (firma ZIP xlsx) y no está vacío", async () => {
    const buf = await buildLicenseExcel({
      ooad: "MICHOACÁN",
      place: "LA GOLETA, CHARO, MICHOACÁN",
      folio: "XXI-2026-LIC-000001",
      elaborationDay: "14",
      elaborationMonth: "09",
      elaborationYear: "2026",
      worker: { paternalSurname: "Ejemplo", maternalSurname: "Prueba", firstName: "María", employeeNumber: "00000001", category: "ENFERMERA GENERAL", assignment: "HGR No. 1", turn: "VESPERTINO", schedule: "14:00 A 21:30", restDays: "JUE-VIE" },
      withPay: false,
      rangeLabel: "Licencia sin sueldo de 4 a 60 días",
      startDay: "16",
      startMonth: "10",
      startYear: "2026",
      endDay: "30",
      endMonth: "10",
      endYear: "2026",
      totalDays: 15,
      isExtension: false,
      reason: "PERSONAL",
      proof: "INE",
      phone: "",
      debtStatus: "Pendiente de certificación",
    });
    expect(buf.length).toBeGreaterThan(4000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
  it("Word generado abre (ZIP docx) y contiene comité XXI", async () => {
    const buf = buildLicenseLetterDocxDirect({
      section: "SECCIÓN XX MICHOACÁN",
      placeDate: "Charo, Michoacán a 14 DE SEPTIEMBRE del 2026",
      recipientName: "C. Jefe de Personal H.G.R. No. 1",
      recipientRole: "Jefe de Personal H.G.R. No. 1",
      payKindLabel: "SIN GOCE",
      workerFullName: "EJEMPLO PRUEBA MARÍA",
      employeeNumber: "00000001",
      category: "ENFERMERA GENERAL",
      reason: "PERSONAL",
      periodLabel: "DEL 16 DE OCTUBRE DEL 2026 AL 30 DE OCTUBRE DEL 2026",
      turn: "VESPERTINO",
      restDays: "JUE-VIE",
      totalDays: 15,
      committeeName: "COMITÉ DELEGACIONAL XXI",
      motto: "Seguridad Social y Bienestar Económico de los Trabajadores",
      signerName: "Nombre Firmante",
      signerRole: "Secretario del Interior XXI",
    });
    expect(buf.length).toBeGreaterThan(1500);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.toString("utf8")).toContain("COMIT");
  });
  it("folios legibles por tipo", () => {
    expect(casePrefix("license")).toBe("LIC");
    expect(casePrefix("maternity")).toBe("MAT");
    expect(buildFolio("XXI", 2026, "license", 1)).toBe("XXI-2026-LIC-000001");
  });
});
