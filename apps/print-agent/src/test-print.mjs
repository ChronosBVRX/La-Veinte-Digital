import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Genera el documento PDF de prueba oficial para la estación sindical.
 * @param {Object} options
 * @param {string} [options.stationName]
 * @param {string} [options.printerName]
 * @param {string} [options.serverUrl]
 * @returns {Promise<Buffer>}
 */
export async function generateTestPagePdf({
  stationName = "Oficina Sindical",
  printerName = "Impresora predeterminada",
  serverUrl = "https://la20.com.mx",
} = {}) {
  const pdfDoc = await PDFDocument.create();
  // Tamaño Carta estándar en puntos (8.5 x 11 pulgadas = 612 x 792 pt)
  const page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const primaryBlue = rgb(37 / 255, 99 / 255, 235 / 255);
  const darkText = rgb(15 / 255, 23 / 255, 42 / 255);
  const mutedText = rgb(100 / 255, 116 / 255, 139 / 255);
  const greenText = rgb(22 / 255, 163 / 255, 74 / 255);
  const lightBg = rgb(248 / 255, 250 / 255, 252 / 255);
  const borderColor = rgb(226 / 255, 232 / 255, 240 / 255);

  // 1. Franja superior institucional
  page.drawRectangle({
    x: 40,
    y: 710,
    width: 532,
    height: 48,
    color: primaryBlue,
  });

  page.drawText("LA VEINTE DIGITAL · REPRESENTACIÓN SINDICAL", {
    x: 55,
    y: 728,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // 2. Título de página de prueba
  page.drawText("PÁGINA DE PRUEBA DE IMPRESIÓN AUTOMÁTICA", {
    x: 40,
    y: 670,
    size: 16,
    font: fontBold,
    color: darkText,
  });

  page.drawText("Esta página confirma que la estación de oficina está configurada y lista para operar.", {
    x: 40,
    y: 650,
    size: 10,
    font: fontRegular,
    color: mutedText,
  });

  // 3. Recuadro de detalles de la estación
  page.drawRectangle({
    x: 40,
    y: 460,
    width: 532,
    height: 165,
    color: lightBg,
    borderColor,
    borderWidth: 1,
  });

  page.drawText("DATOS DE CONFIGURACIÓN", {
    x: 55,
    y: 595,
    size: 11,
    font: fontBold,
    color: primaryBlue,
  });

  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const rows = [
    { label: "Estación de Oficina:", value: stationName },
    { label: "Impresora Windows:", value: printerName || "(Predeterminada de Windows)" },
    { label: "Servidor Conectado:", value: serverUrl },
    { label: "Fecha y hora de prueba:", value: fechaStr },
    { label: "Estado del Spooler:", value: "ACTIVO Y OPERATIVO" },
  ];

  let currentY = 570;
  for (const row of rows) {
    page.drawText(row.label, {
      x: 55,
      y: currentY,
      size: 9,
      font: fontBold,
      color: darkText,
    });
    page.drawText(row.value, {
      x: 200,
      y: currentY,
      size: 9,
      font: fontRegular,
      color: row.label.includes("Estado") ? greenText : darkText,
    });
    currentY -= 22;
  }

  // 4. Mensaje informativo sindical
  page.drawRectangle({
    x: 40,
    y: 330,
    width: 532,
    height: 105,
    color: rgb(240 / 255, 253 / 255, 244 / 255),
    borderColor: rgb(187 / 255, 247 / 255, 208 / 255),
    borderWidth: 1,
  });

  page.drawText("✓ COMUNICACIÓN Y SPOOLER VERIFICADOS", {
    x: 55,
    y: 405,
    size: 11,
    font: fontBold,
    color: greenText,
  });

  const instructions = [
    "• Cuando un representante sindical pulse 'MANDAR A IMPRIMIR' desde el portal,",
    "  el paquete de licencias saldrá automáticamente por esta misma bandeja.",
    "• No es necesario tener ninguna ventana abierta en la PC.",
    "• La Veinte Print permanecerá activo silenciosamente junto al reloj de Windows.",
  ];

  let instY = 385;
  for (const line of instructions) {
    page.drawText(line, {
      x: 55,
      y: instY,
      size: 8.5,
      font: fontRegular,
      color: darkText,
    });
    instY -= 16;
  }

  // 5. Pie de página institucional
  page.drawLine({
    start: { x: 40, y: 70 },
    end: { x: 572, y: 70 },
    thickness: 0.5,
    color: borderColor,
  });

  page.drawText("La Veinte Digital · Sistema Oficial de Representación Sindical · Sección XX IMSS", {
    x: 40,
    y: 55,
    size: 8,
    font: fontRegular,
    color: mutedText,
  });

  page.drawText("Impresión 100% silenciosa en Windows vía La Veinte Print Agent v1.0.0", {
    x: 40,
    y: 42,
    size: 7.5,
    font: fontRegular,
    color: mutedText,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
