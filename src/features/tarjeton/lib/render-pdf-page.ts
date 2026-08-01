/**
 * Render de una página de PDF a canvas (preparación para OCR).
 *
 * Se dibuja con la escala dada y se preprocesa: escala de grises + contraste,
 * para mejorar la precisión de Tesseract.
 */
import type { PDFDocumentProxy } from "./pdfjs-client"

export async function renderPdfPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  opts: { scale?: number; signal?: AbortSignal } = {},
): Promise<HTMLCanvasElement> {
  const { scale = 2, signal } = opts
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas")

  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  if (signal?.aborted) {
    throw new DOMException("Render cancelado", "AbortError")
  }

  // Preprocesado: escala de grises y contraste moderado.
  const processed = document.createElement("canvas")
  processed.width = canvas.width
  processed.height = canvas.height
  const pctx = processed.getContext("2d", { willReadFrequently: true })
  if (!pctx) throw new Error("No se pudo crear el contexto 2D del preprocesado")
  pctx.filter = "grayscale(1) contrast(1.2)"
  pctx.drawImage(canvas, 0, 0)

  return processed
}
