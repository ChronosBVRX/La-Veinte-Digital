import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { DOMParser, XMLSerializer, type Document as XmlDocument } from "@xmldom/xmldom";
import type { UnionLicenseDocumentData } from "./license-document-dto";

export interface LicenseExcelWorker {
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
  turn: string;
  schedule: string;
  restDays: string;
}

export interface LicenseExcelInput {
  ooad: string;
  place: string;
  folio: string;
  elaborationDay: string;
  elaborationMonth: string;
  elaborationYear: string;
  worker: LicenseExcelWorker;
  withPay: boolean;
  rangeLabel: string;
  startDay: string;
  startMonth: string;
  startYear: string;
  endDay: string;
  endMonth: string;
  endYear: string;
  totalDays: number;
  isExtension: boolean;
  reason: string;
  proof: string;
  phone: string;
  debtStatus: string;
}

const LOCAL_FALLBACK_TEMPLATE_PATH = path.join(
  process.cwd(),
  "assets/templates/union/licencias/formato-licencia-1A74-009-036-v2.xlsm",
);
const LEGACY_FALLBACK_TEMPLATE_PATH = path.join(
  process.cwd(),
  "assets/templates/union/licencias/formato-licencia-1A74-009-036.xlsm",
);

/**
 * Dynamically resolves the physical worksheet XML file path (e.g. xl/worksheets/sheet1.xml)
 * for a given sheet name by inspecting xl/workbook.xml and xl/_rels/workbook.xml.rels.
 * Never hardcodes sheet numbers or assumes physical relationship ordering.
 */
export function resolveSheetPathByName(zip: PizZip, sheetName: string): string {
  const wbXmlStr = zip.file("xl/workbook.xml")?.asText();
  if (!wbXmlStr) {
    throw new Error("No se encontró xl/workbook.xml en la plantilla Excel");
  }
  const relsXmlStr = zip.file("xl/_rels/workbook.xml.rels")?.asText();
  if (!relsXmlStr) {
    throw new Error("No se encontró xl/_rels/workbook.xml.rels en la plantilla Excel");
  }

  // 1. Locate <sheet name="sheetName" ... r:id="..."/>
  const sheetRegex = new RegExp(
    `<sheet[^>]*name="${sheetName}"[^>]*r:id="([^"]+)"|<sheet[^>]*r:id="([^"]+)"[^>]*name="${sheetName}"`,
    "i",
  );
  const match = wbXmlStr.match(sheetRegex);
  const rId = match ? match[1] || match[2] : null;
  if (!rId) {
    throw new Error(`No se encontró la hoja "${sheetName}" en xl/workbook.xml`);
  }

  // 2. Locate <Relationship Id="rId" ... Target="..."/> in workbook.xml.rels
  const relRegex = new RegExp(
    `<Relationship[^>]*Id="${rId}"[^>]*Target="([^"]+)"|<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rId}"`,
    "i",
  );
  const relMatch = relsXmlStr.match(relRegex);
  const target = relMatch ? relMatch[1] || relMatch[2] : null;
  if (!target) {
    throw new Error(`No se encontró la relación "${rId}" para la hoja "${sheetName}" en workbook.xml.rels`);
  }

  // 3. Normalize relative path to zip root (e.g. worksheets/sheet1.xml -> xl/worksheets/sheet1.xml)
  const cleanTarget = target.startsWith("/") ? target.slice(1) : target;
  return cleanTarget.startsWith("xl/") ? cleanTarget : `xl/${cleanTarget}`;
}

export function hasSheet(zip: PizZip, sheetName: string): boolean {
  try {
    resolveSheetPathByName(zip, sheetName);
    return true;
  } catch {
    return false;
  }
}

function setCellText(doc: XmlDocument, cellRef: string, text: string): void {
  const cells = doc.getElementsByTagName("c");
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.getAttribute("r") === cellRef) {
      c.setAttribute("t", "inlineStr");
      while (c.firstChild) {
        c.removeChild(c.firstChild);
      }
      const isElem = doc.createElement("is");
      const tElem = doc.createElement("t");
      tElem.textContent = text;
      isElem.appendChild(tElem);
      c.appendChild(isElem);
      return;
    }
  }

  // If cell element not found, search row and append
  const rowMatch = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (rowMatch) {
    const rowNum = rowMatch[2];
    const rows = doc.getElementsByTagName("row");
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      if (r.getAttribute("r") === rowNum) {
        const cElem = doc.createElement("c");
        cElem.setAttribute("r", cellRef);
        cElem.setAttribute("t", "inlineStr");
        const isElem = doc.createElement("is");
        const tElem = doc.createElement("t");
        tElem.textContent = text;
        isElem.appendChild(tElem);
        cElem.appendChild(isElem);
        r.appendChild(cElem);
        return;
      }
    }
  }
}

