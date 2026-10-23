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

export const INE_PHYSICAL_WIDTH_MM = 85.60
export const INE_PHYSICAL_HEIGHT_MM = 53.98

// Conversión estándar PDF: 72 puntos por pulgada (1 pulgada = 25.4 mm)
export const INE_PHYSICAL_WIDTH_PT = (INE_PHYSICAL_WIDTH_MM / 25.4) * 72 // ≈ 242.65 pt
export const INE_PHYSICAL_HEIGHT_PT = (INE_PHYSICAL_HEIGHT_MM / 25.4) * 72 // ≈ 153.01 pt

export const INE_MARGIN_PT = 36
export const INE_GAP_PT = 24
export const INE_OPTICAL_SHIFT_PT = 18

export interface IneLayoutEntry {
  x: number
  y: number
  width: number
  height: number
  boxX: number
  boxY: number
  boxWidth: number
  boxHeight: number
}

export interface IneLayout {
  pageWidth: number
  pageHeight: number
  cardBoxWidth: number
  cardBoxHeight: number
  front: IneLayoutEntry
  back: IneLayoutEntry
}

export interface IneLayoutParams {
  pageWidth?: number
  pageHeight?: number
  marginPt?: number
  gapPt?: number
  opticalShiftPt?: number
  front: { width: number; height: number }
  back: { width: number; height: number }
}

export interface FitRectResult {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

/**
 * Calcula el tamaño y centrado de la cara capturada dentro de la caja física real (85.60 × 53.98 mm).
 * Preserva estrictamente el aspect ratio para no deformar la imagen.
 */
export function computeFitRectWithinPhysicalCard(
  source: { width: number; height: number },
  box: { width: number; height: number } = {
    width: INE_PHYSICAL_WIDTH_PT,
    height: INE_PHYSICAL_HEIGHT_PT,
  }
): FitRectResult {
  const aspect = safeAspect(source)
  const boxAspect = safeAspect(box)

  let width: number
  let height: number

  if (aspect >= boxAspect) {
    // Si la imagen es relativamente más ancha que la caja física, limitar por ancho
    width = box.width
    height = box.width / aspect
  } else {
    // Si es relativamente más alta, limitar por altura física
    height = box.height
    width = box.height * aspect
  }

  // Centrado exacto dentro de la caja física real
  const offsetX = (box.width - width) / 2
  const offsetY = (box.height - height) / 2

  return { width, height, offsetX, offsetY }
}

/**
 * Calcula la disposición de ambas caras en la hoja Carta a tamaño físico real:
 * - frente arriba;
 * - reverso abajo;
 * - ambos centrados horizontalmente;
 * - separación visual controlada (18–30 pt);
 * - bloque completo posicionado para emular una fotocopia de credencial convencional.
 */
export function computeIneLayout(params: IneLayoutParams): IneLayout {
  const pageWidth = params.pageWidth ?? PAGE_SIZES.letter.width
  const pageHeight = params.pageHeight ?? PAGE_SIZES.letter.height
  const gap = params.gapPt ?? INE_GAP_PT
  const opticalShift = params.opticalShiftPt ?? INE_OPTICAL_SHIFT_PT

  const boxWidth = INE_PHYSICAL_WIDTH_PT
  const boxHeight = INE_PHYSICAL_HEIGHT_PT

  const fitFront = computeFitRectWithinPhysicalCard(params.front, { width: boxWidth, height: boxHeight })
  const fitBack = computeFitRectWithinPhysicalCard(params.back, { width: boxWidth, height: boxHeight })

  // Centrado horizontal de la caja física en la hoja Carta
  const boxX = Math.max(0, (pageWidth - boxWidth) / 2)

  // Altura total del bloque: 2 cajas de credencial + separación entre ellas
  const totalBlockHeight = boxHeight * 2 + gap

  // Centrado vertical ligeramente elevado (copia convencional de papelería)
  const baseY = Math.max(0, (pageHeight - totalBlockHeight) / 2)
  const startY = Math.min(
    pageHeight - totalBlockHeight - INE_MARGIN_PT,
    Math.max(INE_MARGIN_PT, baseY + opticalShift)
  )

  const boxY_back = startY
  const boxY_front = startY + boxHeight + gap

  return {
    pageWidth,
    pageHeight,
    cardBoxWidth: boxWidth,
    cardBoxHeight: boxHeight,
    front: {
      x: boxX + fitFront.offsetX,
      y: boxY_front + fitFront.offsetY,
      width: fitFront.width,
      height: fitFront.height,
      boxX,
      boxY: boxY_front,
      boxWidth,
      boxHeight,
    },
    back: {
      x: boxX + fitBack.offsetX,
      y: boxY_back + fitBack.offsetY,
      width: fitBack.width,
      height: fitBack.height,
      boxX,
      boxY: boxY_back,
      boxWidth,
      boxHeight,
    },
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
