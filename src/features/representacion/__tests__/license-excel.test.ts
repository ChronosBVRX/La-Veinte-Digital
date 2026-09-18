import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import {
  buildLicenseExcelDocument,
  buildLicenseExcel,
  resolveSheetPathByName,
  LICENSE_TYPE_CELLS,
  LICENSE_EXTENSION_SHAPES,
} from "../services/license-excel";
import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
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

  it("generates a valid XLSM buffer and preserves xl/vbaProject.bin byte-for-byte", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(30000);

    const zip = new PizZip(buf);
    const vba = zip.file("xl/vbaProject.bin");
    expect(vba).not.toBeNull();
    // V2 official template VBA binary is 22,528 bytes
    expect(vba?.asNodeBuffer().length).toBe(22528);
  });

  it("resolves sheet 'Licencia' dynamically and populates worker, folio, and dates", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    expect(licPath).toMatch(/^xl\/worksheets\/sheet\d+\.xml$/);

    const licXml = zip.file(licPath)?.asText() ?? "";

    expect(licXml).toContain("XXI-2026-LIC-000042");
    expect(licXml).toContain("ROSETE");
    expect(licXml).toContain("ÁLVAREZ");
    expect(licXml).toContain("AXEL");
    expect(licXml).toContain("MÉDICO NO FAMILIAR");
    expect(licXml).toContain("99342502");
    expect(licXml).toContain("INTERNAMIENTO DE HIJO");
    expect(licXml).toContain("3  DÍAS");

    // Must preserve 152 merged cells
    expect(licXml).toContain('<mergeCells count="152">');
    // Must contain 0 #REF!
    expect(licXml).not.toContain("#REF!");
  });

  function getCellInlineText(xml: string, cellRef: string): string | null {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const cells = doc.getElementsByTagName("c");
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.getAttribute("r") === cellRef) {
        const t = c.getElementsByTagName("t")[0];
        return t ? t.textContent : null;
      }
    }
    return null;
  }

  function getShapeFillColor(drawingXml: string, shapeId: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(drawingXml, "text/xml");
    const sps = doc.getElementsByTagName("xdr:sp");
    for (let i = 0; i < sps.length; i++) {
      const sp = sps[i];
      const cNvPr = sp.getElementsByTagName("xdr:cNvPr")[0];
      if (cNvPr?.getAttribute("id") === shapeId) {
        const spPr = sp.getElementsByTagName("xdr:spPr")[0];
        if (!spPr) return null;
        for (let j = 0; j < spPr.childNodes.length; j++) {
          const child = spPr.childNodes[j];
          if (child.nodeName === "a:solidFill") {
            const clr = (child as unknown as XmlElement).getElementsByTagName("a:srgbClr")[0];
            return clr?.getAttribute("val") ?? null;
          }
        }
      }
    }
    return null;
  }

  it("sets correct checkbox in sheet 'Licencia' for con goce (H9) and no prórroga (Shape 4 black, Shape 5 white)", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";

    // H9 must have 'X'
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withPay)).toBe("X");
    // O9, H11, O11 must NOT have 'X'
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay1To3)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay4To60)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay61To365)).toBeNull();

    // Critical: P9 and P11 must NEVER be written
    expect(getCellInlineText(licXml, "P9")).toBeNull();
    expect(getCellInlineText(licXml, "P11")).toBeNull();

    // Critical: B24 and D24 must NEVER be written
    expect(getCellInlineText(licXml, "B24")).toBeNull();
    expect(getCellInlineText(licXml, "D24")).toBeNull();

    // Prórroga: isExtension is false -> Shape 4 (NO) black, Shape 5 (SÍ) white
    const drawingXml = zip.file(LICENSE_EXTENSION_SHAPES.yes.drawing)?.asText() ?? "";
    expect(getShapeFillColor(drawingXml, LICENSE_EXTENSION_SHAPES.no.id)).toBe("000000");
    expect(getShapeFillColor(drawingXml, LICENSE_EXTENSION_SHAPES.yes.id)).toBe("FFFFFF");
  });

  it("sets correct checkbox for sin goce 1 a 3 días in O9 (never P9)", async () => {
    const sinGoce1To3Dto: UnionLicenseDocumentData = {
      ...baseDto,
      license: {
        ...baseDto.license,
        withPay: false,
        payKindWord: "SIN",
        licenseRangeType: "r1_3",
        totalDays: 2,
        isExtension: false,
      },
    };

    const buf = await buildLicenseExcelDocument(sinGoce1To3Dto);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";

    // O9 must have 'X'
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay1To3)).toBe("X");
    // Other 3 must be empty
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withPay)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay4To60)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay61To365)).toBeNull();

    // P9 and P11 must NEVER have 'X'
    expect(getCellInlineText(licXml, "P9")).toBeNull();
    expect(getCellInlineText(licXml, "P11")).toBeNull();
  });

  it("sets correct checkboxes for sin goce 4 a 60 días (H11) and prórroga (Shape 5 black, Shape 4 white)", async () => {
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
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";

    // H11 should have X for 4 a 60 días
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay4To60)).toBe("X");
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withPay)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay1To3)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay61To365)).toBeNull();

    // P9, P11, B24, D24 must NOT be written
    expect(getCellInlineText(licXml, "P9")).toBeNull();
    expect(getCellInlineText(licXml, "P11")).toBeNull();
    expect(getCellInlineText(licXml, "B24")).toBeNull();
    expect(getCellInlineText(licXml, "D24")).toBeNull();

    // Prórroga: isExtension is true -> Shape 5 (SÍ) black, Shape 4 (NO) white
    const drawingXml = zip.file(LICENSE_EXTENSION_SHAPES.yes.drawing)?.asText() ?? "";
    expect(getShapeFillColor(drawingXml, LICENSE_EXTENSION_SHAPES.yes.id)).toBe("000000");
    expect(getShapeFillColor(drawingXml, LICENSE_EXTENSION_SHAPES.no.id)).toBe("FFFFFF");
  });

  it("sets correct checkbox for sin goce 61 a 365 días in O11 (never P11)", async () => {
    const sinGoceLongDto: UnionLicenseDocumentData = {
      ...baseDto,
      license: {
        ...baseDto.license,
        withPay: false,
        payKindWord: "SIN",
        licenseRangeType: "r61_365",
        totalDays: 180,
        isExtension: false,
      },
    };

    const buf = await buildLicenseExcelDocument(sinGoceLongDto);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";

    // O11 must have 'X'
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay61To365)).toBe("X");
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withPay)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay1To3)).toBeNull();
    expect(getCellInlineText(licXml, LICENSE_TYPE_CELLS.withoutPay4To60)).toBeNull();

    // P9 and P11 must be empty
    expect(getCellInlineText(licXml, "P9")).toBeNull();
    expect(getCellInlineText(licXml, "P11")).toBeNull();
  });

  it("ensures styles for H9, O9, H11, O11 have centered horizontal and vertical alignment", async () => {
    const buf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(buf);
    const stylesXml = zip.file("xl/styles.xml")?.asText() ?? "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(stylesXml, "text/xml");
    const cellXfs = doc.getElementsByTagName("cellXfs")[0];
    const directXfs: Element[] = [];
    for (let i = 0; i < cellXfs.childNodes.length; i++) {
      const n = cellXfs.childNodes[i];
      if (n.nodeType === 1) directXfs.push(n as unknown as Element);
    }

    // Styles 49 (H9), 50 (O9), 16 (H11), 17 (O11)
    for (const idx of [49, 50, 16, 17]) {
      const xf = directXfs[idx];
      expect(xf).toBeDefined();
      expect(xf.getAttribute("applyAlignment")).toBe("1");
      const al = xf.getElementsByTagName("alignment")[0];
      expect(al).toBeDefined();
      expect(al.getAttribute("horizontal")).toBe("center");
      expect(al.getAttribute("vertical")).toBe("center");
    }
  });

  it("throws UNION_TEMPLATE_INVALID if drawing1.xml is missing required shapes", async () => {
    // Read valid template and mutate drawing1.xml to strip shapes
    const validBuf = await buildLicenseExcelDocument(baseDto);
    const zip = new PizZip(validBuf);
    zip.file("xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>`);
    const mutatedBuf = zip.generate({ type: "nodebuffer" });

    await expect(buildLicenseExcelDocument(baseDto, mutatedBuf)).rejects.toMatchObject({
      code: "UNION_TEMPLATE_INVALID",
    });
  });

  it("legacy wrapper buildLicenseExcel functions properly with V2 template", async () => {
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

    expect(legacyBuf.length).toBeGreaterThan(30000);
    const zip = new PizZip(legacyBuf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";
    expect(licXml).toContain("XXI-2026-LIC-000099");
    expect(licXml).toContain("GÓMEZ");
  });

  it("corrects fixture XXI-2026-LIC-000006 with vertical centering, clean empty descansos, and shrinkToFit", async () => {
    const fixtureDto: UnionLicenseDocumentData = {
      ...baseDto,
      folio: "XXI-2026-LIC-000006",
      elaborationDate: "2026-09-10",
      elaborationDay: "10",
      elaborationMonth: "09",
      elaborationMonthName: "SEPTIEMBRE",
      elaborationYear: "2026",
      placeDateString: "Charo, Michoacán a 10 DE SEPTIEMBRE del 2026",
      worker: {
        ...baseDto.worker,
        employeeNumber: "98173968",
        firstName: "EDUARDO",
        paternalSurname: "BOLAÑOS",
        maternalSurname: "VAZQUEZ",
        fullName: "BOLAÑOS VAZQUEZ EDUARDO",
        category: "TECNICO RADIOLOGO 80",
        assignment: "HOSPITAL GENERAL REGIONAL No. 1",
        turn: "VESPERTINO",
        schedule: "14.00 A 21.30 JORNADA MIXTA",
        restDays: "",
        phone: "",
      },
      license: {
        ...baseDto.license,
        withPay: true,
        payKindWord: "CON",
        payKindLabel: "CON GOCE DE SUELDO",
        licenseRangeType: "with_pay",
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
        isExtension: false,
        reason: "CIRUGÍA PADRE",
        proof: "INE",
      },
    };

    const buf = await buildLicenseExcelDocument(fixtureDto);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(licXml, "text/xml");

    const getCell = (ref: string) => {
      const cells = doc.getElementsByTagName("c");
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].getAttribute("r") === ref) return cells[i];
      }
      return null;
    };

    // 1. Checkboxes
    expect(getCell("H9")?.textContent).toBe("X");
    expect(getCell("O9")?.textContent ?? "").not.toBe("X");
    expect(getCell("H11")?.textContent ?? "").not.toBe("X");
    expect(getCell("O11")?.textContent ?? "").not.toBe("X");

    // 2. Worker fields
    expect(getCell("B15")?.textContent).toBe("BOLAÑOS");
    expect(getCell("F15")?.textContent).toBe("VAZQUEZ");
    expect(getCell("J15")?.textContent).toBe("EDUARDO");
    expect(getCell("Q15")?.textContent).toBe("98173968");
    expect(getCell("S15")?.textContent).toBe("VESPERTINO");
    expect(getCell("C17")?.textContent).toBe("TECNICO RADIOLOGO 80");
    expect(getCell("J17")?.textContent).toBe("HOSPITAL GENERAL REGIONAL No. 1");
    expect(getCell("S1")?.textContent).toBe("14.00 A 21.30 JORNADA MIXTA");

    // 3. Descansos vacíos: celda limpia, sin "undefined", "-", ni residuo
    const s2Cell = getCell("S2");
    const s2Text = s2Cell?.textContent ?? "";
    expect(s2Text).not.toContain("undefined");
    expect(s2Text).not.toContain("null");
    expect(s2Text.trim()).toBe("");

    // 4. Fechas y firma
    expect(getCell("F24")?.textContent).toContain("2  DÍAS");
    expect(getCell("F27")?.textContent).toBe("CIRUGÍA PADRE");
    expect(getCell("F28")?.textContent).toBe("INE");
    expect(getCell("B47")?.textContent).toBe("C. BOLAÑOS VAZQUEZ EDUARDO");

    // 5. Zero #REF!
    expect(licXml).not.toContain("#REF!");

    // 6. VBA macro binary preserved
    const vba = zip.file("xl/vbaProject.bin");
    expect(vba).not.toBeNull();
    expect(vba?.asNodeBuffer().length).toBe(22528);

    // 7. Verification of vertical centering in xl/styles.xml
    const stylesXml = zip.file("xl/styles.xml")?.asText() ?? "";
    const stylesDoc = parser.parseFromString(stylesXml, "text/xml");
    const cellXfs = stylesDoc.getElementsByTagName("cellXfs")[0];
    const xfs: XmlElement[] = [];
    for (let i = 0; i < cellXfs.childNodes.length; i++) {
      if (cellXfs.childNodes[i].nodeType === 1) xfs.push(cellXfs.childNodes[i] as unknown as XmlElement);
    }

    // Check that schedule S1 style has vertical=center and shrinkToFit=1
    const s1StyleIdx = parseInt(getCell("S1")?.getAttribute("s") ?? "0", 10);
    const s1Xf = xfs[s1StyleIdx];
    const s1Align = s1Xf?.getElementsByTagName("alignment")[0];
    expect(s1Align?.getAttribute("vertical")).toBe("center");
    expect(s1Align?.getAttribute("shrinkToFit")).toBe("1");

    // Check that category C17 style has vertical=center
    const c17StyleIdx = parseInt(getCell("C17")?.getAttribute("s") ?? "0", 10);
    const c17Xf = xfs[c17StyleIdx];
    const c17Align = c17Xf?.getElementsByTagName("alignment")[0];
    expect(c17Align?.getAttribute("vertical")).toBe("center");
  });

  it("Caso 3 & 4: teléfono con formato libre ('044 443 123 4567') y con cero inicial ('0123456789') en celda A26", async () => {
    const dtoWithCustomPhone: UnionLicenseDocumentData = {
      ...baseDto,
      worker: {
        ...baseDto.worker,
        restDays: "VIE - SÁB",
        phone: "044 443 123 4567",
      },
    };

    const buf = await buildLicenseExcelDocument(dtoWithCustomPhone);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(licXml, "text/xml");

    const getCell = (ref: string) => {
      const cells = doc.getElementsByTagName("c");
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].getAttribute("r") === ref) return cells[i];
      }
      return null;
    };

    // Celda S2 tiene descansos en mayúsculas
    expect(getCell("S2")?.textContent).toBe("VIE - SÁB");

    // Celda A26 tiene teléfono exacto con prefijo TEL.
    const a26Cell = getCell("A26");
    expect(a26Cell?.textContent).toBe("TEL.  044 443 123 4567");
    expect(a26Cell?.getAttribute("t")).toBe("inlineStr");

    // Probar cero inicial directo
    const dtoLeadingZero: UnionLicenseDocumentData = {
      ...baseDto,
      worker: {
        ...baseDto.worker,
        phone: "0123456789",
      },
    };
    const buf2 = await buildLicenseExcelDocument(dtoLeadingZero);
    const zip2 = new PizZip(buf2);
    const doc2 = parser.parseFromString(zip2.file(licPath)?.asText() ?? "", "text/xml");
    const cells2 = doc2.getElementsByTagName("c");
    let a26Zero = null;
    for (let i = 0; i < cells2.length; i++) {
      if (cells2[i].getAttribute("r") === "A26") {
        a26Zero = cells2[i];
        break;
      }
    }
    expect(a26Zero?.textContent).toBe("TEL.  0123456789");
  });

  it("Caso 5: si descansos y teléfono vienen vacíos, en el Excel las celdas quedan vacías (no 'undefined', no 'null', no 'TEL.')", async () => {
    const dtoEmpty: UnionLicenseDocumentData = {
      ...baseDto,
      worker: {
        ...baseDto.worker,
        restDays: "",
        phone: "",
      },
    };

    const buf = await buildLicenseExcelDocument(dtoEmpty);
    const zip = new PizZip(buf);
    const licPath = resolveSheetPathByName(zip, "Licencia");
    const licXml = zip.file(licPath)?.asText() ?? "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(licXml, "text/xml");

    const getCell = (ref: string) => {
      const cells = doc.getElementsByTagName("c");
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].getAttribute("r") === ref) return cells[i];
      }
      return null;
    };

    // Celda S2 (Descansos) vacía
    const s2Text = getCell("S2")?.textContent ?? "";
    expect(s2Text.trim()).toBe("");
    expect(s2Text).not.toContain("undefined");
    expect(s2Text).not.toContain("null");
    expect(s2Text).not.toContain("N/A");

    // Celda A26 (Teléfono) vacía: no "TEL.", no "TEL. ", no "undefined", no "null"
    const a26Text = getCell("A26")?.textContent ?? "";
    expect(a26Text.trim()).toBe("");
    expect(a26Text).not.toContain("TEL.");
    expect(a26Text).not.toContain("undefined");
    expect(a26Text).not.toContain("null");
  });
});
