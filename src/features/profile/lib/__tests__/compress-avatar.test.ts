import { describe, it, expect } from "vitest"
import {
  calculateCenterCrop,
  validateAvatarFile,
  MAX_AVATAR_INPUT_BYTES,
} from "../compress-avatar"

describe("compress-avatar - calculateCenterCrop", () => {
  it("calcula recorte cuadrado en imagen horizontal (landscape 1920x1080)", () => {
    const crop = calculateCenterCrop(1920, 1080)
    expect(crop.sWidth).toBe(1080)
    expect(crop.sHeight).toBe(1080)
    expect(crop.sy).toBe(0)
    expect(crop.sx).toBe(Math.floor((1920 - 1080) / 2)) // 420
  })

  it("calcula recorte cuadrado en imagen vertical (portrait 1080x1920)", () => {
    const crop = calculateCenterCrop(1080, 1920)
    expect(crop.sWidth).toBe(1080)
    expect(crop.sHeight).toBe(1080)
    expect(crop.sx).toBe(0)
    expect(crop.sy).toBe(Math.floor((1920 - 1080) / 2)) // 420
  })

  it("mantiene dimensiones idénticas en imagen ya cuadrada (800x800)", () => {
    const crop = calculateCenterCrop(800, 800)
    expect(crop).toEqual({
      sx: 0,
      sy: 0,
      sWidth: 800,
      sHeight: 800,
    })
  })

  it("retorna ceros ante dimensiones no válidas", () => {
    expect(calculateCenterCrop(0, 500)).toEqual({ sx: 0, sy: 0, sWidth: 0, sHeight: 0 })
    expect(calculateCenterCrop(-100, -200)).toEqual({ sx: 0, sy: 0, sWidth: 0, sHeight: 0 })
  })
})

describe("compress-avatar - validateAvatarFile", () => {
  it("acepta archivos con tipo mime image/*", () => {
    const validFile = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" })
    const result = validateAvatarFile(validFile)
    expect(result.valid).toBe(true)
  })

  it("rechaza archivos que no son imágenes (ej. application/pdf)", () => {
    const pdfFile = new File(["dummy content"], "doc.pdf", { type: "application/pdf" })
    const result = validateAvatarFile(pdfFile)
    expect(result.valid).toBe(false)
    expect(result.error).toContain("debe ser una imagen")
  })

  it("rechaza archivos que exceden el límite máximo de 25MB", () => {
    const bigFile = new File(["dummy content"], "huge.jpg", { type: "image/jpeg" })
    Object.defineProperty(bigFile, "size", { value: MAX_AVATAR_INPUT_BYTES + 1 })
    const result = validateAvatarFile(bigFile)
    expect(result.valid).toBe(false)
    expect(result.error).toContain("demasiado pesada")
  })
})
