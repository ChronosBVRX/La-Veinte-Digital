import { describe, it, expect } from "vitest"
import {
  applyScanFilter,
  autoLevelsLut,
  computeHistogram,
  computeLuminance,
  otsuThreshold,
  toBlackAndWhite,
} from "../lib/image-filters"
import { createRaster, getPixel, setPixel, type RasterImage } from "../lib/raster"

function uniformRaster(width: number, height: number, value: number): RasterImage {
  const raster = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      setPixel(raster, x, y, [value, value, value, 255])
    }
  }
  return raster
}

function splitRaster(width: number, height: number, leftValue: number, rightValue: number): RasterImage {
  const raster = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = x < width / 2 ? leftValue : rightValue
      setPixel(raster, x, y, [value, value, value, 255])
    }
  }
  return raster
}

describe("image-filters: histograma y Otsu", () => {
  it("calcula el histograma correcto", () => {
    const values = new Uint8ClampedArray([0, 0, 10, 10, 10, 255])
    const histogram = computeHistogram(values)
    expect(histogram[0]).toBe(2)
    expect(histogram[10]).toBe(3)
    expect(histogram[255]).toBe(1)
  })

  it("Otsu separa una imagen bimodal", () => {
    const values = new Uint8ClampedArray(100)
    for (let i = 0; i < 100; i++) values[i] = i < 50 ? 30 : 220
    const threshold = otsuThreshold(computeHistogram(values))
    expect(threshold).toBeGreaterThanOrEqual(30)
    expect(threshold).toBeLessThan(220)
  })

  it("Otsu con histograma vacío devuelve un umbral por defecto", () => {
    expect(otsuThreshold(new Uint32Array(256))).toBe(127)
  })
})

describe("image-filters: luminancia y autocontraste", () => {
  it("la luminancia usa los coeficientes estándar", () => {
    const raster = createRaster(2, 1)
    setPixel(raster, 0, 0, [255, 0, 0, 255])
    setPixel(raster, 1, 0, [0, 0, 255, 255])
    const luminance = computeLuminance(raster)
    expect(luminance[0]).toBe(76)
    expect(luminance[1]).toBe(29)
  })

  it("autoLevelsLut expande un rango estrecho a 0..255", () => {
    const values = new Uint8ClampedArray(1000)
    for (let i = 0; i < 1000; i++) values[i] = i % 2 === 0 ? 100 : 150
    const lut = autoLevelsLut(values)
    expect(lut[100]).toBe(0)
    expect(lut[150]).toBe(255)
  })
})

describe("image-filters: filtros aplicables", () => {
  it("original devuelve una copia sin modificar", () => {
    const source = splitRaster(4, 2, 10, 240)
    const filtered = applyScanFilter(source, "original")
    expect(filtered).not.toBe(source)
    expect(Array.from(filtered.data)).toEqual(Array.from(source.data))
  })

  it("grayscale produce canales iguales", () => {
    const raster = createRaster(2, 1)
    setPixel(raster, 0, 0, [200, 50, 25, 255])
    setPixel(raster, 1, 0, [10, 180, 90, 255])
    const filtered = applyScanFilter(raster, "grayscale")
    for (let x = 0; x < 2; x++) {
      const [r, g, b] = getPixel(filtered, x, 0)
      expect(r).toBe(g)
      expect(g).toBe(b)
    }
  })

  it("bw solo produce 0 o 255", () => {
    const raster = splitRaster(8, 8, 40, 230)
    const filtered = applyScanFilter(raster, "bw")
    for (let i = 0; i < filtered.data.length; i += 4) {
      expect([0, 255]).toContain(filtered.data[i])
    }
  })

  it("bw deja el fondo claro en blanco y el texto oscuro en negro", () => {
    const raster = uniformRaster(40, 40, 235)
    // Trazo "de texto" oscuro
    for (let x = 5; x < 35; x++) setPixel(raster, x, 20, [20, 20, 20, 255])
    const filtered = toBlackAndWhite(raster)
    expect(getPixel(filtered, 1, 1)[0]).toBe(255)
    expect(getPixel(filtered, 20, 20)[0]).toBe(0)
  })

  it("enhanced conserva la legibilidad (no invierte extremos)", () => {
    const raster = splitRaster(10, 10, 20, 235)
    const filtered = applyScanFilter(raster, "enhanced")
    const left = getPixel(filtered, 0, 0)[0]
    const right = getPixel(filtered, 9, 0)[0]
    expect(left).toBeLessThan(right)
  })

  it("los filtros no mutan la imagen original", () => {
    const raster = splitRaster(6, 6, 30, 220)
    const snapshot = Array.from(raster.data)
    applyScanFilter(raster, "grayscale")
    applyScanFilter(raster, "bw")
    applyScanFilter(raster, "enhanced")
    expect(Array.from(raster.data)).toEqual(snapshot)
  })
})
