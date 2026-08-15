/**
 * Cliente PDF.js local del módulo normativa (solo navegador).
 * Usa el mismo worker servido desde /vendor/pdfjs/ (ver scripts/copy-vendor.mjs).
 */
import { GlobalWorkerOptions } from "pdfjs-dist"
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist"

let configured = false

export function configurePdfJs(): void {
  if (configured) return
  GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs"
  configured = true
}

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
