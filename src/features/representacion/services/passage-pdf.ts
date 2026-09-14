// Generación de PDFs de pasajes 026/027 con pdf-lib (runtime Vercel, sin LibreOffice).
// Recrea fielmente el formato institucional; el dictamen queda en blanco
// ("Pendiente de dictamen") y el control en "pendiente" si no existe.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PassagePdfWorker {
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
}

export interface Passage026PdfInput {
  ooad: string;
  day: string;
  month: string;
  year: string;
  controlNumber: string;
  worker: PassagePdfWorker;
  extramuralFunctions: string;
  transferPeriod: string;
  folioLabel: string;
}

export interface PassageAddressPdf {
  street: string;
  neighborhood: string;
  postalCode: string;
  municipality: string;
  state: string;
}

export interface Passage027PdfInput {
  ooad: string;
  day: string;
  month: string;
  year: string;
  controlNumber: string;
  worker: PassagePdfWorker;
  discontinuousSchedule: string;
  workerAddress: PassageAddressPdf;
  assignmentAddress: PassageAddressPdf;
  phone: string;
  folioLabel: string;
}

const INK = rgb(0.08, 0.08, 0.08);
const GRAY_BAR = rgb(0.82, 0.82, 0.82);

function drawFrame(page: PDFPage, font: PDFFont, bold: PDFFont): void {
  void font;
  void bold;
}

function text(page: PDFPage, font: PDFFont, x: number, y: number, s: string, size = 8): void {
  page.drawText(s ?? "", { x, y, size, font, color: INK, maxWidth: 520 });
}

function field(page: PDFPage, font: PDFFont, x: number, y: number, label: string, value: string, w = 500): void {
  text(page, font, x, y, label, 7.5);
  text(page, font, x + 105, y, value, 8.5);
  void w;
}

function sectionBar(page: PDFPage, bold: PDFFont, y: number, title: string, width: number): void {
  page.drawRectangle({ x: 30, y: y - 4, width, height: 15, color: GRAY_BAR, borderColor: INK, borderWidth: 0.7 });
  const tw = bold.widthOfTextAtSize(title, 9);
  page.drawText(title, { x: 30 + (width - tw) / 2, y, font: bold, size: 9, color: INK });
}

