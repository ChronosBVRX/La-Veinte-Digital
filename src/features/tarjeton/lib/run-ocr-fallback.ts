/**
 * OCR de respaldo con Tesseract.js cuando el PDF es escaneado.
 *
 * Todo ocurre en el cliente: el worker y el modelo se cargan desde
 * `/vendor/tesseract/`. La salida se normaliza al mismo formato
 * `PositionedPdfText` de la extracción nativa (coordenadas en unidades
 * del PDF, origen arriba-izquierda) para que el resto del pipeline sea
 * idéntico en ambos métodos.
 */
import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"

export interface OcrFallbackOptions {
  scale?: number
  signal?: AbortSignal
  onProgress?: (progress: number, page: number, totalPages: number) => void
}

interface TesseractLoggerMessage {
  status?: string
  progress?: number
  page?: number
}

export interface OcrFallbackResult {
  items: PositionedPdfText[]
  usedCdn: boolean
}

const PAGE_BREAK = " " as const

export async function runOcrFallback(
  pages: HTMLCanvasElement[],
  opts: OcrFallbackOptions = {},
): Promise<OcrFallbackResult> {
  const { scale = 2, signal, onProgress } = opts
  const Tesseract = await import("tesseract.js")

  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null
  let usedCdn = false

  try {
    try {
      worker = await Tesseract.createWorker("spa", 1, {
        workerPath: "/vendor/tesseract/worker.min.js",
        corePath: "/vendor/tesseract/tesseract-core-simd.wasm.js",
        langPath: "/vendor/tesseract/lang/",
        gzip: true,
        logger: (m: TesseractLoggerMessage) => {
          if (m.status === "recognizing text" && typeof m.progress === "number" && m.page) {
            onProgress?.(m.progress, m.page ?? 1, pages.length)
          }
        },
      })
    } catch {
      // Fallback al CDN oficial si el vendor local no responde.
      usedCdn = true
      worker = await Tesseract.createWorker("spa", 1, {
        gzip: true,
        logger: (m: TesseractLoggerMessage) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            onProgress?.(m.progress, m.page ?? 1, pages.length)
          }
        },
      })
    }

    const items: PositionedPdfText[] = []

    for (let i = 0; i < pages.length; i++) {
      if (signal?.aborted) {
        throw new DOMException("OCR cancelado", "AbortError")
      }
      const { data } = await worker.recognize(pages[i], {}, { blocks: true })
      if (signal?.aborted) {
        throw new DOMException("OCR cancelado", "AbortError")
      }

      for (const block of data.blocks ?? []) {
        const { bbox, text } = block
        if (!text?.trim()) continue
        const words = text.split(/\s+/).filter(Boolean)
        if (words.length === 0) continue
        items.push({
          text: words.join(PAGE_BREAK),
          x: bbox.x0 / scale,
          y: bbox.y0 / scale,
          width: (bbox.x1 - bbox.x0) / scale,
          height: (bbox.y1 - bbox.y0) / scale,
          page: i + 1,
          confidence: Math.max(0.01, Math.min(1, (block.confidence ?? 0) / 100)),
          method: "ocr",
        })
      }
    }

    return { items, usedCdn }
  } finally {
    await worker?.terminate().catch(() => undefined)
  }
}
