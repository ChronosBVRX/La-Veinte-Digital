/**
 * Generador Oficial de Recibos / Cédulas de Resguardo de Casilleros 2026.
 * Formato Carta (Letter 612 x 792 pt) con doble tanto (Trabajador y Sindicato).
 * Incorpora logotipo oficial SNTSS, folio de control atómico, datos del trabajador,
 * datos del casillero, fundamento CCT (Cl. 67 y 68) y líneas de firma.
 */

import { jsPDF } from "jspdf";
import { SNTSS_LOGO_BASE64 } from "@/features/representacion/assets/sntss-logo-base64";

export interface LockerReceiptWorkerData {
  name: string;
  employeeNumber: string;
  category: string;
  assignment: string;
  turn: string;
  phone?: string;
}

export interface LockerReceiptLockerData {
  lockerNumber: string;
  zoneName?: string;
  bankName?: string;
  physicalCode?: string;
  condition: string;
  movementType: string;
  observations?: string;
}

export interface LockerReceiptPdfInput {
  folio: string;
  dateFormatted: string;
  delegationName?: string;
  worker: LockerReceiptWorkerData;
  locker: LockerReceiptLockerData;
  representativeName?: string;
  representativeRole?: string;
}

/**
 * Traduce el tipo de movimiento a una etiqueta amigable y formal.
 */
function formatMovementLabel(raw: string): string {
  switch (raw) {
    case "actualizacion_2026":
      return "Refrendo Anual 2026";
    case "asignacion_nueva":
      return "Asignación Nueva 2026";
    case "cambio":
      return "Cambio de Casillero 2026";
    case "baja":
      return "Liberación / Baja de Casillero";
    default:
      return raw || "Actualización 2026";
  }
}

/**
 * Traduce la condición física del mueble a etiqueta formal.
 */
function formatConditionLabel(condition: string): string {
  switch (condition?.toLowerCase()) {
    case "ok":
      return "Buen Estado / Operativo";
    case "maintenance":
      return "Mantenimiento / Requiere Chapa";
    case "damaged":
      return "Dañado / Con Reporte Físico";
    case "blocked":
      return "Bloqueado Administrativamente";
    default:
      return condition || "Buen Estado";
  }
}

/**
 * Dibuja un voucher individual (tanto trabajador o tanto sindicato).
 */