function setCellNum(doc: XmlDocument, cellRef: string, num: string | number): void {
  const cells = doc.getElementsByTagName("c");
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.getAttribute("r") === cellRef) {
      c.removeAttribute("t");
      while (c.firstChild) {
        c.removeChild(c.firstChild);
      }
      const vElem = doc.createElement("v");
      vElem.textContent = String(num);
      c.appendChild(vElem);
      return;
    }
  }

  const rowMatch = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (rowMatch) {
    const rowNum = rowMatch[2];
    const rows = doc.getElementsByTagName("row");
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      if (r.getAttribute("r") === rowNum) {
        const cElem = doc.createElement("c");
        cElem.setAttribute("r", cellRef);
        const vElem = doc.createElement("v");
        vElem.textContent = String(num);
        cElem.appendChild(vElem);
        r.appendChild(cElem);
        return;
      }
    }
  }
}

function clearCell(doc: XmlDocument, cellRef: string): void {
  const cells = doc.getElementsByTagName("c");
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.getAttribute("r") === cellRef) {
      c.removeAttribute("t");
      while (c.firstChild) {
        c.removeChild(c.firstChild);
      }
      return;
    }
  }
}

/**
 * Builds the official institutional license Excel form 1A74-009-036 (.xlsm)
 * by reading the master template buffer (from private storage or fallback),
 * modifying Generador and Licencia sheets in-memory, and preserving 100% of shapes,
 * drawings, formulas, and the VBA macro binary (xl/vbaProject.bin).
 */
