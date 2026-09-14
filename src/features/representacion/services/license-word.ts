// Oficio Word de licencia con docxtemplater + pizzip (sanitizado, parametrizado).
// Corrige el defecto del documento fuente (decía "Delegación XIV" dentro de un
// trámite XXI): la delegación siempre proviene de configuración, default XXI.

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export interface LicenseLetterData {
  section: string; // "SECCIÓN XX MICHOACÁN"
  placeDate: string; // "Charo, Michoacán a 7 DE SEPTIEMBRE del 2026"
  recipientName: string;
  recipientRole: string;
  payKindLabel: string; // "CON GOCE" | "SIN GOCE"
  workerFullName: string;
  employeeNumber: string;
  category: string;
  reason: string;
  periodLabel: string; // "DEL 31 DE AGOSTO AL 1 DE SEPTIEMBRE DEL 2026"
  turn: string;
  restDays: string;
  totalDays: number;
  committeeName: string; // "COMITÉ DELEGACIONAL XXI"
  motto: string;
  signerName: string;
  signerRole: string;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{% for p in paragraphs %}<w:p><w:r><w:t xml:space="preserve">{{ p }}</w:t></w:r></w:p>{% endfor %}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderDocumentXml(paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

export function buildLicenseLetterParagraphs(d: LicenseLetterData): string[] {
  return [
    "Sindicato Nacional de Trabajadores del Seguro Social",
    d.section,
    d.committeeName,
    "",
    d.placeDate,
    "",
    d.recipientName,
    d.recipientRole,
    "",
    `Por medio de la presente y de la manera más atenta nos permitimos enviar a Usted solicitud de Licencia ${d.payKindLabel} de sueldo por parte del C. ${d.workerFullName} con matrícula ${d.employeeNumber} categoría ${d.category} por motivo ${d.reason}, el cual solicita la fecha ${d.periodLabel}, turno ${d.turn}, descansos ${d.restDays} (${d.totalDays} DÍAS).`,
    "",
    "Esperando respuesta y agradeciendo la atención a la presente le envío un cordial saludo.",
    "",
    `“${d.motto}”`,
    d.committeeName,
    "",
    "_______________________________________________",
    d.signerName,
    d.signerRole,
  ];
}

export function buildLicenseLetterDocx(data: LicenseLetterData): Buffer {
  const paragraphs = buildLicenseLetterParagraphs(data);
  // Plantilla mínima en memoria (sin PII) + docxtemplater para el render.
  const templateZip = new PizZip();
  templateZip.file("[Content_Types].xml", CONTENT_TYPES);
  templateZip.file("_rels/.rels", RELS);
  templateZip.file("word/document.xml", DOCUMENT_XML);
  const doc = new Docxtemplater(templateZip, { paragraphLoop: true, linebreaks: true });
  doc.render({ paragraphs });
  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }) as Buffer);
}

/** Re-serializa el docx final con los párrafos ya resueltos (garantiza apertura). */
export function buildLicenseLetterDocxDirect(data: LicenseLetterData): Buffer {
  void buildLicenseLetterDocx;
  const paragraphs = buildLicenseLetterParagraphs(data);
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("word/document.xml", renderDocumentXml(paragraphs));
  return Buffer.from(zip.generate({ type: "nodebuffer" }) as Buffer);
}
