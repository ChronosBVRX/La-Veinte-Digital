import { describe, it, expect } from "vitest"
import { detectDocumentQuad } from "../lib/quad-detection"
import { quadArea } from "../lib/geometry"
import { createRaster, setPixel, type RasterImage } from "../lib/raster"

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

/**
 * Genera una "foto" sintética: fondo oscuro con un documento claro.
 */
function createDocumentPhoto(options: {
  size?: number
  corners?: Array<[number, number]>
  background?: number
  paper?: number
  noise?: number
  withTextLines?: boolean
}): RasterImage {
  const size = options.size ?? 400
  const background = options.background ?? 40
  const paper = options.paper ?? 235
  const noise = options.noise ?? 6
  const random = createSeededRandom(42)

  const corners =
    options.corners ??
    ([
      [70, 60],
      [330, 80],
      [350, 340],
      [60, 320],
    ] as Array<[number, number]>)

  const raster = createRaster(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.max(0, Math.min(255, background + (random() - 0.5) * noise))
      setPixel(raster, x, y, [value, value, value, 255])
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (pointInQuad(x, y, corners)) {
        const value = Math.max(0, Math.min(255, paper + (random() - 0.5) * noise))
        setPixel(raster, x, y, [value, value, value, 255])
      }
    }
  }

  if (options.withTextLines !== false) {
    for (let line = 0; line < 8; line++) {
      const lineY = 110 + line * 24
      for (let x = 110; x < 300; x++) {
        if (pointInQuad(x, lineY, corners) && random() > 0.25) {
          setPixel(raster, x, lineY, [25, 25, 25, 255])
        }
      }
    }
  }

  return raster
}

function pointInQuad(px: number, py: number, quad: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = quad[i]
    const [xj, yj] = quad[j]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function pointInsideQuad(px: number, py: number, quad: Array<{ x: number; y: number }>): boolean {
  return pointInQuad(
    px,
    py,
    quad.map((p) => [p.x, p.y] as [number, number])
  )
}

describe("quad-detection", () => {
  it("detecta el documento en una foto sintética", () => {
    const raster = createDocumentPhoto({})
    const detected = detectDocumentQuad(raster)
    expect(detected).not.toBeNull()
    expect(detected!.confidence).toBeGreaterThan(0.3)

    const area = quadArea(detected!.quad)
    const imageArea = raster.width * raster.height
    expect(area / imageArea).toBeGreaterThan(0.5)
    expect(area / imageArea).toBeLessThan(0.95)
  })

  it("contiene el documento real con esquinas ajustadas (el resto es ajustable)", () => {
    const expected: Array<[number, number]> = [
      [70, 60],
      [330, 80],
      [350, 340],
      [60, 320],
    ]
    const raster = createDocumentPhoto({ corners: expected })
    const detected = detectDocumentQuad(raster)
    expect(detected).not.toBeNull()

    // Contrato de seguridad: el recorte NUNCA debe perder contenido del documento.
    for (const [x, y] of expected) {
      expect(pointInsideQuad(x, y, detected!.quad)).toBe(true)
    }

    // Al menos 3 esquinas deben quedar cerca del borde real (tolerancia 18px).
    let nearCorners = 0
    for (let i = 0; i < 4; i++) {
      const dx = Math.abs(detected!.quad[i].x - expected[i][0])
      const dy = Math.abs(detected!.quad[i].y - expected[i][1])
      if (dx < 18 && dy < 18) nearCorners++
    }
    expect(nearCorners).toBeGreaterThanOrEqual(3)
  })

  it("devuelve null en una imagen uniforme (sin papel)", () => {
    const raster = createRaster(300, 300)
    for (let y = 0; y < 300; y++) {
      for (let x = 0; x < 300; x++) setPixel(raster, x, y, [128, 128, 128, 255])
    }
    expect(detectDocumentQuad(raster)).toBeNull()
  })

  it("devuelve null en imágenes demasiado pequeñas", () => {
    const raster = createRaster(16, 16)
    expect(detectDocumentQuad(raster)).toBeNull()
  })

  it("detecta documentos muy inclinados", () => {
    const raster = createDocumentPhoto({
      corners: [
        [180, 30],
        [370, 180],
        [220, 370],
        [30, 220],
      ],
    })
    const detected = detectDocumentQuad(raster)
    expect(detected).not.toBeNull()
  })
})
