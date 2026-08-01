/**
 * Cliente PDF.js compartido (solo navegador).
 *
 * El worker se sirve desde `/vendor/pdfjs/` para evitar problemas de
 * certificados y de red. `configurePdfJs` debe ejecutarse antes de
 * cualquier `getDocument`.
 */
import { GlobalWorkerOptions } from "pdfjs-dist"
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist"

let configured = false

export function configurePdfJs(): void {
  if (configured) return
  GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs"
  configured = true
}

export type { PDFDocumentProxy, PDFDocumentLoadingTask }

export async function loadPdfDocument(data: ArrayBuffer): Promise<{
  pdf: PDFDocumentProxy
  loadingTask: PDFDocumentLoadingTask
}> {
  configurePdfJs()
  const pdfjs = await import("pdfjs-dist")
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise
  return { pdf, loadingTask }
}
