import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { buildLicenseExcelDocument, buildLicenseExcel } from "../services/license-excel";
import type { UnionLicenseDocumentData } from "../services/license-document-dto";

describe("license-excel", () => {
  const baseDto: UnionLicenseDocumentData = {
    caseId: "123e4567-e89b-12d3-a456-426614174000",
    folio: "XXI-2026-LIC-000042",
    delegationId: "del-uuid",
    delegationCode: "XXI",
    delegationDisplayName: "Comité Delegacional XXI",
    centerName: "HGR No. 1",
    centerAddress: "La Goleta, Charo, Michoacán",
    ooad: "MICHOACÁN",
    place: "LA GOLETA, CHARO, MICHOACÁN",
    elaborationDate: "2026-09-17",
    elaborationDay: "17",
    elaborationMonth: "09",
    elaborationMonthName: "SEPTIEMBRE",
    elaborationYear: "2026",
    placeDateString: "Charo, Michoacán a 17 DE SEPTIEMBRE del 2026",
    worker: {
      id: "worker-uuid",
      employeeNumber: "99342502",
      firstName: "AXEL",
      paternalSurname: "ROSETE",
      maternalSurname: "ÁLVAREZ",
      fullName: "ROSETE ÁLVAREZ AXEL",
      category: "MÉDICO NO FAMILIAR",
      assignment: "HOSPITAL GENERAL REGIONAL No. 1",
      turn: "MATUTINO",
      schedule: "07:00 A 15:00",
      restDays: "SÁB - DOM",
      phone: "4431234567",
    },
    license: {
      withPay: true,
      payKindWord: "CON",
      payKindLabel: "CON GOCE",
      licenseRangeType: "with_pay",
      licenseRangeLabel: "Licencia con goce de sueldo",
      startDate: "2026-09-17",
      startDay: "17",
      startMonth: "09",
      startYear: "2026",
      endDate: "2026-09-19",
      endDay: "19",
      endMonth: "09",
      endYear: "2026",
      periodLabelWord: "DEL 17 DE SEPTIEMBRE AL 19 DE SEPTIEMBRE DEL 2026",
      totalDays: 3,
      daysUnit: "DÍAS",
      isExtension: false,
      reason: "INTERNAMIENTO DE HIJO",
      proof: "CONSTANCIA MÉDICA",
      debtStatus: "Certificado",
    },
    recipient: {
      name: "C. L.A.E. SARAI MORALES GARNICA",
      role: "Jefe de Personal H.G.R. No. 1",
    },
    signers: {
      signerName: "LORENA GUADALUPE SOLORIO CHÁVEZ",
      signerRole: "Secretario del Interior",
      institutionalMotto: "Seguridad Social y Bienestar Económico de los Trabajadores",
      committeeName: "Comité Delegacional XXI",
      sidebarDelegation: "COMITÉ DELEGACIONAL XXI",
      generalSecretary: "CUITLÁHUAC CERDA GUTIÉRREZ",
      interiorSecretary: "LORENA GUADALUPE SOLORIO CHÁVEZ",
      conflictsSecretary: "MAYRA ZENDEJAS RODRÍGUEZ",
      admissionSecretary: "PATRICIA GONZÁLEZ MÉNDEZ",
      socialWelfareSecretary: "GRACIELA CORTEZ CÁRDENAS",
    },
  };

  it("generates a valid XLSM buffer and preserves xl/vbaProject.bin", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(40000);

    const zip = new PizZip(buf);
    const vba = zip.file("xl/vbaProject.bin");
    expect(vba).not.toBeNull();
    expect(vba?.asNodeBuffer().length).toBe(30720); // Byte-for-byte preservation of VBA binary
  });

  it("populates Sheet 1 (Generador) with worker and license values", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(buf);
    const s1Xml = zip.file("xl/worksheets/sheet1.xml")?.asText() ?? "";

    expect(s1Xml).toContain("XXI-2026-LIC-000042");
    expect(s1Xml).toContain("ROSETE");
    expect(s1Xml).toContain("ÁLVAREZ");
    expect(s1Xml).toContain("AXEL");
    expect(s1Xml).toContain("MÉDICO NO FAMILIAR");
    expect(s1Xml).toContain("99342502");
    expect(s1Xml).toContain("INTERNAMIENTO DE HIJO");
    expect(s1Xml).toContain("3  DÍAS");
  });

  it("sets correct checkbox in Sheet 2 (Licencia) for con goce", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(buf);
    const s2Xml = zip.file("xl/worksheets/sheet2.xml")?.asText() ?? "";

    // H9 should have X for con goce
    expect(s2Xml).toContain('r="H9"');
    expect(s2Xml).toContain("<t>X</t>");
    // D24 should have X for NO prórroga
    expect(s2Xml).toContain('r="D24"');
  });

  it("sets correct checkboxes for sin goce 4 a 60 días and prórroga", async () => {
    const sinGoceDto: UnionLicenseDocumentData = {
      ...baseDto,
      license: {
        ...baseDto.license,
        withPay: false,
        payKindWord: "SIN",
        licenseRangeType: "r4_60",
        totalDays: 15,
        isExtension: true,
      },
    };

    const buf = await buildLicenseExcelDocument(sinGoceDto);
    const zip = new PizZip(buf);
    const s2Xml = zip.file("xl/worksheets/sheet2.xml")?.asText() ?? "";

    // H11 should have X for 4 a 60 días
    expect(s2Xml).toContain('r="H11"');
    // B24 should have X for SÍ prórroga
    expect(s2Xml).toContain('r="B24"');
  });

  it("legacy wrapper buildLicenseExcel functions properly", async () => {
    const legacyBuf = await buildLicenseExcel({
      ooad: "MICHOACÁN",
      place: "LA GOLETA, CHARO, MICHOACÁN",
      folio: "XXI-2026-LIC-000099",
      elaborationDay: "05",
      elaborationMonth: "10",
      elaborationYear: "2026",
      worker: {
        paternalSurname: "GÓMEZ",
        maternalSurname: "PÉREZ",
        firstName: "JUAN",
        employeeNumber: "11223344",
        category: "ENFERMERO",
        assignment: "HGR 1",
        turn: "MATUTINO",
        schedule: "07:00 A 15:00",
        restDays: "SÁB-DOM",
      },
      withPay: false,
      rangeLabel: "Licencia sin sueldo de 1 a 3 días",
      startDay: "06",
      startMonth: "10",
      startYear: "2026",
      endDay: "08",
      endMonth: "10",
      endYear: "2026",
      totalDays: 3,
      isExtension: false,
      reason: "PERSONAL",
      proof: "INE",
      phone: "4430000000",
      debtStatus: "Pendiente",
    });

    expect(legacyBuf.length).toBeGreaterThan(40000);
    const zip = new PizZip(legacyBuf);
    const s1 = zip.file("xl/worksheets/sheet1.xml")?.asText() ?? "";
    expect(s1).toContain("XXI-2026-LIC-000099");
    expect(s1).toContain("GÓMEZ");
  });
});