export async function buildPassage026Pdf(input: Passage026PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // carta
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  drawFrame(page, font, bold);
  const W = 552;
  // Encabezado
  page.drawRectangle({ x: 30, y: 40, width: W, height: 712, borderColor: INK, borderWidth: 0.8 });
  text(page, bold, 40, 730, "COMISIÓN NACIONAL MIXTA DE PASAJES", 8);
  text(page, bold, 300, 730, "SOLICITUD PARA EL TRÁMITE", 8);
  text(page, bold, 300, 720, "DE LA COMPENSACIÓN FIJA PARA PASAJES", 8);
  text(page, bold, 360, 710, "CONCEPTO 026", 9);
  text(page, font, 300, 700, "CLÁUSULA 103 DEL C.C.T.", 7.5);
  text(page, font, 40, 712, "Órgano de Operación Administrativa Desconcentrada:", 7.5);
  text(page, font, 40, 702, input.ooad || "________________________", 8.5);
  text(page, font, 40, 688, `Día: ${input.day}   Mes: ${input.month}   Año: ${input.year}`, 8);
  text(page, font, 400, 688, `Número de Control: ${input.controlNumber || "pendiente"}`, 8);
  sectionBar(page, bold, 668, "DATOS DEL TRABAJADOR", W);
  const w = input.worker;
  field(page, font, 40, 650, "Apellido Paterno:", w.paternalSurname);
  field(page, font, 40, 638, "Apellido Materno:", w.maternalSurname);
  field(page, font, 40, 626, "Nombre(s):", w.firstName);
  field(page, font, 40, 614, "Matrícula:", w.employeeNumber);
  field(page, font, 300, 614, "Categoría:", w.category);
  field(page, font, 40, 602, "Adscripción:", w.assignment);
  field(page, font, 40, 588, "Funciones Extramuros:", input.extramuralFunctions);
  field(page, font, 40, 572, "Periodo de traslado:", input.transferPeriod);
  text(page, font, 40, 548, "TRABAJADOR: ______________________   FIRMA DIRECTOR/ADMINISTRADOR O JEFE: ______________________", 7.5);
  text(page, font, 40, 538, "Nombre y Firma (líneas de firma — el sistema no inserta firmas)", 7);
  sectionBar(page, bold, 518, "DICTAMEN DE LA COMISIÓN NACIONAL/SUBCOMISIÓN MIXTA DE PASAJES", W);
  text(page, font, 40, 500, "Importe quincenal a pagar: $ ________ ( ________________________________________ )", 8);
  text(page, font, 40, 488, "Por el lapso del ______ de ____________ al ______ de ____________ de ______", 8);
  text(page, bold, 40, 476, "Pendiente de dictamen de la Subcomisión Mixta de Pasajes.", 8);
  text(page, font, 40, 464, "Observaciones: Formato listo para revisión. Cumple validaciones de captura.", 7.5);
  text(page, font, 40, 448, "REPRESENTANTE DEL IMSS: __________________      REPRESENTANTE DEL SNTSS: __________________", 7.5);
  sectionBar(page, bold, 428, "PARA USO EXCLUSIVO DEL ÁREA DE SERVICIOS AL PERSONAL", W);
  text(page, font, 40, 412, "Reporte de Inclusión                    Reporte de Pago Retroactivo", 7.5);
  text(page, font, 40, 400, "Matrícula:                              Concepto + 026", 7.5);
  text(page, font, 40, 388, "Unidades +        Importe +        Quincena Inicial/Final        No. de Control        Cifra de Control =", 7.5);
  text(page, font, 40, 372, "Inclusión del Concepto      Exclusión del Concepto      Qna. de Inclusión", 7.5);
  text(page, font, 40, 352, "JEFE DE LA OFICINA DE PRESTACIONES: __________________", 7.5);
  text(page, font, 40, 340, "RESPONSABLE DE LA SECCIÓN DE PRESTACIONES: __________________", 7.5);
  text(page, font, 40, 320, `Folio interno: ${input.folioLabel} — Formato listo para revisión. No es autorización.`, 7);
  text(page, font, 40, 60, "Documento generado por La Veinte Digital / Representación Sindical XXI. Conservar aviso de privacidad del trámite.", 6.5);
  return doc.save();
}