export async function buildLicenseExcelDocument(
  data: UnionLicenseDocumentData,
  templateBuffer?: Buffer,
): Promise<Buffer> {
  let templateBuf = templateBuffer;
  if (!templateBuf) {
    if (fs.existsSync(LOCAL_FALLBACK_TEMPLATE_PATH)) {
      templateBuf = fs.readFileSync(LOCAL_FALLBACK_TEMPLATE_PATH);
    } else if (fs.existsSync(LEGACY_FALLBACK_TEMPLATE_PATH)) {
      templateBuf = fs.readFileSync(LEGACY_FALLBACK_TEMPLATE_PATH);
    } else {
      throw new Error(
        `Plantilla Excel oficial no proporcionada y no encontrada en fallback: ${LOCAL_FALLBACK_TEMPLATE_PATH}`,
      );
    }
  }

  const zip = new PizZip(templateBuf);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // 1. If legacy "Generador" sheet exists, update it for backward compatibility
  if (hasSheet(zip, "Generador")) {
    const genPath = resolveSheetPathByName(zip, "Generador");
    const genXmlStr = zip.file(genPath)?.asText();
    if (genXmlStr) {
      const docGen = parser.parseFromString(genXmlStr, "text/xml");
      setCellNum(docGen, "E9", parseInt(data.elaborationDay, 10) || 1);
      setCellNum(docGen, "F9", parseInt(data.elaborationMonth, 10) || 1);
      setCellNum(docGen, "G9", parseInt(data.elaborationYear, 10) || 2026);
      setCellText(docGen, "J12", data.folio);
      setCellText(docGen, "E11", data.worker.firstName);
      setCellText(docGen, "F11", data.worker.paternalSurname);
      setCellText(docGen, "G11", data.worker.maternalSurname);
      setCellText(docGen, "E12", data.worker.category);
      setCellText(docGen, "E13", data.worker.schedule);
      setCellText(docGen, "E14", data.worker.turn);
      setCellText(docGen, "E15", data.worker.employeeNumber);
      setCellText(docGen, "E16", data.worker.restDays);
      setCellText(docGen, "E17", data.license.reason);
      setCellText(docGen, "E18", data.license.proof);
      setCellText(docGen, "E19", data.worker.phone);
      setCellText(docGen, "E20", data.license.withPay ? "Con goce" : "Sin goce");
      setCellNum(docGen, "E23", parseInt(data.license.startDay, 10) || 1);
      setCellNum(docGen, "F23", parseInt(data.license.startMonth, 10) || 1);
      setCellNum(docGen, "G23", parseInt(data.license.startYear, 10) || 2026);
      setCellNum(docGen, "I23", parseInt(data.license.endDay, 10) || 1);
      setCellNum(docGen, "J23", parseInt(data.license.endMonth, 10) || 1);
      setCellNum(docGen, "K23", parseInt(data.license.endYear, 10) || 2026);
      setCellText(docGen, "E24", `${data.license.totalDays}  ${data.license.daysUnit}`);
      zip.file(genPath, serializer.serializeToString(docGen));
    }
  }

  // 2. Resolve "Licencia" sheet dynamically (e.g. xl/worksheets/sheet1.xml)
  const licenciaPath = resolveSheetPathByName(zip, "Licencia");
  const licXmlStr = zip.file(licenciaPath)?.asText();
  if (!licXmlStr) {
    throw new Error(`No se pudo leer el XML de la hoja Licencia en: ${licenciaPath}`);
  }

  const docLic = parser.parseFromString(licXmlStr, "text/xml");

  // Elaboration Date & Folio
  setCellText(docLic, "M7", data.folio);
  setCellNum(docLic, "Q7", parseInt(data.elaborationDay, 10) || 1);
  setCellNum(docLic, "R7", parseInt(data.elaborationMonth, 10) || 1);
  setCellNum(docLic, "S7", parseInt(data.elaborationYear, 10) || 2026);

  // License type checkboxes
  clearCell(docLic, "H9");
  clearCell(docLic, "P9");
  clearCell(docLic, "H11");
  clearCell(docLic, "P11");

  if (data.license.withPay) {
    setCellText(docLic, "H9", "X"); // Licencia con sueldo
  } else {
    const range = data.license.licenseRangeType;
    if (range === "r1_3") {
      setCellText(docLic, "P9", "X"); // Licencia sin sueldo de 1 a 3 días
    } else if (range === "r4_60") {
      setCellText(docLic, "H11", "X"); // Licencia sin sueldo de 4 a 60 días
    } else {
      setCellText(docLic, "P11", "X"); // Licencia sin sueldo de 61 a 365 días
    }
  }

  // Worker Info
  setCellText(docLic, "B15", data.worker.paternalSurname);
  setCellText(docLic, "F15", data.worker.maternalSurname);
  setCellText(docLic, "J15", data.worker.firstName);
  setCellText(docLic, "Q15", data.worker.employeeNumber);
  setCellText(docLic, "S15", data.worker.turn);

  // Category
  setCellText(docLic, "C17", data.worker.category);

  // Schedule & Rest Days
  setCellText(docLic, "S1", data.worker.schedule);
  setCellText(docLic, "S2", data.worker.restDays);

  // License Period
  setCellNum(docLic, "B21", parseInt(data.license.startDay, 10) || 1);
  setCellNum(docLic, "D21", parseInt(data.license.startMonth, 10) || 1);
  setCellNum(docLic, "E21", parseInt(data.license.startYear, 10) || 2026);
  setCellNum(docLic, "F21", parseInt(data.license.endDay, 10) || 1);
  setCellNum(docLic, "H21", parseInt(data.license.endMonth, 10) || 1);
  setCellNum(docLic, "I21", parseInt(data.license.endYear, 10) || 2026);

  // Previous dates if provided
  if (data.license.previousStartDate) {
    const prevS = data.license.previousStartDate.split("-");
    setCellNum(docLic, "J21", parseInt(prevS[2] ?? "0", 10));
    setCellNum(docLic, "M21", parseInt(prevS[1] ?? "0", 10));
    setCellNum(docLic, "O21", parseInt(prevS[0] ?? "0", 10));
  }
  if (data.license.previousEndDate) {
    const prevE = data.license.previousEndDate.split("-");
    setCellNum(docLic, "Q21", parseInt(prevE[2] ?? "0", 10));
    setCellNum(docLic, "R21", parseInt(prevE[1] ?? "0", 10));
    setCellNum(docLic, "S21", parseInt(prevE[0] ?? "0", 10));
  }

  // Prórroga Checkbox
  clearCell(docLic, "B24");
  clearCell(docLic, "D24");
  if (data.license.isExtension) {
    setCellText(docLic, "B24", "X"); // SÍ
  } else {
    setCellText(docLic, "D24", "X"); // NO
  }

  // Total Days
  setCellText(docLic, "F24", `${data.license.totalDays}  ${data.license.daysUnit}`);

  // Phone
  setCellText(docLic, "A26", data.worker.phone ? `TEL. ${data.worker.phone}` : "TEL. ");

  // Reason & Proof
  setCellText(docLic, "F27", data.license.reason);
  setCellText(docLic, "F28", data.license.proof);

  // Worker Signature Name
  setCellText(docLic, "B47", `C. ${data.worker.fullName}`);

  let serializedLic = serializer.serializeToString(docLic);

  // Eradicate any residual #REF! in Licencia XML
  if (serializedLic.includes("#REF!")) {
    serializedLic = serializedLic
      .replace(/<x14:conditionalFormattings>[\s\S]*?<\/x14:conditionalFormattings>/g, "")
      .replace(/<f>#REF!<\/f>/g, "")
      .replace(/<v>#REF!<\/v>/g, "");
  }

  zip.file(licenciaPath, serializedLic);

  // 3. Remove obsolete calcChain.xml to guarantee clean opening in Excel without repairs
  zip.remove("xl/calcChain.xml");
  const ctStr = zip.file("[Content_Types].xml")?.asText();
  if (ctStr && ctStr.includes("calcChain.xml")) {
    zip.file("[Content_Types].xml", ctStr.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, ""));
  }
  const wbRelsStr = zip.file("xl/_rels/workbook.xml.rels")?.asText();
  if (wbRelsStr && wbRelsStr.includes("calcChain.xml")) {
    zip.file("xl/_rels/workbook.xml.rels", wbRelsStr.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g, ""));
  }

  const outBuf = zip.generate({ type: "nodebuffer" });
  return Buffer.from(outBuf);
}

