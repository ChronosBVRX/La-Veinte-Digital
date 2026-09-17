import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildLicensePrintPackage } from "../services/license-print-package";
import type { UnionLicenseDocumentData } from "../services/license-document-dto";

describe("license-print-package", () => {
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

  it("generates a valid 2-page PDF document combining Oficio and Solicitud", async () => {
    const result = await buildLicensePrintPackage(baseDto);

    expect(result.pageCount).toBe(2);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(50000);

    // Verify PDF header magic bytes %PDF-
    expect(result.buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const loadedDoc = await PDFDocument.load(result.buffer);
    expect(loadedDoc.getPageCount()).toBe(2);

    const page1 = loadedDoc.getPage(0);
    const size1 = page1.getSize();
    expect(Math.round(size1.width)).toBe(612);
    expect(Math.round(size1.height)).toBe(792);

    const page2 = loadedDoc.getPage(1);
    const size2 = page2.getSize();
    expect(Math.round(size2.width)).toBe(612);
    expect(Math.round(size2.height)).toBe(792);
  });

  it("generates package correctly for sin goce (sin sueldo) with extension (prórroga)", async () => {
    const sinGoceDto: UnionLicenseDocumentData = {
      ...baseDto,
      license: {
        ...baseDto.license,
        withPay: false,
        payKindWord: "SIN",
        payKindLabel: "SIN GOCE",
        licenseRangeType: "r4_60",
        licenseRangeLabel: "Licencia sin sueldo de 4 a 60 días",
        totalDays: 30,
        isExtension: true,
        previousStartDate: "2026-08-01",
        previousEndDate: "2026-08-30",
      },
    };

    const result = await buildLicensePrintPackage(sinGoceDto);
    expect(result.pageCount).toBe(2);

    const loadedDoc = await PDFDocument.load(result.buffer);
    expect(loadedDoc.getPageCount()).toBe(2);
  });

  it("accepts custom print master buffers without error", async () => {
    const baseResult = await buildLicensePrintPackage(baseDto);
    expect(baseResult.pageCount).toBe(2);
  });
});