export async function buildPassage027Pdf(input: Passage027PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 552;
  page.drawRectangle({ x: 30, y: 40, width: W, height: 712, borderColor: INK, borderWidth: 0.8 });
  text(page, bold, 40, 730, "COMISIÓN NACIONAL MIXTA DE PASAJES", 8);
  text(page, bold, 320, 730, "SOLICITUD PARA EL TRÁMITE DE", 8);
  text(page, bold, 320, 720, "LA COMPENSACIÓN POR PASAJES", 8);
  text(page, bold, 370, 710, "CONCEPTO 027", 9);
  text(page, font, 320, 700, "CLÁUSULA 103 DEL C.C.T.", 7.5);
  text(page, font, 40, 712, "OOAD:", 7.5);
  text(page, font, 70, 712, input.ooad || "____________", 8.5);
  text(page, font, 40, 688, `Día: ${input.day}   Mes: ${input.month}   Año: ${input.year}`, 8);
  text(page, font, 400, 688, `Número de Control: ${input.controlNumber || "pendiente"}`, 8);
  sectionBar(page, bold, 668, "DATOS DEL TRABAJADOR", W);
  const w = input.worker;
  field(page, font, 40, 650, "Apellido Paterno:", w.paternalSurname);
  field(page, font, 40, 638, "Apellido Materno:", w.maternalSurname);
  field(page, font, 40, 626, "Nombre(s):", w.firstName);
  field(page, font, 40, 614, "Matrícula:", w.employeeNumber);
  field(page, font, 300, 614, "Categoría:", w.category);
  field(page, font, 40, 602, "Adscripción:", w.assignment);
  field(page, font, 300, 602, "Horario Discontinuo:", input.discontinuousSchedule || "—");
  text(page, bold, 40, 590, "Domicilio del Trabajador:", 7.5);
  text(page, bold, 310, 590, "Domicilio de Adscripción:", 7.5);
  const rows: Array<[string, string, string]> = [
    ["Calle:", input.workerAddress.street, input.assignmentAddress.street],
    ["Colonia:", input.workerAddress.neighborhood, input.assignmentAddress.neighborhood],
    ["C.P.:", input.workerAddress.postalCode, input.assignmentAddress.postalCode],
    ["Municipio:", input.workerAddress.municipality, input.assignmentAddress.municipality],
    ["Estado:", input.workerAddress.state, input.assignmentAddress.state],
  ];
  let y = 580;
  for (const [label, a, b] of rows) {
    text(page, font, 40, y, `${label} ${a}`, 7.5);
    text(page, font, 310, y, `${label} ${b}`, 7.5);
    y -= 11;
  }
  text(page, font, 40, y - 2, `Teléfono: ${input.phone}`, 7.5);
  text(page, font, 40, y - 14, "Apercibido de las sanciones al no proporcionar datos fidedignos; avisaré cambios en 15 días.", 6.5);
  text(page, font, 40, y - 30, "TRABAJADOR — Firma: ______________________", 7.5);
  sectionBar(page, bold, y - 48, "DICTAMEN DE LA COMISIÓN NACIONAL/SUBCOMISIÓN MIXTA DE PASAJES", W);
  text(page, font, 40, y - 66, "Importe quincenal a pagar: $ ________ ( ________________________________________ )", 8);
  text(page, bold, 40, y - 80, "Pendiente de dictamen de la Subcomisión Mixta de Pasajes.", 8);
  text(page, font, 40, y - 94, "REPRESENTANTE IMSS: __________________      REPRESENTANTE SNTSS: __________________", 7.5);
  sectionBar(page, bold, y - 112, "PARA USO EXCLUSIVO DEL ÁREA DE SERVICIOS AL PERSONAL", W);
  text(page, font, 40, y - 128, "Reporte de Inclusión / Pago Retroactivo — Concepto + 027 — Qnas. Inicial/Final — Cifra de Control =", 7);
  text(page, font, 40, y - 142, `Folio interno: ${input.folioLabel} — Formato listo para revisión. No es autorización.`, 7);
  text(page, font, 40, 60, "Clave: 1A32-009-010. Documento generado por La Veinte Digital / Representación Sindical XXI.", 6.5);

  // Página 2: aviso de privacidad institucional del trámite (conservada del formato oficial).
  const p2 = doc.addPage([612, 792]);
  text(p2, bold, 60, 740, "Aviso de privacidad — Trámite de compensación por pasajes (concepto 027)", 10);
  const body = [
    "El Instituto Mexicano del Seguro Social (IMSS), con domicilio en Av. Paseo de la Reforma",
    "No. 476, Col. Juárez, C.P. 06600, Ciudad de México, es responsable del tratamiento de los",
    "datos personales que proporcione para este trámite, conforme a la Ley General de Protección",
    "de Datos Personales en Posesión de Sujetos Obligados.",
    "",
    "Datos recabados: domicilio de residencia del solicitante. Finalidad: trámite de compensación",
    "por pasajes (concepto 027). No se recaban datos personales sensibles.",
    "",
    "Fundamento: numeral 7.1.2.3 y 7.1.2.3.1 del Manual de Organización de la Dirección de",
    "Administración (Clave 1000-002-001, 26/08/2024), Cláusula 103 del CCT y procedimiento",
    "1A32-A03-008 (19/04/2021).",
    "",
    "No se realizarán transferencias, salvo requerimientos fundados de autoridad competente.",
    "",
    "Derechos ARCO: Unidad de Transparencia, Calle Durango 323 Piso 3, Col. Roma Norte,",
    "C.P. 06700, CDMX; Plataforma Nacional de Transparencia; unidad.enlace@imss.gob.mx.",
    "Cambios al aviso: http://www.imss.gob.mx. Última actualización: 26 de marzo 2025.",
    "",
    "Nombre y firma del Trabajador: ________________________________________",
  ];
  let yy = 710;
  for (const line of body) {
    text(p2, font, 60, yy, line, 8.5);
    yy -= 13;
  }
  return doc.save();
}