function drawVoucher(
  doc: jsPDF,
  input: LockerReceiptPdfInput,
  startY: number,
  isWorkerCopy: boolean,
): void {
  const pageWidth = 612;
  const leftX = 28;
  const contentWidth = pageWidth - leftX * 2; // 556 pt

  // 1. Logotipo Oficial del SNTSS
  try {
    doc.addImage(SNTSS_LOGO_BASE64, "PNG", leftX, startY, 44, 45.5, undefined, "FAST");
  } catch {
    // Si falla la imagen, dibujar placeholder discreto
    doc.setDrawColor(200, 200, 200);
    doc.rect(leftX, startY, 44, 45.5);
  }

  // 2. Encabezado Institucional
  const headerTextX = leftX + 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text("SINDICATO NACIONAL DE TRABAJADORES DEL SEGURO SOCIAL", headerTextX, startY + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 64, 175); // #1e40af
  doc.text("SECCIÓN XX MICHOACÁN  •  DELEGACIÓN SINDICAL XXI HGR No. 1 CHARO", headerTextX, startY + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87); // #047857
  doc.text("PROGRAMA DE ACTUALIZACIÓN Y RESGUARDO DE CASILLEROS 2026", headerTextX, startY + 29);

  // Etiqueta de la copia
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  if (isWorkerCopy) {
    doc.setTextColor(30, 64, 175);
    doc.text("★  TANTO TRABAJADOR — COMPROBANTE OFICIAL DE RESGUARDO", headerTextX, startY + 39);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.text("★  TANTO DELEGACIÓN — EXPEDIENTE Y ARCHIVO SINDICAL", headerTextX, startY + 39);
  }

  // 3. Recuadro de Folio y Fecha
  const folioBoxWidth = 144;
  const folioBoxX = pageWidth - leftX - folioBoxWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(folioBoxX, startY, folioBoxWidth, 43, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("FOLIO OFICIAL DE RESGUARDO", folioBoxX + 8, startY + 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38); // #dc2626
  doc.text(input.folio, folioBoxX + 8, startY + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text(`Emisión: ${input.dateFormatted}`, folioBoxX + 8, startY + 34);

  // 4. Bloques de Información (Dos columnas)
  const cardsY = startY + 48;
  const colWidth = (contentWidth - 10) / 2; // ~273 pt

  // --- Tarjeta Izquierda: Trabajador ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftX, cardsY, colWidth, 90, 2, 2, "FD");

  // Barra de título Trabajador
  doc.setFillColor(239, 246, 255); // azul muy claro
  doc.roundedRect(leftX, cardsY, colWidth, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(30, 64, 175);
  doc.text("DATOS DEL TRABAJADOR AGREMIADO", leftX + 8, cardsY + 9.5);

  // Filas Trabajador
  let ty = cardsY + 23;
  doc.setFontSize(6.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Nombre:", leftX + 8, ty);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  const safeName = (input.worker.name || "Sin nombre").slice(0, 38);
  doc.text(safeName, leftX + 44, ty);

  ty += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Matrícula:", leftX + 8, ty);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(input.worker.employeeNumber || "N/A", leftX + 48, ty);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Categoría:", leftX + 115, ty);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((input.worker.category || "N/A").slice(0, 24), leftX + 158, ty);

  ty += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Adscripción:", leftX + 8, ty);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((input.worker.assignment || "Hospital General Regional No. 1").slice(0, 35), leftX + 56, ty);

  ty += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Turno:", leftX + 8, ty);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((input.worker.turn || "Jornada Ordinaria").slice(0, 35), leftX + 36, ty);

  ty += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Teléfono:", leftX + 8, ty);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(input.worker.phone || "Registrado en padrón", leftX + 46, ty);

  // --- Tarjeta Derecha: Casillero ---
  const rightX = leftX + colWidth + 10;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(187, 247, 208); // verde suave
  doc.roundedRect(rightX, cardsY, colWidth, 90, 2, 2, "FD");

  // Barra de título Casillero
  doc.setFillColor(240, 253, 244); // verde muy claro
  doc.roundedRect(rightX, cardsY, colWidth, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(22, 101, 52);
  doc.text("DATOS DEL CASILLERO ASIGNADO", rightX + 8, cardsY + 9.5);

  // Filas Casillero
  let ly = cardsY + 23;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Casillero:", rightX + 8, ly);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text(`No. ${input.locker.lockerNumber}`, rightX + 46, ly);

  ly += 13;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Zona / Vestidor:", rightX + 8, ly);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((input.locker.zoneName || "Vestidor General").slice(0, 32), rightX + 70, ly);

  ly += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Mueble / Batería:", rightX + 8, ly);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text((input.locker.bankName || "Batería estándar").slice(0, 32), rightX + 72, ly);

  ly += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Movimiento:", rightX + 8, ly);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatMovementLabel(input.locker.movementType), rightX + 56, ly);

  ly += 13;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Condición:", rightX + 8, ly);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(formatConditionLabel(input.locker.condition), rightX + 48, ly);

  // 5. Términos y Fundamento CCT (Cláusulas 67 y 68)
  const termsY = cardsY + 95;
  const termsHeight = 44;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftX, termsY, contentWidth, termsHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(15, 23, 42);
  doc.text("FUNDAMENTO LABORAL Y TÉRMINOS DE RESGUARDO (CLÁUSULAS 67 Y 68 DEL CCT VIGENTE IMSS-SNTSS)", leftX + 6, termsY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(51, 65, 85);
  const termsP1 = "1. El casillero asignado es para uso estrictamente individual, laboral e intransferible. Queda prohibido su traspaso o intercambio no autorizado.";
  const termsP2 = "2. El trabajador agremiado es responsable de mantener el mueble en óptimas condiciones de orden y aseo, así como de la guarda de su llave o candado.";
  const termsP3 = "3. Queda prohibido almacenar alimentos perecederos, dinero en efectivo no justificado, sustancias inflamables o artículos contrarios a la normativa.";
  const termsP4 = "4. Al causar baja, cambio de adscripción, jubilación o término de contrato, el trabajador deberá devolver el casillero limpio y vacío a la representación sindical.";

  doc.text(termsP1, leftX + 6, termsY + 16);
  doc.text(termsP2, leftX + 6, termsY + 23);
  doc.text(termsP3, leftX + 6, termsY + 30);
  doc.text(termsP4, leftX + 6, termsY + 37);

  // 6. Espacios para Firmas
  const signY = termsY + 49;
  const signColWidth = 200;
  const workerSignX = leftX + 25;
  const unionSignX = pageWidth - leftX - signColWidth - 25;

  // Línea Firma Trabajador
  doc.setDrawColor(148, 163, 184);
  doc.line(workerSignX, signY + 22, workerSignX + signColWidth, signY + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text("FIRMA DEL TRABAJADOR AGREMIADO", workerSignX + 25, signY + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Recibí de conformidad y acepto los términos de resguardo", workerSignX + 16, signY + 34);

  // Línea Firma Representación Sindical
  doc.line(unionSignX, signY + 22, unionSignX + signColWidth, signY + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text("REPRESENTACIÓN SINDICAL DELEGACIÓN XXI", unionSignX + 16, signY + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Sello oficial y firma de validación", unionSignX + 46, signY + 34);

  // 7. Pie de Página discreto con hash de verificación
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `La Veinte Digital  •  Documento Oficial Emitido en Sistema  •  Folio: ${input.folio}  •  Delegación XXI HGR No. 1 Charo`,
    leftX,
    signY + 42,
  );
}

/**
 * Genera el documento PDF en tamaño Carta con 2 tantos:
 * - Tanto Superior: Trabajador
 * - Línea de corte
 * - Tanto Inferior: Sindicato
 */
export function buildLockerReceiptPdf(input: LockerReceiptPdfInput): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
  });

  // 1. Tanto Superior (Trabajador)
  drawVoucher(doc, input, 16, true);

  // 2. Línea divisoria de corte (a la mitad: Y = 396 pt)
  const cutY = 392;
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([4, 4], 0);
  doc.line(28, cutY, 584, cutY);
  doc.setLineDashPattern([], 0);

  // Indicador de corte con tijera
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("✂  CORTAR POR LA LÍNEA PUNTEADA  —  TANTO SUPERIOR: TRABAJADOR  /  TANTO INFERIOR: SINDICATO  ✂", 125, cutY + 2.5);

  // 3. Tanto Inferior (Sindicato)
  drawVoucher(doc, input, 404, false);

  return doc;
}

/**
 * Retorna el buffer del PDF generado (para guardado o envío a la cola de impresión).
 */
export function buildLockerReceiptBuffer(input: LockerReceiptPdfInput): Buffer {
  const doc = buildLockerReceiptPdf(input);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
