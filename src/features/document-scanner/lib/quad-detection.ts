/**
 * Detección automática de bordes de documento (pura, sin OpenCV).
 *
 * Pipeline:
 * captura → downscale → gris → desenfoque → Sobel → Otsu → dilatar →
 * componentes conectados → casco convexo → approxPolyDP / rectángulo mínimo →
 * puntuación del cuadrilátero más plausible.
 *
 * Si la detección falla, el usuario ajusta las cuatro esquinas manualmente
 * (flujo obligatorio en la UI). Esta función nunca lanza por una imagen "sin papel".
 *
 * La Veinte Digital
 */

import type { DetectedQuad, Point, Quad } from "../types/scanner-types"
import { expandQuad, isPlausibleQuad, orderCorners, quadArea } from "./geometry"
import { computeLuminance, computeHistogram, otsuThreshold } from "./image-filters"
import { downscaleForAnalysis, type RasterImage } from "./raster"

export interface DetectQuadOptions {
  /** Máximo lado de la imagen de análisis. */
  maxDimension?: number
  /** Área mínima del documento respecto a la imagen. */
  minAreaRatio?: number
}

export function detectDocumentQuad(raster: RasterImage, options: DetectQuadOptions = {}): DetectedQuad | null {
  const minAreaRatio = options.minAreaRatio ?? 0.08
  const analysis = downscaleForAnalysis(raster, options.maxDimension ?? 1000)
  const { width, height } = analysis
  if (width < 32 || height < 32) return null

  const gray = computeLuminance(analysis)
  const blurred = boxBlur(gray, width, height, 2)
  const magnitude = sobelMagnitude(blurred, width, height)
  const threshold = otsuThreshold(computeHistogram(magnitude))
  const edges = binarize(magnitude, Math.max(24, threshold))
  const dilated = dilate(edges, width, height)
  const components = connectedComponents(dilated, width, height, Math.max(64, Math.floor(width * height * 0.002)))

  const candidates: Array<{ quad: Quad; score: number }> = []

  for (const component of components) {
    const points = componentToPoints(component, width)
    if (points.length < 4) continue
    const hull = convexHull(points)
    if (hull.length < 4) continue
    const hullArea = Math.abs(polygonArea(hull))
    if (hullArea / (width * height) < minAreaRatio * 0.6) continue

    // 1. Aproximación poligonal real del contorno (bordes del papel).
    const perimeter = polygonPerimeter(hull)
    for (const ratio of [0.02, 0.035, 0.05, 0.08]) {
      const approx = approxPolyDP(hull, perimeter * ratio)
      if (approx.length !== 4) continue
      const quad = orderCorners(approx)
      if (!isPlausibleQuad(quad, width, height, minAreaRatio)) continue
      candidates.push({ quad, score: scoreQuad(quad, width, height, hullArea) })
    }

    // 2. Respaldo robusto: rectángulo mínimo envolvente.
    const rect = minAreaRect(hull)
    if (isPlausibleQuad(rect, width, height, minAreaRatio)) {
      candidates.push({ quad: rect, score: scoreQuad(rect, width, height, hullArea) })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]
  const confidence = clamp01(top.score)
  if (confidence < 0.25) return null

  // Entre candidatos de calidad similar, prefiere el de mayor área:
  // incluir un poco de fondo es preferible a recortar contenido del documento.
  const scoreThreshold = top.score * 0.9
  const finalists = candidates.filter((candidate) => candidate.score >= scoreThreshold)
  finalists.sort((a, b) => quadArea(b.quad) - quadArea(a.quad))

  // Margen de seguridad del 1.2% para tolerar bordes sucios o sombras.
  const chosen = expandQuad(finalists[0].quad, 0.012, width, height)
  return { quad: chosen, confidence }
}

/* ------------------------------- morfología ------------------------------- */

export function boxBlur(values: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(values)
  const horizontal = new Float32Array(values.length)
  const window = radius * 2 + 1

  for (let y = 0; y < height; y++) {
    let sum = 0
    const rowOffset = y * width
    for (let x = -radius; x <= radius; x++) {
      sum += values[rowOffset + clampIndex(x, width)]
    }
    for (let x = 0; x < width; x++) {
      horizontal[rowOffset + x] = sum / window
      const outIndex = clampIndex(x - radius, width)
      const inIndex = clampIndex(x + radius + 1, width)
      sum += values[rowOffset + inIndex] - values[rowOffset + outIndex]
    }
  }

  const out = new Uint8ClampedArray(values.length)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) {
      sum += horizontal[clampIndex(y, height) * width + x]
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / window
      const outY = clampIndex(y - radius, height)
      const inY = clampIndex(y + radius + 1, height)
      sum += horizontal[inY * width + x] - horizontal[outY * width + x]
    }
  }
  return out
}

