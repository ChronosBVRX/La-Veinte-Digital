import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ptp from "pdf-to-printer";

const printerLib = ptp.default || ptp;

/**
 * Obtiene la lista de impresoras configuradas en Windows.
 */
export async function getInstalledPrinters() {
  try {
    const printers = await printerLib.getPrinters();
    return printers.map((p) => (typeof p === "string" ? p : p.name || p.deviceId));
  } catch (err) {
    console.warn("No se pudieron listar impresoras con pdf-to-printer:", err.message);
    return [];
  }
}

/**
 * Imprime un archivo PDF de forma 100% silenciosa a la impresora de Windows.
 * Cero diálogos, cero ventanas emergentes, tamaño Carta, copias configurables.
 *
 * @param {Buffer} pdfBuffer - Contenido binario del PDF
 * @param {Object} options - Parámetros de impresión
 * @param {string} [options.printerName] - Nombre de la impresora destino
 * @param {number} [options.copies=1] - Cantidad de copias
 * @param {boolean} [options.duplex=false] - Imprimir a doble cara
 */
export async function printPdfSilently(pdfBuffer, options = {}) {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `la20-job-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);

  // Escribir a disco temporal para el spooler de Windows
  fs.writeFileSync(tempFilePath, pdfBuffer);

  try {
    const printer = options.printerName && options.printerName.trim() ? options.printerName.trim() : undefined;
    const copies = options.copies && options.copies > 0 ? options.copies : 1;

    const printOptions = {
      printer,
      paperSize: "Letter",
      copies,
      silent: true,
    };

    console.log(`[SPOOLER] Enviando trabajo a impresora: "${printer || "Predeterminada"}" (${copies} copia/s, Carta)...`);

    await printerLib.print(tempFilePath, printOptions);

    console.log(`[SPOOLER] ✓ Trabajo enviado con éxito a la cola de Windows.`);
    return { success: true };
  } catch (err) {
    console.error(`[SPOOLER] ✕ Error en la cola de impresión de Windows:`, err);
    throw new Error(`Fallo de impresión en Windows: ${err.message || "Error desconocido en el spooler"}`);
  } finally {
    // Limpieza segura del archivo temporal
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {
      // Ignorar error al limpiar archivo temporal
    }
  }
}
