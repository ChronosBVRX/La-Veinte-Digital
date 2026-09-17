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
  "assets/templates/union/licencias/formato-licencia-1A74-009-036.xlsm",
);

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
    } else {
      throw new Error(
        `Plantilla Excel oficial no proporcionada y no encontrada en fallback: ${LOCAL_FALLBACK_TEMPLATE_PATH}`,
      );
    }
  }

  const zip = new PizZip(templateBuf);

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // 1. Update Sheet 1: Generador
  const s1XmlStr = zip.file("xl/worksheets/sheet1.xml")?.asText();
  if (!s1XmlStr) {
    throw new Error("No se encontró xl/worksheets/sheet1.xml en la plantilla");
  }
  const doc1 = parser.parseFromString(s1XmlStr, "text/xml");

  // Elaboration date & Folio
  setCellNum(doc1, "E9", parseInt(data.elaborationDay, 10) || 1);
  setCellNum(doc1, "F9", parseInt(data.elaborationMonth, 10) || 1);
  setCellNum(doc1, "G9", parseInt(data.elaborationYear, 10) || 2026);
  setCellText(doc1, "J12", data.folio);

  // Worker Info
  setCellText(doc1, "E11", data.worker.firstName);
  setCellText(doc1, "F11", data.worker.paternalSurname);
  setCellText(doc1, "G11", data.worker.maternalSurname);
  setCellText(doc1, "E12", data.worker.category);
  setCellText(doc1, "E13", data.worker.schedule);
  setCellText(doc1, "E14", data.worker.turn);
  setCellText(doc1, "E15", data.worker.employeeNumber);
  setCellText(doc1, "E16", data.worker.restDays);
  setCellText(doc1, "E17", data.license.reason);
  setCellText(doc1, "E18", data.license.proof);
  setCellText(doc1, "E19", data.worker.phone);
  setCellText(doc1, "E20", data.license.withPay ? "Con goce" : "Sin goce");

  // License Period & Total Days
  setCellNum(doc1, "E23", parseInt(data.license.startDay, 10) || 1);
  setCellNum(doc1, "F23", parseInt(data.license.startMonth, 10) || 1);
  setCellNum(doc1, "G23", parseInt(data.license.startYear, 10) || 2026);
  setCellNum(doc1, "I23", parseInt(data.license.endDay, 10) || 1);
  setCellNum(doc1, "J23", parseInt(data.license.endMonth, 10) || 1);
  setCellNum(doc1, "K23", parseInt(data.license.endYear, 10) || 2026);
  setCellText(doc1, "E24", `${data.license.totalDays}  ${data.license.daysUnit}`);

  // 2. Update Sheet 2: Licencia Checkboxes
  const s2XmlStr = zip.file("xl/worksheets/sheet2.xml")?.asText();
  if (!s2XmlStr) {
    throw new Error("No se encontró xl/worksheets/sheet2.xml en la plantilla");
  }
  const doc2 = parser.parseFromString(s2XmlStr, "text/xml");

  // Clear all checkboxes first
  clearCell(doc2, "H9");
  clearCell(doc2, "P9");
  clearCell(doc2, "H11");
  clearCell(doc2, "P11");
  clearCell(doc2, "B24");
  clearCell(doc2, "D24");

  // License type checkbox
  if (data.license.withPay) {
    setCellText(doc2, "H9", "X"); // Licencia con sueldo
  } else {
    const range = data.license.licenseRangeType;
    if (range === "r1_3") {
      setCellText(doc2, "P9", "X"); // Licencia sin sueldo de 1 a 3 días
    } else if (range === "r4_60") {
      setCellText(doc2, "H11", "X"); // Licencia sin sueldo de 4 a 60 días
    } else {
      setCellText(doc2, "P11", "X"); // Licencia sin sueldo de 61 a 365 días
    }
  }

  // Prórroga checkbox
  if (data.license.isExtension) {
    setCellText(doc2, "B24", "X"); // SÍ
  } else {
    setCellText(doc2, "D24", "X"); // NO
  }

  // If previous dates provided
  if (data.license.previousStartDate) {
    const prevS = data.license.previousStartDate.split("-");
    setCellNum(doc2, "J21", parseInt(prevS[2] ?? "0", 10));
    setCellNum(doc2, "M21", parseInt(prevS[1] ?? "0", 10));
    setCellNum(doc2, "O21", parseInt(prevS[0] ?? "0", 10));
  }
  if (data.license.previousEndDate) {
    const prevE = data.license.previousEndDate.split("-");
    setCellNum(doc2, "Q21", parseInt(prevE[2] ?? "0", 10));
    setCellNum(doc2, "R21", parseInt(prevE[1] ?? "0", 10));
    setCellNum(doc2, "S21", parseInt(prevE[0] ?? "0", 10));
  }

  const newS1Str = serializer.serializeToString(doc1);
  const newS2Str = serializer.serializeToString(doc2);

  zip.file("xl/worksheets/sheet1.xml", newS1Str);
  zip.file("xl/worksheets/sheet2.xml", newS2Str);

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
