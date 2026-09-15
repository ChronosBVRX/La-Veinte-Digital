/**
 * Compositor de INE: UNA sola hoja tamaño carta con el frente arriba y el
 * reverso abajo, centrados, misma anchura visual, proporciones originales
 * (nunca estirados) y márgenes de impresión.
 *
 * Privacidad:
 * - Sin OCR y sin extracción de datos (nombre, CURP, clave de elector, OCR, CIC, QR).
 * - Sin texto adicional en el PDF que revele el contenido.
 * - Los temporales se gestionan fuera de este módulo (se eliminan tras generar).
 *
 * La Veinte Digital
 */

import { PDFDocument } from "pdf-lib"
import { PAGE_SIZES, type PdfPageInput } from "./pdf-builder"

export const INE_MARGIN_PT = 36
export const INE_GAP_PT = 18

export interface IneLayoutEntry {
  x: number
  y: number
  width: number
  height: number
}

export interface IneLayout {
  pageWidth: number
  pageHeight: number
  front: IneLayoutEntry
  back: IneLayoutEntry
}

export interface IneLayoutParams {
  pageWidth?: number
  pageHeight?: number
  marginPt?: number
  gapPt?: number
  front: { width: number; height: number }
  back: { width: number; height: number }
}

/**
 * Calcula la disposición de ambas caras. Función pura y testeable.
 * Garantiza la MISMA anchura visual para frente y reverso.
 */
export function computeIneLayout(params: IneLayoutParams): IneLayout {
  const pageWidth = params.pageWidth ?? PAGE_SIZES.letter.width
  const pageHeight = params.pageHeight ?? PAGE_SIZES.letter.height
  const margin = params.marginPt ?? INE_MARGIN_PT
  const gap = params.gapPt ?? INE_GAP_PT

  const contentWidth = Math.max(1, pageWidth - margin * 2)
  const contentHeight = Math.max(1, pageHeight - margin * 2)
  const availableHeight = Math.max(1, (contentHeight - gap) / 2)

  const frontAspect = safeAspect(params.front)
  const backAspect = safeAspect(params.back)

  // Anchura común: la menor de las anchuras máximas que caben en la caja.
  const commonWidth = Math.max(
    1,
    Math.min(contentWidth, availableHeight * frontAspect, availableHeight * backAspect)
  )

  const frontHeight = commonWidth / frontAspect
  const backHeight = commonWidth / backAspect

  const blockHeight = frontHeight + gap + backHeight
  const blockScale = blockHeight > contentHeight ? contentHeight / blockHeight : 1
  const width = commonWidth * blockScale
  const heightFront = frontHeight * blockScale
  const heightBack = backHeight * blockScale
  const scaledBlock = heightFront + gap + heightBack

  const startY = margin + Math.max(0, (contentHeight - scaledBlock) / 2)
  const x = margin + (contentWidth - width) / 2

  return {
    pageWidth,
    pageHeight,
    front: { x, y: startY + heightBack + gap, width, height: heightFront },
    back: { x, y: startY, width, height: heightBack },
  }
}

function safeAspect(size: { width: number; height: number }): number {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return 1
  if (size.width <= 0 || size.height <= 0) return 1
  return size.width / size.height
}

/**
 * Genera el PDF final de INE: exactamente una página carta vertical con
 * frente arriba y reverso abajo.
 */
export async function buildInePdf(front: PdfPageInput, back: PdfPageInput): Promise<Uint8Array> {
  const layout = computeIneLayout({
    front: { width: front.width, height: front.height },
    back: { width: back.width, height: back.height },
  })

  const document = await PDFDocument.create()
  document.setProducer("La Veinte Digital")
  document.setCreator("La Veinte Digital")
  const page = document.addPage([layout.pageWidth, layout.pageHeight])

  const frontImage = await document.embedJpg(new Uint8Array(await front.blob.arrayBuffer()))
  const backImage = await document.embedJpg(new Uint8Array(await back.blob.arrayBuffer()))

  page.drawImage(frontImage, {
    x: layout.front.x,
    y: layout.front.y,
    width: layout.front.width,
    height: layout.front.height,
  })
  page.drawImage(backImage, {
    x: layout.back.x,
    y: layout.back.y,
    width: layout.back.width,
    height: layout.back.height,
  })

  return document.save()
}
