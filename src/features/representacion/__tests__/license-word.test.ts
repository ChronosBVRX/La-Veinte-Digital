import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { buildLicenseWordDocument, buildLicenseLetterDocxDirect } from "../services/license-word";
import type { UnionLicenseDocumentData } from "../services/license-document-dto";

describe("license-word", () => {
  const sampleDto: UnionLicenseDocumentData = {
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

  it("generates a valid DOCX buffer from master template", () => {
    const buf = buildLicenseWordDocument(sampleDto);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(50000);
    // Standard ZIP magic numbers
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("preserves floating SNTSS logo and footer", () => {
    const buf = buildLicenseWordDocument(sampleDto);
    const zip = new PizZip(buf);
    expect(zip.file("word/media/image1.png")).not.toBeNull();
    expect(zip.file("word/footer1.xml")).not.toBeNull();
  });

  it("injects worker, license and committee data into document.xml", () => {
    const buf = buildLicenseWordDocument(sampleDto);
    const zip = new PizZip(buf);
    const docXml = zip.file("word/document.xml")?.asText() ?? "";

    expect(docXml).toContain("ROSETE ÁLVAREZ AXEL");
    expect(docXml).toContain("99342502");
    expect(docXml).toContain("MÉDICO NO FAMILIAR");
    expect(docXml).toContain("INTERNAMIENTO DE HIJO");
    expect(docXml).toContain("DEL 17 DE SEPTIEMBRE AL 19 DE SEPTIEMBRE DEL 2026");
    expect(docXml).toContain("MATUTINO");
    expect(docXml).toContain("SÁB - DOM");
    expect(docXml).toContain("Comité Delegacional XXI");
    expect(docXml).toContain("C. L.A.E. SARAI MORALES GARNICA");
  });

  it("eradicates historical Delegación XIV bug", () => {
    const buf = buildLicenseWordDocument(sampleDto);
    const zip = new PizZip(buf);
    const docXml = zip.file("word/document.xml")?.asText() ?? "";

    expect(docXml).not.toContain("Delegación XIV");
    expect(docXml).not.toContain("Delegacion XIV");
  });

  it("legacy wrapper buildLicenseLetterDocxDirect functions correctly", () => {
    const legacyBuf = buildLicenseLetterDocxDirect({
      section: "SECCIÓN XX MICHOACÁN",
      placeDate: "Charo, Michoacán a 17 DE SEPTIEMBRE del 2026",
      recipientName: "C. Jefe de Personal H.G.R. No. 1",
      recipientRole: "Jefe de Personal H.G.R. No. 1",
      payKindLabel: "SIN GOCE",
      workerFullName: "PÉREZ LÓPEZ JUAN",
      employeeNumber: "12345678",
      category: "ENFERMERA GENERAL",
      reason: "PERSONAL",
      periodLabel: "DEL 20 DE SEPTIEMBRE AL 22 DE SEPTIEMBRE DEL 2026",
      turn: "VESPERTINO",
      restDays: "JUE-VIE",
      totalDays: 3,
      committeeName: "COMITÉ DELEGACIONAL XXI",
      motto: "Seguridad Social y Bienestar Económico de los Trabajadores",
      signerName: "LORENA GUADALUPE SOLORIO CHÁVEZ",
      signerRole: "Secretario del Interior",
    });

    expect(legacyBuf.length).toBeGreaterThan(50000);
    const zip = new PizZip(legacyBuf);
    const docXml = zip.file("word/document.xml")?.asText() ?? "";
    expect(docXml).toContain("PÉREZ LÓPEZ JUAN");
  });

  it("corrects fixture XXI-2026-LIC-000006 without duplicate oficios or historical residues", () => {
    const fixtureDto: UnionLicenseDocumentData = {
      ...sampleDto,
      folio: "XXI-2026-LIC-000006",
      elaborationDate: "2026-09-10",
      elaborationDay: "10",
      elaborationMonth: "09",
      elaborationMonthName: "SEPTIEMBRE",
      elaborationYear: "2026",
      placeDateString: "Charo, Michoacán a 10 DE SEPTIEMBRE del 2026",
      worker: {
        ...sampleDto.worker,
        employeeNumber: "98173968",
        firstName: "EDUARDO",
        paternalSurname: "BOLAÑOS",
        maternalSurname: "VAZQUEZ",
        fullName: "BOLAÑOS VAZQUEZ EDUARDO",
        category: "TECNICO RADIOLOGO 80",
        turn: "VESPERTINO",
        schedule: "14.00 A 21.30 JORNADA MIXTA",
        restDays: "",
      },
      license: {
        ...sampleDto.license,
        withPay: true,
        payKindWord: "CON",
        payKindLabel: "CON GOCE DE SUELDO",
        totalDays: 2,
        daysUnit: "DÍAS",
        startDate: "2026-09-10",
        startDay: "10",
        startMonth: "09",
        startYear: "2026",
        endDate: "2026-09-11",
        endDay: "11",
        endMonth: "09",
        endYear: "2026",
        periodLabelWord: "DEL 10 DE SEPTIEMBRE AL 11 DE SEPTIEMBRE DEL 2026",
        reason: "CIRUGÍA PADRE",
        proof: "INE",
      },
    };

    const buf = buildLicenseWordDocument(fixtureDto);
    const zip = new PizZip(buf);
    const docXml = zip.file("word/document.xml")?.asText() ?? "";

    // Historical residue MUST NOT appear
    expect(docXml).not.toContain("97173345");
    expect(docXml).not.toContain("ENFERMERA GENERAL CLÍNICA");
    expect(docXml).not.toContain("INTERNAMIENTO DE HIJO");
    expect(docXml).not.toContain("Delegación XIV");
    expect(docXml).not.toContain("Delegacion XIV");

    // Real data MUST appear
    expect(docXml).toContain("BOLAÑOS VAZQUEZ EDUARDO");
    expect(docXml).toContain("98173968");
    expect(docXml).toContain("TECNICO RADIOLOGO 80");
    expect(docXml).toContain("CIRUGÍA PADRE");
    expect(docXml).toContain("Comité Delegacional XXI");

    // Exactly ONE oficio
    const matches = docXml.match(/Por medio de la presente/g) || [];
    expect(matches.length).toBe(1);
  });
});
