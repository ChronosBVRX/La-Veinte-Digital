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

/**
 * Normaliza texto a mayúsculas sin acentos y devuelve un mapa de índices
 * `normToRaw` que permite traducir cualquier posición del texto normalizado
 * a su posición equivalente en el texto crudo.
 *
 * Esto es necesario porque el texto crudo puede estar en Unicode NFC (por
 * ejemplo "Ó" como un solo carácter) mientras que la búsqueda se hace sobre
 * el texto normalizado. El mapa garantiza que `slice(rawEnd)` no corte
 * caracteres compuestos.
 */
export function normalizeWithIndexMap(raw: string): {
  normalized: string
  normToRaw: number[]
} {
  let normalized = ""
  const normToRaw: number[] = []

  for (let rawIndex = 0; rawIndex < raw.length; rawIndex++) {
    const decomposed = raw[rawIndex]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    for (const char of decomposed) {
      normalized += char.toUpperCase()
      normToRaw.push(rawIndex)
    }
  }

  // Índice final: permite slice hasta el final del texto crudo.
  normToRaw.push(raw.length)

  return { normalized, normToRaw }
}
