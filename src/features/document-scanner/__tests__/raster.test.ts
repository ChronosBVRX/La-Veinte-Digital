// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import {
  base64ToBlob,
  cloneRaster,
  createRaster,
  downscaleForAnalysis,
  getPixel,
  rotateRaster,
  scaleRaster,
  setPixel,
} from "../lib/raster"

function checker(width: number, height: number): ReturnType<typeof createRaster> {
  const raster = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = (x + y) % 2 === 0 ? 255 : 0
      setPixel(raster, x, y, [value, value, value, 255])
    }
  }
  return raster
}

describe("raster: operaciones puras", () => {
  it("cloneRaster copia sin compartir el buffer", () => {
    const source = createRaster(2, 2)
    setPixel(source, 0, 0, [1, 2, 3, 255])
    const copy = cloneRaster(source)
    setPixel(copy, 0, 0, [9, 9, 9, 255])
    expect(getPixel(source, 0, 0)[0]).toBe(1)
    expect(getPixel(copy, 0, 0)[0]).toBe(9)
  })

  it("scaleRaster cambia el tamaño conservando el patrón", () => {
    const source = checker(4, 4)
    const scaled = scaleRaster(source, 2, 2)
    expect(scaled.width).toBe(2)
    expect(scaled.height).toBe(2)
    expect(getPixel(scaled, 0, 0)[0]).toBeGreaterThan(200)
  })

  it("downscaleForAnalysis respeta el máximo y no agranda", () => {
    const large = checker(2000, 1000)
    const small = downscaleForAnalysis(large, 500)
    expect(Math.max(small.width, small.height)).toBe(500)

    const tiny = checker(100, 50)
    const same = downscaleForAnalysis(tiny, 500)
    expect(same.width).toBe(100)
    expect(same.height).toBe(50)
  })

  it("rotateRaster 90 grados intercambia dimensiones", () => {
    const source = createRaster(4, 2)
    setPixel(source, 0, 0, [255, 0, 0, 255])
    const rotated = rotateRaster(source, 90)
    expect(rotated.width).toBe(2)
    expect(rotated.height).toBe(4)
    // La esquina superior izquierda pasa a la superior derecha.
    expect(getPixel(rotated, 1, 0)[0]).toBe(255)
  })

  it("rotateRaster 180 grados invierte el orden de los píxeles", () => {
    const source = createRaster(2, 1)
    setPixel(source, 0, 0, [255, 0, 0, 255])
    setPixel(source, 1, 0, [0, 255, 0, 255])
    const rotated = rotateRaster(source, 180)
    expect(getPixel(rotated, 0, 0)[1]).toBe(255)
    expect(getPixel(rotated, 1, 0)[0]).toBe(255)
  })

  it("rotateRaster 0 devuelve copia independiente", () => {
    const source = checker(2, 2)
    const rotated = rotateRaster(source, 0)
    expect(rotated).not.toBe(source)
    expect(Array.from(rotated.data)).toEqual(Array.from(source.data))
  })

  it("base64ToBlob reconstruye bytes y tipo", () => {
    const original = "Hola mundo"
    const base64 = btoa(original)
    const blob = base64ToBlob(base64, "image/jpeg")
    expect(blob.type).toBe("image/jpeg")
    expect(blob.size).toBe(original.length)
  })
})
