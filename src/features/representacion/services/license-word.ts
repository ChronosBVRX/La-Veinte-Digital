import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { UnionLicenseDocumentData } from "./license-document-dto";

export interface LicenseLetterData {
  section: string;
  placeDate: string;
  recipientName: string;
  recipientRole: string;
  payKindLabel: string;
  workerFullName: string;
  employeeNumber: string;
  category: string;
  reason: string;
  periodLabel: string;
  turn: string;
  restDays: string;
  totalDays: number;
  committeeName: string;
  motto: string;
  signerName: string;
  signerRole: string;
}

const LOCAL_FALLBACK_TEMPLATE_PATH = path.join(
  process.cwd(),
  "assets/templates/union/licencias/oficio-licencia-delegacion-xxi.docx",
);

/**
 * Builds the official union license letter Word document (.docx) by reading the
 * master template buffer (from private storage or fallback), surgically updating
 * the XML DOM nodes, and preserving 100% of shapes, floating logo, sidebar directory
 * table, fonts, margins, and official headers/footers.
 */
export function buildLicenseWordDocument(
  data: UnionLicenseDocumentData,
  templateBuffer?: Buffer,
): Buffer {
  let templateBuf = templateBuffer;
  if (!templateBuf) {
    if (fs.existsSync(LOCAL_FALLBACK_TEMPLATE_PATH)) {
      templateBuf = fs.readFileSync(LOCAL_FALLBACK_TEMPLATE_PATH);
    } else {
      throw new Error(
        `Plantilla Word oficial no proporcionada y no encontrada en fallback: ${LOCAL_FALLBACK_TEMPLATE_PATH}`,
      );
    }
  }

  const zip = new PizZip(templateBuf);
  const docXml = zip.file("word/document.xml")?.asText();

  if (!docXml) {
    throw new Error("No se encontró word/document.xml en la plantilla Word");
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const xmlDoc = parser.parseFromString(docXml, "text/xml");

  const tList = xmlDoc.getElementsByTagName("w:t");

  const placeholderMap: Record<string, string> = {
    "{{sidebarDelegation}}": `COMITÉ DELEGACIONAL ${data.delegationCode} `,
    "{{generalSecretary}}": data.signers.generalSecretary,
    "{{interiorSecretary}}": data.signers.interiorSecretary,
    "{{conflictsSecretary}}": data.signers.conflictsSecretary,
    "{{admissionSecretary}}": data.signers.admissionSecretary,
    "{{socialWelfareSecretary}}": data.signers.socialWelfareSecretary,
    "{{placeDate}}": data.placeDateString,
    "{{recipientName}}": data.recipient.name,
    "{{recipientRole}}": data.recipient.role,
    "{{payKind}}": data.license.payKindWord,
    "{{workerFullName}}": data.worker.fullName,
    "{{employeeNumber}}": data.worker.employeeNumber,
    "{{category}}": data.worker.category,
    "{{reason}}": data.license.reason,
    "{{periodLabel}}": data.license.periodLabelWord,
    "{{turn}}": data.worker.turn,
    "{{restDays}}": data.worker.restDays,
    "{{totalDays}}": String(data.license.totalDays),
    "{{daysUnit}}": data.license.daysUnit,
    "{{motto}}": `“${data.signers.institutionalMotto.replace(/^["“]|["”]$/g, "")}”`,
    "{{committeeName}}": data.signers.committeeName,
    "{{signerName}}": data.signers.signerName,
    "{{signerRole}}": data.signers.signerRole,
    "{{signerDelegation}}": data.delegationCode || "XXI",
  };

  let hasPlaceholders = false;
  for (let i = 0; i < tList.length; i++) {
    let val = tList[i].textContent ?? "";
    for (const [key, replacement] of Object.entries(placeholderMap)) {
      if (val.includes(key)) {
        hasPlaceholders = true;
        val = val.replaceAll(key, replacement);
      }
    }
    tList[i].textContent = val;
  }

  // If template did not contain placeholders, apply positional / content replacements
  if (!hasPlaceholders) {
    const setNode = (idx: number, text: string) => {
      if (tList[idx]) {
        tList[idx].textContent = text;
      }
    };

    const isStandardIndices =
      tList[9]?.textContent?.includes("COMITÉ DELEGACIONAL") &&
      tList[43]?.textContent?.trim() === "CON" &&
      tList[49]?.textContent?.includes("LÓPEZ CASTRO");

    if (isStandardIndices) {
      setNode(9, `COMITÉ DELEGACIONAL ${data.delegationCode} `);
      setNode(10, data.signers.generalSecretary);
      setNode(12, data.signers.interiorSecretary);
      setNode(14, data.signers.conflictsSecretary);
      setNode(16, data.signers.admissionSecretary);
      setNode(18, data.signers.socialWelfareSecretary);
      setNode(21, data.placeDateString);
      setNode(22, "");
      setNode(23, "");
      setNode(26, "");
      setNode(28, "");
      setNode(30, "");
      setNode(31, data.recipient.name);
      setNode(33, "");
      setNode(34, "");
      setNode(36, "");
      setNode(37, "");
      setNode(38, data.recipient.role);
      setNode(39, "");
      setNode(43, data.license.payKindWord);
      setNode(49, data.worker.fullName);
      setNode(53, data.worker.employeeNumber);
      setNode(57, data.worker.category);
      setNode(62, data.license.reason);
      setNode(69, data.license.periodLabelWord);
      setNode(70, "");
      setNode(71, "");
      setNode(72, "");
      setNode(75, data.worker.turn);
      setNode(79, data.worker.restDays);
      setNode(84, String(data.license.totalDays));
      setNode(86, data.license.daysUnit);
      const mottoClean = data.signers.institutionalMotto.replace(/^["“]|["”]$/g, "");
      setNode(94, `“${mottoClean}”`);
      setNode(95, data.signers.committeeName);
      setNode(96, "");
      setNode(98, data.signers.signerName);
      setNode(99, "");
      setNode(100, "");
      setNode(101, data.signers.signerRole);
      setNode(102, data.delegationCode || "XXI");
    } else {
      for (let i = 0; i < tList.length; i++) {
        const node = tList[i];
        const val = node.textContent ?? "";

        if (val.includes("COMITÉ DELEGACIONAL")) {
          node.textContent = `COMITÉ DELEGACIONAL ${data.delegationCode} `;
        } else if (val.includes("Charo, Michoacán")) {
          node.textContent = data.placeDateString;
        } else if (val.includes("L.A.E.") || val.includes("SARAI MORALES")) {
          node.textContent = data.recipient.name;
        } else if (val.includes("Jefe de Personal")) {
          node.textContent = data.recipient.role;
        } else if (val.trim() === "CON" || val.trim() === "SIN") {
          node.textContent = data.license.payKindWord;
        } else if (val.includes("LÓPEZ CASTRO") || val.includes("LOPEZ CASTRO")) {
          node.textContent = data.worker.fullName;
        } else if (val.includes("97173345")) {
          node.textContent = data.worker.employeeNumber;
        } else if (val.includes("ENFERMERA GENERAL")) {
          node.textContent = data.worker.category;
        } else if (val.includes("INTERNAMIENTO DE HIJO")) {
          node.textContent = data.license.reason;
        } else if (val.includes("31 DE AGOSTO")) {
          node.textContent = data.license.periodLabelWord;
        } else if (val.includes("VESPERTINO") || val.includes("MATUTINO") || val.includes("NOCTURNO")) {
          node.textContent = data.worker.turn;
        } else if (val.includes("JUE- VIE") || val.includes("JUE-VIE")) {
          node.textContent = data.worker.restDays;
        } else if (val.includes("Delegación XIV") || val.includes("Delegacion XIV")) {
          node.textContent = data.signers.committeeName;
        } else if (val.includes("LORENA GUADALUPE SOLORIO")) {
          node.textContent = data.signers.signerName;
        } else if (val.includes("Secretario del Interior")) {
          node.textContent = data.signers.signerRole;
        }
      }
    }
  }

  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file("word/document.xml", updatedXml, { compression: "STORE" });

  return zip.generate({ type: "nodebuffer" });
}

/**
 * Backward compatibility wrapper for legacy callers and tests.
 */
export function buildLicenseLetterDocxDirect(d: LicenseLetterData): Buffer {
  const isConGoce = d.payKindLabel.toUpperCase().includes("CON");
  const data: UnionLicenseDocumentData = {
    caseId: "legacy-test",
    folio: "XXI-2026-LIC-000000",
    delegationId: "legacy",
    delegationCode: "XXI",
    delegationDisplayName: d.committeeName || "Comité Delegacional XXI",
    centerName: "HGR No. 1",
    centerAddress: "La Goleta, Charo, Michoacán",
    ooad: "MICHOACÁN",
    place: "LA GOLETA, CHARO, MICHOACÁN",
    elaborationDate: "2026-09-17",
    elaborationDay: "17",
    elaborationMonth: "09",
    elaborationMonthName: "SEPTIEMBRE",
    elaborationYear: "2026",
    placeDateString: d.placeDate || "Charo, Michoacán a 17 DE SEPTIEMBRE del 2026",
    worker: {
      id: "legacy-worker",
      employeeNumber: d.employeeNumber,
      firstName: "",
      paternalSurname: "",
      maternalSurname: "",
      fullName: d.workerFullName,
      category: d.category,
      assignment: "HOSPITAL GENERAL REGIONAL No. 1",
      turn: d.turn,
      schedule: "",
      restDays: d.restDays,
      phone: "",
    },
    license: {
      withPay: isConGoce,
      payKindWord: isConGoce ? "CON" : "SIN",
      payKindLabel: d.payKindLabel,
      licenseRangeType: isConGoce ? "with_pay" : "r1_3",
      licenseRangeLabel: d.payKindLabel,
      startDate: "2026-09-17",
      startDay: "17",
      startMonth: "09",
      startYear: "2026",
      endDate: "2026-09-18",
      endDay: "18",
      endMonth: "09",
      endYear: "2026",
      periodLabelWord: d.periodLabel,
      totalDays: d.totalDays,
      daysUnit: d.totalDays === 1 ? "DÍA" : "DÍAS",
      isExtension: false,
      reason: d.reason,
      proof: "—",
      debtStatus: "Pendiente",
    },
    recipient: {
      name: d.recipientName,
      role: d.recipientRole,
    },
    signers: {
      signerName: d.signerName,
      signerRole: d.signerRole,
      institutionalMotto: d.motto || "Seguridad Social y Bienestar Económico de los Trabajadores",
      committeeName: d.committeeName || "Comité Delegacional XXI",
      sidebarDelegation: "COMITÉ DELEGACIONAL XXI",
      generalSecretary: "CUITLÁHUAC CERDA GUTIÉRREZ",
      interiorSecretary: "LORENA GUADALUPE SOLORIO CHÁVEZ",
      conflictsSecretary: "MAYRA ZENDEJAS RODRÍGUEZ",
      admissionSecretary: "PATRICIA GONZÁLEZ MÉNDEZ",
      socialWelfareSecretary: "GRACIELA CORTEZ CÁRDENAS",
    },
  };

  return buildLicenseWordDocument(data);
}

export function buildLicenseLetterDocx(data: LicenseLetterData): Buffer {
  return buildLicenseLetterDocxDirect(data);
}
