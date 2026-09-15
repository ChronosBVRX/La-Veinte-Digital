import { describe, it, expect } from "vitest"
import {
  applyTransform,
  expandQuad,
  invertTransform,
  isPlausibleQuad,
  isSelfIntersecting,
  normalizeQuad,
  orderCorners,
  outputSizeForQuad,
  perspectiveTransform,
  quadArea,
} from "../lib/geometry"
import type { Point, Quad } from "../types/scanner-types"

describe("geometry: orderCorners", () => {
  it("ordena un cuadrilátero alineado como TL, TR, BR, BL", () => {
    const quad = orderCorners([
      { x: 100, y: 100 },
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ])
    expect(quad).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])
  })

  it("ordena un cuadrilátero rotado (rombo) de forma consistente", () => {
    const quad = orderCorners([
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ])
    // Esquina superior (menor x+y) primero, luego horario: derecha, abajo, izquierda.
    expect(quad[0]).toEqual({ x: 50, y: 0 })
    expect(quad[1]).toEqual({ x: 100, y: 50 })
    expect(quad[2]).toEqual({ x: 50, y: 100 })
    expect(quad[3]).toEqual({ x: 0, y: 50 })
    // Winding canónico: área positiva (horario en pantalla, y hacia abajo).
    expect(quadArea(quad)).toBeGreaterThan(0)
  })

  it("produce el mismo resultado sin importar el orden de entrada", () => {
    const points: Point[] = [
      { x: 10, y: 12 },
      { x: 210, y: 8 },
      { x: 205, y: 300 },
      { x: 14, y: 296 },
    ]
    const permutations = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ]
    const first = orderCorners(permutations[0].map((i) => points[i]))
    for (const perm of permutations.slice(1)) {
      expect(orderCorners(perm.map((i) => points[i]))).toEqual(first)
    }
  })

  it("rechaza entradas que no tienen 4 puntos", () => {
    expect(() => orderCorners([{ x: 0, y: 0 }])).toThrow()
  })
})

describe("geometry: isPlausibleQuad", () => {
  const image = { width: 1000, height: 1000 }

  it("acepta un documento que ocupa buena parte de la imagen", () => {
    const quad: Quad = [
      { x: 100, y: 100 },
      { x: 900, y: 110 },
      { x: 890, y: 920 },
      { x: 95, y: 905 },
    ]
    expect(isPlausibleQuad(quad, image.width, image.height)).toBe(true)
  })

  it("rechaza un cuadrilátero diminuto", () => {
    const quad: Quad = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ]
    expect(isPlausibleQuad(quad, image.width, image.height)).toBe(false)
  })

  it("rechaza un cuadrilátero cóncavo", () => {
    const quad: Quad = [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 900 },
    ]
    expect(isPlausibleQuad(quad, image.width, image.height)).toBe(false)
  })

  it("rechaza esquinas fuera de la imagen", () => {
    const quad: Quad = [
      { x: -50, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 900 },
      { x: 100, y: 900 },
    ]
    expect(isPlausibleQuad(quad, image.width, image.height)).toBe(false)
  })
})

describe("geometry: homografía", () => {
  it("mapea exactamente las esquinas de origen al destino", () => {
    const src: Quad = [
      { x: 10, y: 20 },
      { x: 210, y: 30 },
      { x: 200, y: 260 },
      { x: 5, y: 250 },
    ]
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 500 },
      { x: 0, y: 500 },
    ]
    const t = perspectiveTransform(src, dst)
    for (let i = 0; i < 4; i++) {
      const mapped = applyTransform(t, src[i])
      expect(mapped.x).toBeCloseTo(dst[i].x, 6)
      expect(mapped.y).toBeCloseTo(dst[i].y, 6)
    }
  })

  it("invierte la transformación correctamente", () => {
    const src: Quad = [
      { x: 0, y: 0 },
      { x: 300, y: 20 },
      { x: 280, y: 400 },
      { x: 10, y: 390 },
    ]
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 700 },
      { x: 0, y: 700 },
    ]
    const t = perspectiveTransform(src, dst)
    const inv = invertTransform(t)
    expect(inv).not.toBeNull()
    const probe: Point = { x: 123.5, y: 77.25 }
    const forward = applyTransform(t, probe)
    const back = applyTransform(inv as NonNullable<typeof inv>, forward)
    expect(back.x).toBeCloseTo(probe.x, 5)
    expect(back.y).toBeCloseTo(probe.y, 5)
  })

  it("lanza si el origen es degenerado (área cero)", () => {
    const degenerate: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 10 },
    ]
    expect(() =>
      perspectiveTransform(degenerate, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ])
    ).toThrow()
  })
})

describe("geometry: utilidades de encuadre", () => {
  it("outputSizeForQuad conserva la proporción aproximada", () => {
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 1200, y: 0 },
      { x: 1200, y: 600 },
      { x: 0, y: 600 },
    ]
    const out = outputSizeForQuad(quad, 1200)
    expect(out.width).toBe(1200)
    expect(out.height).toBe(600)
  })

  it("expandQuad no sale de los límites de la imagen", () => {
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ]
    const expanded = expandQuad(quad, 0.2, 1000, 1000)
    for (const p of expanded) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1000)
      expect(p.y).toBeLessThanOrEqual(1000)
    }
  })

  it("normalizeQuad repara coordenadas no finitas", () => {
    const quad = normalizeQuad(
      [
        { x: Number.NaN, y: 10 },
        { x: 100, y: 10 },
        { x: 100, y: 100 },
        { x: 10, y: 100 },
      ],
      200,
      200
    )
    expect(quad[0]).toEqual({ x: 100, y: 100 })
  })

  it("detecta cuadriláteros auto-intersectados", () => {
    const crossed: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(isSelfIntersecting(crossed)).toBe(true)
  })
})
