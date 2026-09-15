import { describe, it, expect } from "vitest"
import { warpPerspectiveRaster, scaleQuad } from "../lib/warp"
import { createRaster, getPixel, setPixel, type RasterImage } from "../lib/raster"
import type { Quad } from "../types/scanner-types"

function fillQuad(raster: RasterImage, quad: Quad, rgba: [number, number, number, number]): void {
  const corners = quad.map((p) => [p.x, p.y] as [number, number])
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (pointInPolygon(x, y, corners)) setPixel(raster, x, y, rgba)
    }
  }
}

function pointInPolygon(px: number, py: number, polygon: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function grayBackground(width: number, height: number): RasterImage {
  const raster = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setPixel(raster, x, y, [30, 30, 30, 255])
  }
  return raster
}

describe("warp: corrección de perspectiva", () => {
  it("endereza un cuadrilátero sesgado y lo convierte en rectángulo", () => {
    const raster = grayBackground(400, 400)
    const quad: Quad = [
      { x: 80, y: 60 },
      { x: 330, y: 90 },
      { x: 310, y: 340 },
      { x: 60, y: 300 },
    ]
    fillQuad(raster, quad, [255, 0, 0, 255])

    const warped = warpPerspectiveRaster(raster, quad, { maxDimension: 4000 })
    expect(warped).not.toBeNull()

    // Lado mayor ≈ longitud media de los lados del quad.
    const expectedWidth = (Math.hypot(330 - 80, 90 - 60) + Math.hypot(310 - 60, 340 - 300)) / 2
    const expectedHeight = (Math.hypot(60 - 80, 300 - 60) + Math.hypot(310 - 330, 340 - 90)) / 2
    expect(Math.abs(warped!.width - expectedWidth)).toBeLessThan(4)
    expect(Math.abs(warped!.height - expectedHeight)).toBeLessThan(4)

    // Toda la zona interior debe ser roja (sin fondo oscuro).
    const center = getPixel(warped!, Math.floor(warped!.width / 2), Math.floor(warped!.height / 2))
    expect(center[0]).toBeGreaterThan(230)
    expect(center[1]).toBeLessThan(30)
    expect(center[2]).toBeLessThan(30)

    const corner = getPixel(warped!, 5, 5)
    expect(corner[0]).toBeGreaterThan(230)
    expect(corner[1]).toBeLessThan(30)
  })

  it("un warp de identidad conserva la imagen", () => {
    const raster = grayBackground(120, 80)
    fillQuad(
      raster,
      [
        { x: 0, y: 0 },
        { x: 119, y: 0 },
        { x: 119, y: 79 },
        { x: 0, y: 79 },
      ],
      [10, 200, 90, 255]
    )
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 119, y: 0 },
      { x: 119, y: 79 },
      { x: 0, y: 79 },
    ]
    const warped = warpPerspectiveRaster(raster, quad, { maxDimension: 1000 })
    expect(warped).not.toBeNull()
    expect(warped!.width).toBe(120)
    expect(warped!.height).toBe(80)

    for (const [x, y] of [
      [10, 10],
      [60, 40],
      [100, 60],
    ]) {
      const pixel = getPixel(warped!, x, y)
      expect(pixel[1]).toBeGreaterThan(150)
      expect(pixel[0]).toBeLessThan(80)
    }
  })

  it("respeta el límite maxDimension", () => {
    const raster = grayBackground(800, 600)
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 799, y: 0 },
      { x: 799, y: 599 },
      { x: 0, y: 599 },
    ]
    const warped = warpPerspectiveRaster(raster, quad, { maxDimension: 400 })
    expect(Math.max(warped!.width, warped!.height)).toBeLessThanOrEqual(400)
  })

  it("devuelve null ante esquinas degeneradas", () => {
    const raster = grayBackground(100, 100)
    const degenerate: Quad = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 10 },
      { x: 40, y: 10 },
    ]
    expect(warpPerspectiveRaster(raster, degenerate)).toBeNull()
  })
})

describe("warp: scaleQuad", () => {
  it("escala todas las esquinas por el factor indicado", () => {
    const quad: Quad = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
    ]
    expect(scaleQuad(quad, 2)).toEqual([
      { x: 2, y: 4 },
      { x: 6, y: 8 },
      { x: 10, y: 12 },
      { x: 14, y: 16 },
    ])
  })
})