function clampIndex(value: number, limit: number): number {
  if (value < 0) return 0
  if (value >= limit) return limit - 1
  return value
}

export function sobelMagnitude(values: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const tl = values[i - width - 1]
      const t = values[i - width]
      const tr = values[i - width + 1]
      const l = values[i - 1]
      const r = values[i + 1]
      const bl = values[i + width - 1]
      const b = values[i + width]
      const br = values[i + width + 1]
      const gx = -tl - 2 * l - bl + tr + 2 * r + br
      const gy = -tl - 2 * t - tr + bl + 2 * b + br
      out[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy))
    }
  }
  return out
}

function binarize(values: Uint8ClampedArray, threshold: number): Uint8Array {
  const out = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = values[i] >= threshold ? 1 : 0
  }
  return out
}

function dilate(binary: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(binary.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!binary[i]) continue
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          out[ny * width + nx] = 1
        }
      }
    }
  }
  return out
}

function connectedComponents(
  binary: Uint8Array,
  width: number,
  height: number,
  minSize: number
): number[][] {
  const labels = new Int32Array(binary.length).fill(-1)
  const components: number[][] = []
  const stack: number[] = []

  for (let start = 0; start < binary.length; start++) {
    if (!binary[start] || labels[start] !== -1) continue
    const component: number[] = []
    stack.push(start)
    labels[start] = components.length

    while (stack.length > 0) {
      const index = stack.pop() as number
      component.push(index)
      const x = index % width
      const y = (index - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (!binary[next] || labels[next] !== -1) continue
          labels[next] = components.length
          stack.push(next)
        }
      }
    }

    if (component.length >= minSize) components.push(component)
  }

  return components
}

function componentToPoints(component: number[], width: number): Point[] {
  const points: Point[] = []
  for (const index of component) {
    const x = index % width
    const y = (index - x) / width
    points.push({ x, y })
  }
  return points
}

/* -------------------------------- geometría ------------------------------- */

export function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return [...points]
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

export function approxPolyDP(points: Point[], epsilon: number): Point[] {
  if (points.length < 4) return [...points]
  const closed = [...points, points[0]]
  const keep = new Uint8Array(closed.length)
  keep[0] = 1
  keep[closed.length - 1] = 1

  const stack: Array<[number, number]> = [[0, closed.length - 1]]
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number]
    let maxDistance = 0
    let maxIndex = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(closed[i], closed[start], closed[end])
      if (d > maxDistance) {
        maxDistance = d
        maxIndex = i
      }
    }
    if (maxDistance > epsilon && maxIndex > 0) {
      keep[maxIndex] = 1
      stack.push([start, maxIndex], [maxIndex, end])
    }
  }

  const result: Point[] = []
  for (let i = 0; i < closed.length - 1; i++) {
    if (keep[i]) result.push(closed[i])
  }
  return result
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY)
}

export function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

function polygonPerimeter(points: Point[]): number {
  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    perimeter += Math.hypot(a.x - b.x, a.y - b.y)
  }
  return perimeter
}

/** Rectángulo mínimo envolvente (rotating calipers simplificado sobre el casco). */
export function minAreaRect(hull: Point[]): Quad {
  if (hull.length < 3) {
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]
  }

  let bestArea = Number.POSITIVE_INFINITY
  let bestCorners: Point[] = []

  const step = hull.length > 180 ? Math.ceil(hull.length / 180) : 1
  for (let i = 0; i < hull.length; i += step) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const p of hull) {
      const rx = p.x * cos - p.y * sin
      const ry = p.x * sin + p.y * cos
      if (rx < minX) minX = rx
      if (rx > maxX) maxX = rx
      if (ry < minY) minY = ry
      if (ry > maxY) maxY = ry
    }

    const area = (maxX - minX) * (maxY - minY)
    if (area < bestArea) {
      bestArea = area
      const cosBack = Math.cos(angle)
      const sinBack = Math.sin(angle)
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ].map((p) => ({
        x: p.x * cosBack - p.y * sinBack,
        y: p.x * sinBack + p.y * cosBack,
      }))
      bestCorners = corners
    }
  }

  if (bestCorners.length !== 4) return minAreaRectFallback(hull)
  return orderCorners(bestCorners)
}

function minAreaRectFallback(points: Point[]): Quad {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return orderCorners([
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ])
}

function scoreQuad(quad: Quad, width: number, height: number, hullArea: number): number {
  const area = quadArea(quad)
  const areaRatio = Math.min(1, area / (width * height))
  const rectangularity = hullArea > 0 ? Math.min(1, area / hullArea) : 0
  // Prioriza documentos grandes y rectangulares sin descartar recortes parciales.
  return 0.65 * areaRatio + 0.35 * rectangularity
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
