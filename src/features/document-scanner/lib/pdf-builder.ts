/**
 * Constructor de PDF multipágina a partir de páginas JPEG ya procesadas.
 *
 * Usa `pdf-lib` (dependencia existente en el proyecto, ver
 * `src/features/representacion/services/passage-pdf.ts`).
 *
 * Reglas:
 * - Las imágenes se insertan completas, centradas y sin deformar (proporción original).
 * - Sin OCR, sin texto generado, sin incrustar metadatos personales.
 * - El tamaño/compresión se controla antes (etapa de imagen); aquí solo se compone.
 *
 * La Veinte Digital
 */

import { PDFDocument } from "pdf-lib"

export const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const

export type PdfPageSize = keyof typeof PAGE_SIZES

export interface PdfPageInput {
  blob: Blob
  /** Dimensiones en píxeles del JPEG (ya rotado/enderezado). */
  width: number
  height: number
}

export interface BuildPdfOptions {
  pageSize?: PdfPageSize
  /** Margen uniforme en puntos (1pt = 1/72"). */
  marginPt?: number
  title?: string
}

export interface FitRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calcula el rectángulo centrado que contiene una imagen dentro de un área,
 * conservando la proporción original (nunca estira).
 */
export function computeFitRect(
  contentWidth: number,
  contentHeight: number,
  imageWidth: number,
  imageHeight: number
): FitRect {
  if (imageWidth <= 0 || imageHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(0, contentWidth), height: Math.max(0, contentHeight) }
  }
  const scale = Math.min(contentWidth / imageWidth, contentHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: (contentWidth - width) / 2,
    y: (contentHeight - height) / 2,
    width,
    height,
  }
}

export const DEFAULT_DOCUMENT_MARGIN_PT = 24

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Construye un PDF multipágina tamaño A4 (por defecto) con las páginas indicadas. */
export async function buildMultipagePdf(
  pages: PdfPageInput[],
  options: BuildPdfOptions = {}
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error("No hay páginas para generar el PDF.")
  }

  const pageSize = PAGE_SIZES[options.pageSize ?? "a4"]
  const margin = options.marginPt ?? DEFAULT_DOCUMENT_MARGIN_PT
  const contentWidth = Math.max(1, pageSize.width - margin * 2)
  const contentHeight = Math.max(1, pageSize.height - margin * 2)

  const document = await PDFDocument.create()
  if (options.title) {
    document.setTitle(options.title)
    document.setProducer("La Veinte Digital")
    document.setCreator("La Veinte Digital")
    document.setCreationDate(new Date())
  }

  for (const page of pages) {
    const bytes = await blobToBytes(page.blob)
    const embedded = await document.embedJpg(bytes)
    const fit = computeFitRect(contentWidth, contentHeight, page.width || embedded.width, page.height || embedded.height)
    const pdfPage = document.addPage([pageSize.width, pageSize.height])
    pdfPage.drawImage(embedded, {
      x: margin + fit.x,
      y: margin + fit.y,
      width: fit.width,
      height: fit.height,
    })
  }

  return document.save()
}

/** Convierte los bytes a un File listo para almacenamiento/transferencia. */
export function pdfBytesToFile(bytes: Uint8Array, fileName: string): File {
  const safeName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new File([buffer], safeName, { type: "application/pdf" })
}

/** Cuenta de páginas del PDF generado (para pruebas y validaciones). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false })
  return document.getPageCount()
}
