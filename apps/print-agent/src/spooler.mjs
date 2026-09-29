import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ptp from "pdf-to-printer";
import { PDFDocument } from "pdf-lib";

const printerLib = ptp.default || ptp;

/**
 * Divide un PDF multipágina en buffers individuales de 1 página cuando se imprime a una sola cara (simplex),
 * garantizando que ningún controlador de impresora imprima dos hojas distintas en el frente y reverso de la misma hoja.
 */
async function splitToSinglePageBuffersIfNeeded(pdfBuffer, duplex) {
  if (duplex) return [pdfBuffer];
  try {
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = srcDoc.getPageCount();
    if (pageCount <= 1) return [pdfBuffer];

    const buffers = [];
    for (let i = 0; i < pageCount; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const bytes = await singleDoc.save();
      buffers.push(Buffer.from(bytes));
    }
    return buffers;
  } catch {
    return [pdfBuffer];
  }
}

/**
 * Obtiene la lista de impresoras configuradas en Windows.
 */
export async function getInstalledPrinters() {
  try {
    const printers = await printerLib.getPrinters();
    const list = printers
      .map((p) => (typeof p === "string" ? p : p.name || p.deviceId))
      .filter(Boolean);
    if (list.length > 0) {
      return list;
    }
  } catch (err) {
    console.warn("No se pudieron listar impresoras con pdf-to-printer:", err.message);
  }

  // Fallback WMIC para equipos Windows de 32 bits o con PowerShell sin módulo CIM
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("wmic", ["printer", "get", "Name"], {
      windowsHide: true,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && line.toLowerCase() !== "name");
  } catch {
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
  const duplex = Boolean(options.duplex);
  const pageBuffers = await splitToSinglePageBuffersIfNeeded(pdfBuffer, duplex);
  if (pageBuffers.length > 1) {
    for (let idx = 0; idx < pageBuffers.length; idx++) {
      await printSingleBufferSilently(pageBuffers[idx], { ...options, duplex: false });
    }
    return { success: true };
  }
  return printSingleBufferSilently(pageBuffers[0], { ...options, duplex });
}

async function printSingleBufferSilently(pdfBuffer, options = {}) {
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
      side: options.duplex ? "duplex" : "simplex",
    };

    console.log(`[SPOOLER] Enviando trabajo a impresora: "${printer || "Predeterminada"}" (${copies} copia/s, Carta, ${printOptions.side})...`);

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
