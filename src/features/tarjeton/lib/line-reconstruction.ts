/**
 * Reconstrucción de la disposición visual del texto posicionado.
 *
 * 1. Agrupa elementos por proximidad vertical (misma fila).
 * 2. Ordena cada fila por coordenada X.
 * 3. Une con espacios cuando hay separación horizontal.
 * 4. Cada fila conserva sus elementos originales para búsquedas por ancla.
 */
import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"
import { normalizePositionedText, type NormalizedPdfTextItem } from "./positioned-text"

export interface ReconstructedLine {
  /** Índice global (orden topológico). */
  index: number
  page: number
  y: number
  /** Texto unido de la fila. */
  text: string
  norm: string
  items: NormalizedPdfTextItem[]
  /** Confianza promedio de la fila (0..1). */
  confidence: number
  method: "native_text" | "ocr" | "hybrid"
}

export interface ReconstructOptions {
  /** Tolerancia vertical (en unidades PDF) para considerar misma fila. */
  yTolerance?: number
  /** Separación horizontal mínima para insertar un espacio (PDF units). */
  xGapThreshold?: number
  /** Filtro: mínimo de caracteres útiles por elemento. */
  minTextLength?: number
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
}

function isInsideRegion(
  item: NormalizedPdfTextItem,
  options: ReconstructOptions,
): boolean {
  const centerX = item.x + item.width / 2
  const centerY = item.y + item.height / 2

  if (options.xMin !== undefined && centerX < options.xMin) return false
  if (options.xMax !== undefined && centerX >= options.xMax) return false
  if (options.yMin !== undefined && centerY < options.yMin) return false
  if (options.yMax !== undefined && centerY >= options.yMax) return false

  return true
}

export function reconstructLines(
  items: PositionedPdfText[],
  options: ReconstructOptions = {},
): ReconstructedLine[] {
  const { yTolerance = 3, xGapThreshold = 1.5, minTextLength = 0 } = options
  const normalized = normalizePositionedText(items)
    .filter((item) => item.text.trim().length >= minTextLength)
    .filter((item) => isInsideRegion(item, options))

  // Agrupar por página y proximidad vertical.
  const rows: NormalizedPdfTextItem[][] = []
  for (const item of normalized) {
    let placed = false
    for (const row of rows) {
      const rowPage = row[0]?.page ?? 0
      const rowY = row[0]?.y ?? 0
      if (item.page !== rowPage) continue
      if (Math.abs(item.y - rowY) <= yTolerance) {
        row.push(item)
        placed = true
        break
      }
    }
    if (!placed) rows.push([item])
  }

  // Ordenar filas por página y Y; elementos por X.
  rows.sort((a, b) => {
    const pa = a[0]?.page ?? 0
    const pb = b[0]?.page ?? 0
    if (pa !== pb) return pa - pb
    return (a[0]?.y ?? 0) - (b[0]?.y ?? 0)
  })
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
  }

  const lines: ReconstructedLine[] = []
  let index = 0
  for (const row of rows) {
    const parts: string[] = []
    let lastEnd: number | null = null
    for (const item of row) {
      if (lastEnd !== null && item.x - lastEnd > xGapThreshold) {
        parts.push(" ")
      }
      parts.push(item.text)
      lastEnd = item.x + item.width
    }

    const text = parts.join("").replace(/\s{2,}/g, " ")
    const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim()
    if (!text.trim()) continue

    const avgConfidence = row.reduce((s, i) => s + i.confidence, 0) / Math.max(1, row.length)
    const method = row.every((i) => i.method === "native_text")
      ? ("native_text" as const)
      : row.every((i) => i.method === "ocr")
        ? ("ocr" as const)
        : ("hybrid" as const)

    lines.push({
      index,
      page: row[0]?.page ?? 1,
      y: row[0]?.y ?? 0,
      text,
      norm,
      items: row,
      confidence: avgConfidence,
      method,
    })
    index++
  }

  return lines
}

export interface LineSpan {
  start: number
  end: number
}

/** Encuentra el rango de líneas entre dos anclas (por norma). */
export function findLineSpan(
  lines: ReconstructedLine[],
  startAnchor: string,
  endAnchor: string,
  opts: { fromIndex?: number; page?: number } = {},
): LineSpan | null {
  const from = opts.fromIndex ?? 0
  const page = opts.page

  let start = -1
  let end = lines.length

  for (let i = from; i < lines.length; i++) {
    const line = lines[i]
    if (page !== undefined && line.page !== page) continue
    if (start < 0 && line.norm.includes(startAnchor)) {
      start = i
      continue
    }
    if (start >= 0 && line.norm.includes(endAnchor)) {
      end = i
      break
    }
  }

  if (start < 0) return null
  return { start, end }
}

/** Texto de todas las líneas (para detección de anclas globales). */
export function linesToText(lines: ReconstructedLine[]): string {
  return lines.map((l) => l.text).join("\n")
}