/**
 * Backward compatibility wrapper for legacy callers and tests.
 */
export async function buildLicenseExcel(input: LicenseExcelInput): Promise<Buffer> {
  let rangeType: "with_pay" | "r1_3" | "r4_60" | "r61_365" = "with_pay";
  if (!input.withPay) {
    const rl = input.rangeLabel.toLowerCase();
    if (rl.includes("1 a 3") || input.totalDays <= 3) {
      rangeType = "r1_3";
    } else if (rl.includes("4 a 60") || input.totalDays <= 60) {
      rangeType = "r4_60";
    } else {
      rangeType = "r61_365";
    }
  }

  const fullName = [input.worker.paternalSurname, input.worker.maternalSurname, input.worker.firstName]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const data: UnionLicenseDocumentData = {
    caseId: "legacy-test",
    folio: input.folio,
    delegationId: "legacy",
    delegationCode: "XXI",
    delegationDisplayName: "Comité Delegacional XXI",
    centerName: "HGR No. 1",
    centerAddress: "La Goleta, Charo, Michoacán",
    ooad: input.ooad || "MICHOACÁN",
    place: input.place || "LA GOLETA, CHARO, MICHOACÁN",
    elaborationDate: `${input.elaborationYear}-${input.elaborationMonth}-${input.elaborationDay}`,
    elaborationDay: input.elaborationDay,
    elaborationMonth: input.elaborationMonth,
    elaborationMonthName: "SEPTIEMBRE",
    elaborationYear: input.elaborationYear,
    placeDateString: `Charo, Michoacán a ${input.elaborationDay} DE SEPTIEMBRE del ${input.elaborationYear}`,
    worker: {
      id: "legacy-worker",
      employeeNumber: input.worker.employeeNumber,
      firstName: input.worker.firstName,
      paternalSurname: input.worker.paternalSurname,
      maternalSurname: input.worker.maternalSurname,
      fullName,
      category: input.worker.category,
      assignment: input.worker.assignment,
      turn: input.worker.turn,
      schedule: input.worker.schedule,
      restDays: input.worker.restDays,
      phone: input.phone,
    },
    license: {
      withPay: input.withPay,
      payKindWord: input.withPay ? "CON" : "SIN",
      payKindLabel: input.withPay ? "CON GOCE" : "SIN GOCE",
      licenseRangeType: rangeType,
      licenseRangeLabel: input.rangeLabel,
      startDate: `${input.startYear}-${input.startMonth}-${input.startDay}`,
      startDay: input.startDay,
      startMonth: input.startMonth,
      startYear: input.startYear,
      endDate: `${input.endYear}-${input.endMonth}-${input.endDay}`,
      endDay: input.endDay,
      endMonth: input.endMonth,
      endYear: input.endYear,
      periodLabelWord: `DEL ${input.startDay} AL ${input.endDay}`,
      totalDays: input.totalDays,
      daysUnit: input.totalDays === 1 ? "DÍA" : "DÍAS",
      isExtension: input.isExtension,
      reason: input.reason,
      proof: input.proof,
      debtStatus: input.debtStatus,
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

  return buildLicenseExcelDocument(data);
}
