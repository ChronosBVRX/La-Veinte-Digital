/**
 * Extracción de texto nativo del PDF (PDF.js) con coordenadas normalizadas:
 * origen en la esquina superior izquierda, unidades del PDF (pt), eje Y hacia
 * abajo. `confidence` es 1 porque proviene del texto incrustado.
 */
import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"
import type { PDFDocumentLoadingTask } from "./pdfjs-client"

export interface NativeExtractResult {
  items: PositionedPdfText[]
  pageTexts: string[]
  pageCount: number
}

export async function extractNativePdfText(
  loadingTask: PDFDocumentLoadingTask,
  opts: { signal?: AbortSignal; maxPages?: number } = {},
): Promise<NativeExtractResult> {
  const { signal, maxPages = 4 } = opts
  const pdf = await loadingTask.promise
  const pageCount = Math.min(pdf.numPages, maxPages)
  const items: PositionedPdfText[] = []
  const pageTexts: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      if (signal?.aborted) {
        throw new DOMException("Extracción cancelada", "AbortError")
      }
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const textContent = await page.getTextContent()

      const pageText: string[] = []
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue
        const str = item.str
        const [a, , , d, e, f] = item.transform
        const width = "width" in item ? (item.width as number) : Math.abs(a)
        const height = "height" in item ? (item.height as number) : Math.abs(d)
        const x = e
        const y = viewport.height - f - height
        items.push({
          text: str,
          x,
          y,
          width,
          height,
          page: pageNumber,
          confidence: 1,
          method: "native_text",
        })
        pageText.push(str)
      }
      pageTexts.push(pageText.join(" "))
    }
  } finally {
    await loadingTask.destroy()
  }

  return { items, pageTexts, pageCount }
}
