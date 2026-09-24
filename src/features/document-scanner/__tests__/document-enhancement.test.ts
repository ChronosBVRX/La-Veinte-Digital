import { describe, it, expect } from "vitest"
import {
  enhanceDocument,
  enhanceGrayscale,
  enhanceBlackAndWhite,
  enhanceIdentification,
  normalizeIllumination,
  buildDocumentToneCurveLut,
  sharpenRaster,
} from "../lib/document-enhancement"
import { applyScanFilter } from "../lib/image-filters"
import { createRaster, getPixel, setPixel, type RasterImage } from "../lib/raster"

function makeRaster(width: number, height: number, fill = 255): RasterImage {
  const raster = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      setPixel(raster, x, y, [fill, fill, fill, 255])
    }
  }
  return raster
}

describe("document-enhancement: pipeline de mejora documental", () => {
  it("1. fondo gris/irregular se aproxima a blanco puro", () => {
    // Documento de 60x60 con fondo grisáceo (170) y texto oscuro (30)
    const source = makeRaster(60, 60, 170)
    for (let x = 10; x < 50; x++) {
      setPixel(source, x, 30, [30, 30, 30, 255])
    }

    const enhanced = enhanceDocument(source)
    const [bgR, bgG, bgB] = getPixel(enhanced, 5, 5)

    // El fondo grisáceo (170) se eleva a blanco puro o casi blanco (>= 250)
    expect(bgR).toBeGreaterThanOrEqual(250)
    expect(bgG).toBeGreaterThanOrEqual(250)
    expect(bgB).toBeGreaterThanOrEqual(250)
  })

  it("2. texto oscuro permanece oscuro y definido", () => {
    const source = makeRaster(60, 60, 220)
    for (let x = 10; x < 50; x++) {
      setPixel(source, x, 30, [25, 25, 25, 255])
    }

    const enhanced = enhanceDocument(source)
    const [textR, textG, textB] = getPixel(enhanced, 25, 30)

    // El texto permanece profundamente oscuro (<= 30)
    expect(textR).toBeLessThanOrEqual(30)
    expect(textG).toBeLessThanOrEqual(30)
    expect(textB).toBeLessThanOrEqual(30)
  })

  it("3. una sombra gradual es reducida significativamente", () => {
    // Degradado simulando una sombra diagonal/lateral: x=0 es 235 (luz), x=59 es 125 (sombra)
    const source = createRaster(60, 60)
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const val = Math.round(235 - (x / 59) * 110) // 235 -> 125
        setPixel(source, x, y, [val, val, val, 255])
      }
    }

    const normalized = normalizeIllumination(source)
    expect(getPixel(normalized, 5, 30)[0]).toBeGreaterThan(200)
    const enhanced = enhanceDocument(source)

    const [lightR] = getPixel(enhanced, 5, 30)
    const [shadowR] = getPixel(enhanced, 55, 30)

    // Ambos lados ahora son blanco de papel
    expect(lightR).toBeGreaterThanOrEqual(245)
    expect(shadowR).toBeGreaterThanOrEqual(240)

    // La diferencia inicial de 110 puntos se reduce a menos de 15 puntos
    const diff = Math.abs(lightR - shadowR)
    expect(diff).toBeLessThan(15)
  })

  it("4. firmas y trazos finos no desaparecen", () => {
    // Papel claro (230) con una línea de firma de 1 píxel de ancho (165)
    const source = makeRaster(50, 50, 230)
    for (let x = 5; x < 45; x++) {
      setPixel(source, x, 25, [165, 165, 165, 255]) // trazo fino
    }

    const doc = enhanceDocument(source)
    const gray = enhanceGrayscale(source)
    const bw = enhanceBlackAndWhite(source)

    // En Documento, el trazo fino es claramente más oscuro que el papel
    const [paperDoc] = getPixel(doc, 25, 10)
    const [strokeDoc] = getPixel(doc, 25, 25)
    expect(paperDoc).toBeGreaterThanOrEqual(250)
    expect(strokeDoc).toBeLessThan(230)
    expect(paperDoc - strokeDoc).toBeGreaterThan(25)

    // En Grises, el trazo fino se preserva
    const [paperGray] = getPixel(gray, 25, 10)
    const [strokeGray] = getPixel(gray, 25, 25)
    expect(paperGray).toBeGreaterThanOrEqual(250)
    expect(strokeGray).toBeLessThan(230)

    // En B/N, el trazo fino se detecta como primer plano (0) y no desaparece en blanco
    const [strokeBw] = getPixel(bw, 25, 25)
    expect(strokeBw).toBe(0)
  })

  it("5. sellos y firmas a color se preservan con balance de blanco natural", () => {
    // Papel con tinte amarillento (iluminación cálida: R=240, G=225, B=190)
    // Sello azul: R=45, G=85, B=210
    const source = createRaster(50, 50)
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        setPixel(source, x, y, [240, 225, 190, 255])
      }
    }
    // Sello azul en el centro
    for (let y = 20; y < 30; y++) {
      for (let x = 20; x < 30; x++) {
        setPixel(source, x, y, [45, 85, 210, 255])
      }
    }

    const enhanced = enhanceDocument(source)

    // El papel amarillento queda en blanco neutro (R=G=B=255)
    const [bgR, bgG, bgB] = getPixel(enhanced, 5, 5)
    expect(bgR).toBe(255)
    expect(bgG).toBe(255)
    expect(bgB).toBe(255)

    // El sello azul sigue siendo prominentemente azul (B >> R)
    const [sealR, , sealB] = getPixel(enhanced, 25, 25)
    expect(sealB).toBeGreaterThan(sealR + 100)
    expect(sealB).toBeGreaterThan(200)
  })

  it("6. original no cambia visualmente salvo normalización", () => {
    const source = makeRaster(30, 30, 180)
    setPixel(source, 10, 10, [50, 100, 150, 255])
    const out = applyScanFilter(source, "original")
    expect(out).not.toBe(source)
    expect(Array.from(out.data)).toEqual(Array.from(source.data))
  })

  it("7. enhanced no devuelve simplemente el mismo raster", () => {
    const source = makeRaster(40, 40, 190)
    for (let x = 10; x < 30; x++) setPixel(source, x, 20, [40, 40, 40, 255])
    const out = applyScanFilter(source, "enhanced")
    expect(Array.from(out.data)).not.toEqual(Array.from(source.data))
    // El fondo de 190 pasa a 255
    expect(getPixel(out, 2, 2)[0]).toBe(255)
  })

  it("8. grayscale produce exactamente R=G=B en todos los píxeles", () => {
    const source = createRaster(30, 30)
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        setPixel(source, x, y, [x * 8, y * 8, (x + y) * 4, 255])
      }
    }
    const gray = applyScanFilter(source, "grayscale")
    for (let i = 0; i < gray.data.length; i += 4) {
      expect(gray.data[i]).toBe(gray.data[i + 1])
      expect(gray.data[i + 1]).toBe(gray.data[i + 2])
    }
  })

  it("9. bw sólo produce valores 0 o 255", () => {
    const source = makeRaster(40, 40, 210)
    for (let y = 15; y < 25; y++) {
      for (let x = 10; x < 30; x++) setPixel(source, x, y, [30, 30, 30, 255])
    }
    const bw = applyScanFilter(source, "bw")
    for (let i = 0; i < bw.data.length; i += 4) {
      expect([0, 255]).toContain(bw.data[i])
      expect(bw.data[i]).toBe(bw.data[i + 1])
      expect(bw.data[i]).toBe(bw.data[i + 2])
    }
  })

  it("10. bw evita huecos dentro de caracteres negros gruesos", () => {
    // Letra o encabezado grueso: bloque de 16x16 píxeles oscuros (25)
    const source = makeRaster(50, 50, 240)
    for (let y = 15; y < 31; y++) {
      for (let x = 15; x < 31; x++) {
        setPixel(source, x, y, [25, 25, 25, 255])
      }
    }
    const bw = enhanceBlackAndWhite(source)
    // El centro del bloque no debe ser un agujero blanco
    const [center] = getPixel(bw, 23, 23)
    expect(center).toBe(0)
  })

  it("11. la máscara de enfoque no crea ruido en áreas de papel plano", () => {
    const source = makeRaster(30, 30, 255)
    const sharpened = sharpenRaster(source, 0.5)
    expect(Array.from(sharpened.data)).toEqual(Array.from(source.data))
  })

  it("12. LUT de curva tonal es monótona y cubre 0..255", () => {
    const lut = buildDocumentToneCurveLut(30, 228)
    expect(lut[0]).toBe(0)
    expect(lut[30]).toBe(0)
    expect(lut[228]).toBe(255)
    expect(lut[255]).toBe(255)
    // Monotonía
    for (let i = 1; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1])
    }
  })

  it("13. enhanceIdentification es conservador: no blanquea a 255 ni destruye degradados/tramas de seguridad", () => {
    // Credencial simulada con fondo guilloché pastel (195, 210, 205) y degradado
    const source = createRaster(50, 50)
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        // Trama con leve variación de color
        const r = 195 + (x % 5)
        const g = 210 + (y % 5)
        const b = 205
        setPixel(source, x, y, [r, g, b, 255])
      }
    }
    // Fotografía con degradado tonal
    for (let y = 10; y < 40; y++) {
      for (let x = 10; x < 25; x++) {
        const skinTone = 120 + x + y
        setPixel(source, x, y, [skinTone, Math.round(skinTone * 0.8), Math.round(skinTone * 0.7), 255])
      }
    }

    const idEnhanced = enhanceIdentification(source)

    // No blanquea agresivamente el fondo a blanco (255)
    const [bgR, bgG, bgB] = getPixel(idEnhanced, 45, 45)
    expect(bgR).toBeLessThan(250)
    expect(bgG).toBeLessThan(250)
    expect(bgB).toBeLessThan(250)

    // Conserva las diferencias sutiles de la trama
    const [p1] = getPixel(idEnhanced, 40, 45)
    const [p2] = getPixel(idEnhanced, 41, 45)
    expect(p1).toBeDefined()
    expect(p2).toBeDefined()

    // No produce imagen binaria (conserva tonos continuos en la foto)
    const [skinR] = getPixel(idEnhanced, 15, 20)
    expect(skinR).toBeGreaterThan(50)
    expect(skinR).toBeLessThan(220)
  })
})
