/**
 * Geometría pura para el escáner de documentos.
 *
 * - Orden canónico de esquinas (TL, TR, BR, BL) robusto ante rotaciones leves.
 * - Validación de cuadriláteros plausibles (área, convexidad, límites).
 * - Homografía directa/inversa para `warpPerspective` (implementación propia, sin dependencias).
 *
 * Todas las funciones son puras y deterministas: entrada → salida, sin I/O.
 *
 * La Veinte Digital
 */

import type { Point, Quad } from "../types/scanner-types"

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Área con signo (shoelace). Positiva si el polígono es antihorario en pantalla (y hacia abajo). */
export function signedArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export function quadArea(quad: Quad): number {
  return Math.abs(signedArea(quad))
}

/**
 * Ordena 4 puntos arbitrarios como [TL, TR, BR, BL].
 *
 * Estrategia: se ordenan angularmente alrededor del centroide y luego se elige como
 * inicio la esquina "superior-izquierda" (menor x+y). Esto es estable incluso si el
 * documento está rotado o si dos esquinas comparten x o y.
 */
export function orderCorners(points: Point[]): Quad {
  if (points.length !== 4) {
    throw new Error("orderCorners requiere exactamente 4 puntos")
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / 4
  const cy = points.reduce((s, p) => s + p.y, 0) / 4

  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx)
    const angleB = Math.atan2(b.y - cy, b.x - cx)
    return angleA - angleB
  })

  // La esquina superior-izquierda es la de menor x+y.
  let startIndex = 0
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < sorted.length; i++) {
    const score = sorted[i].x + sorted[i].y
    if (score < best) {
      best = score
      startIndex = i
    }
  }

  const rotated = [0, 1, 2, 3].map((i) => sorted[(startIndex + i) % sorted.length])

  // Garantizar orden TL → TR → BR → BL. Con y hacia abajo, el sentido horario
  // en pantalla produce área con signo positiva (shoelace).
  const orientation = signedArea(rotated)
  if (orientation < 0) {
    return [rotated[0], rotated[3], rotated[2], rotated[1]] as Quad
  }
  return rotated as Quad
}

export function pointInBounds(p: Point, width: number, height: number, tolerance = 1): boolean {
  return (
    p.x >= -tolerance &&
    p.y >= -tolerance &&
    p.x <= width + tolerance &&
    p.y <= height + tolerance
  )
}

export function clampPoint(p: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(p.x, 0), width),
    y: Math.min(Math.max(p.y, 0), height),
  }
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

export function isConvexQuad(quad: Quad): boolean {
  const signs: number[] = []
  for (let i = 0; i < 4; i++) {
    const value = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4])
    if (Math.abs(value) < 1e-9) return false
    signs.push(Math.sign(value))
  }
  return signs.every((s) => s === signs[0])
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

export function isSelfIntersecting(quad: Quad): boolean {
  return segmentsIntersect(quad[0], quad[1], quad[2], quad[3]) || segmentsIntersect(quad[1], quad[2], quad[3], quad[0])
}

/**
 * Un cuadrilátero es plausible como documento si:
 * - Es convexo y no se auto-intersecta.
 * - Todas las esquinas están dentro de la imagen (con tolerancia).
 * - Cubre al menos `minAreaRatio` del área total.
 * - El lado mínimo supera un umbral absoluto (evita "documentos" de 2 píxeles).
 */
export function isPlausibleQuad(
  quad: Quad,
  imageWidth: number,
  imageHeight: number,
  minAreaRatio = 0.08,
  minSide = 24
): boolean {
  if (imageWidth <= 0 || imageHeight <= 0) return false
  const area = quadArea(quad)
  const total = imageWidth * imageHeight
  if (area / total < minAreaRatio) return false
  for (const p of quad) {
    if (!pointInBounds(p, imageWidth, imageHeight, 2)) return false
  }
  const sides = [
    distance(quad[0], quad[1]),
    distance(quad[1], quad[2]),
    distance(quad[2], quad[3]),
    distance(quad[3], quad[0]),
  ]
  if (Math.min(...sides) < minSide) return false
  if (!isConvexQuad(quad)) return false
  if (isSelfIntersecting(quad)) return false
  return true
}

/** Expande (o contrae) el cuadrilátero respecto a su centroide, sin salir de los límites. */
export function expandQuad(quad: Quad, ratio: number, width: number, height: number): Quad {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4
  const expanded = quad.map((p) => ({
    x: p.x + (p.x - cx) * ratio,
    y: p.y + (p.y - cy) * ratio,
  })) as Point[]
  return expanded.map((p) => clampPoint(p, width, height)) as Quad
}

/** Tamaño de salida sugerido para un recorte, conservando la proporción del destino. */
export function outputSizeForQuad(quad: Quad, maxDimension: number): { width: number; height: number } {
  const widthTop = distance(quad[0], quad[1])
  const widthBottom = distance(quad[3], quad[2])
  const heightLeft = distance(quad[0], quad[3])
  const heightRight = distance(quad[1], quad[2])
  const width = Math.max(1, (widthTop + widthBottom) / 2)
  const height = Math.max(1, (heightLeft + heightRight) / 2)
  const scale = maxDimension / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export type Matrix3 = [number, number, number, number, number, number, number, number, number]

/**
 * Homografía que mapea `src` (quad) a `dst` (quad), resuelta con eliminación gaussiana.
 * Devuelve la matriz 3x3 en orden por filas. Lanza si el sistema es degenerado.
 */
export function perspectiveTransform(src: Quad, dst: Quad): Matrix3 {
  const a: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  const solved = solveLinearSystem(a)
  if (!solved) throw new Error("perspectiveTransform: sistema degenerado")
  // h11..h32 resueltos; h33 = 1 por construcción.
  return [solved[0], solved[1], solved[2], solved[3], solved[4], solved[5], solved[6], solved[7], 1]
}

/** Resuelve un sistema lineal 8x9 (o n x n+1) por eliminación gaussiana con pivoteo parcial. */
function solveLinearSystem(rows: number[][]): number[] | null {
  const n = rows.length
  if (n === 0) return null
  const cols = rows[0].length
  const m = rows.map((row) => [...row])

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    if (pivot !== col) {
      const tmp = m[pivot]
      m[pivot] = m[col]
      m[col] = tmp
    }
    const pivotValue = m[col][col]
    for (let c = col; c < cols; c++) m[col][c] /= pivotValue
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = m[row][col]
      if (factor === 0) continue
      for (let c = col; c < cols; c++) m[row][c] -= factor * m[col][c]
    }
  }

  return m.map((row) => row[cols - 1])
}

export function applyTransform(t: Matrix3, p: Point): Point {
  const denominator = t[6] * p.x + t[7] * p.y + t[8]
  if (Math.abs(denominator) < 1e-12) return { x: Number.NaN, y: Number.NaN }
  return {
    x: (t[0] * p.x + t[1] * p.y + t[2]) / denominator,
    y: (t[3] * p.x + t[4] * p.y + t[5]) / denominator,
  }
}

export function invertTransform(t: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = t
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-12) return null
  const inv = 1 / det
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ]
}

/** Redondea y estabiliza las esquinas de un quad para su uso en UI (evita NaN). */
export function normalizeQuad(quad: Quad, width: number, height: number): Quad {
  return quad.map((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return { x: width / 2, y: height / 2 }
    }
    return clampPoint({ x: Math.round(p.x), y: Math.round(p.y) }, width, height)
  }) as Quad
}
