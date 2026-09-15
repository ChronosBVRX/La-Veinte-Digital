/**
 * Corrección de perspectiva (warp) pura sobre buffers RGBA.
 *
 * Mapeo inverso: para cada píxel destino se calcula su coordenada en la fuente
 * mediante la homografía y se muestrea con interpolación bilineal. Esto evita
 * huecos y produce bordes limpios en texto.
 *
 * La Veinte Digital
 */

import type { Quad } from "../types/scanner-types"
import { perspectiveTransform } from "./geometry"
import { createRaster, type RasterImage } from "./raster"

export interface WarpOptions {
  /** Máximo lado del resultado (protege memoria y tamaño del PDF). */
  maxDimension?: number
}

/**
 * Endereza el cuadrilátero `quad` de `source` a un rectángulo.
 * Devuelve `null` si el cuadrilátero es degenerado.
 */
export function warpPerspectiveRaster(
  source: RasterImage,
  quad: Quad,
  options: WarpOptions = {}
): RasterImage | null {
  const maxDimension = options.maxDimension ?? 2400

  const targetWidthRaw = Math.max(
    1,
    (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) +
      Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) /
      2 +
      1
  )
  const targetHeightRaw = Math.max(
    1,
    (Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y) +
      Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y)) /
      2 +
      1
  )

  const scale = Math.min(1, maxDimension / Math.max(targetWidthRaw, targetHeightRaw))
  const width = Math.max(1, Math.round(targetWidthRaw * scale))
  const height = Math.max(1, Math.round(targetHeightRaw * scale))

  const destination: Quad = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ]

  let inverse: ReturnType<typeof perspectiveTransform>
  try {
    // Inversa: destino → fuente para mapeo inverso.
    inverse = perspectiveTransform(destination, quad)
  } catch {
    return null
  }

  const { data: src, width: srcWidth, height: srcHeight } = source
  const out = createRaster(width, height)
  const outData = out.data

  const h0 = inverse[0]
  const h1 = inverse[1]
  const h2 = inverse[2]
  const h3 = inverse[3]
  const h4 = inverse[4]
  const h5 = inverse[5]
  const h6 = inverse[6]
  const h7 = inverse[7]
  const h8 = inverse[8]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const denominator = h6 * x + h7 * y + h8
      if (Math.abs(denominator) < 1e-12) continue
      const srcX = (h0 * x + h1 * y + h2) / denominator
      const srcY = (h3 * x + h4 * y + h5) / denominator

      const outIndex = (y * width + x) * 4
      if (srcX < 0 || srcY < 0 || srcX > srcWidth - 1 || srcY > srcHeight - 1) {
        // Fuera del documento: blanco (papel) en lugar de negro.
        outData[outIndex] = 255
        outData[outIndex + 1] = 255
        outData[outIndex + 2] = 255
        outData[outIndex + 3] = 255
        continue
      }

      const x0 = Math.floor(srcX)
      const y0 = Math.floor(srcY)
      const x1 = Math.min(srcWidth - 1, x0 + 1)
      const y1 = Math.min(srcHeight - 1, y0 + 1)
      const wx = srcX - x0
      const wy = srcY - y0

      const i00 = (y0 * srcWidth + x0) * 4
      const i10 = (y0 * srcWidth + x1) * 4
      const i01 = (y1 * srcWidth + x0) * 4
      const i11 = (y1 * srcWidth + x1) * 4

      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - wx) + src[i10 + c] * wx
        const bottom = src[i01 + c] * (1 - wx) + src[i11 + c] * wx
        outData[outIndex + c] = top * (1 - wy) + bottom * wy
      }
      outData[outIndex + 3] = 255
    }
  }

  return out
}

/** Escala las esquinas de la imagen de análisis a las coordenadas de la imagen completa. */
export function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad
}
