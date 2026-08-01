/**
 * Utilidades para texto posicionado del PDF.
 *
 * Normaliza coordenadas de PDF.js (origen abajo-izquierda) a un sistema
 * con origen arriba-izquierda, y provee búsquedas por ancla.
 */
import type { PositionedPdfText, TarjetonExtractionMethod } from "@/shared/contracts/tarjeton-import"

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

export interface NormalizedPdfTextItem {
  text: string
  /** Texto normalizado (sin acentos, mayúsculas) para búsquedas. */
  norm: string
  page: number
  x: number
  y: number
  width: number
  height: number
  confidence: number
  method: TarjetonExtractionMethod
}

export function normalizePositionedText(items: PositionedPdfText[]): NormalizedPdfTextItem[] {
  return items.map((item) => ({
    text: item.text,
    norm: normalizeText(item.text),
    page: item.page,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    confidence: item.confidence,
    method: item.method,
  }))
}

export function isNumberLike(text: string): boolean {
  return /^[-+]?[\d\s,]*\d(?:\.\d{1,2})?$/.test(text.trim())
}

export function isConceptCode(text: string): boolean {
  return /^\d{3}$/.test(text.trim())
}
