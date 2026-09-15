import { describe, it, expect } from "vitest"
import { WebDocumentScanner, toSourceQuad } from "../services/web-document-scanner"
import type { AnalysisImage } from "../services/web-document-scanner"
import { createRaster, getPixel, setPixel } from "../lib/raster"
import type { Quad } from "../types/scanner-types"

function fillDocument(raster: ReturnType<typeof createRaster>, quad: Quad, value: number): void {
  const corners = quad.map((p) => [p.x, p.y] as [number, number])
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (pointInPolygon(x, y, corners)) setPixel(raster, x, y, [value, value, value, 255])
    }
  }
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const index = (y * raster.width + x) * 4
      if (raster.data[index + 3] === 0) setPixel(raster, x, y, [20, 20, 20, 255])
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

describe("WebDocumentScanner", () => {
  it("declara el motor web", () => {
    const scanner = new WebDocumentScanner()
    expect(scanner.engine).toBe("web")
  })

  it("processRaster endereza y aplica filtro sin tocar la fuente", () => {
    const raster = createRaster(300, 300)
    const quad: Quad = [
      { x: 50, y: 40 },
      { x: 250, y: 60 },
      { x: 240, y: 270 },
      { x: 40, y: 250 },
    ]
    fillDocument(raster, quad, 240)
    const snapshot = Array.from(raster.data)

    const scanner = new WebDocumentScanner()
    const processed = scanner.processRaster(raster, quad, "bw", 400)
    expect(processed).not.toBeNull()
    expect(processed!.width).toBeLessThanOrEqual(400)
    expect(processed!.height).toBeLessThanOrEqual(400)

    // El fondo del papel queda blanco tras bw.
    const center = getPixel(processed!, Math.floor(processed!.width / 2), 5)
    expect(center[0]).toBe(255)
    // La imagen original no se muta.
    expect(Array.from(raster.data)).toEqual(snapshot)
  })

  it("processRaster devuelve null con esquinas degeneradas", () => {
    const raster = createRaster(100, 100)
    const degenerate: Quad = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 10 },
      { x: 40, y: 10 },
    ]
    const scanner = new WebDocumentScanner()
    expect(scanner.processRaster(raster, degenerate, "original")).toBeNull()
  })

  it("toSourceQuad escala las esquinas del análisis a la imagen completa", () => {
    const analysis: AnalysisImage = {
      raster: createRaster(100, 100),
      scaleToSource: 3,
    }
    const quad: Quad = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
    ]
    expect(toSourceQuad(quad, analysis)).toEqual([
      { x: 3, y: 6 },
      { x: 9, y: 12 },
      { x: 15, y: 18 },
      { x: 21, y: 24 },
    ])
  })
})
