/**
 * Filtros de mejora de imagen del escáner (100% locales, sin IA y sin OCR).
 *
 * No modifican el contenido textual: solo contraste, color y umbralizado.
 * - original: sin cambios.
 * - enhanced: autocontraste por percentiles + ligera saturación (documento a color legible).
 * - grayscale: luminancia con autocontraste.
 * - bw: umbral adaptativo local (texto nítido, fondo limpio).
 *
 * La Veinte Digital
 */

import type { ScanFilter } from "@/shared/contracts/document-scan"
import { cloneRaster, type RasterImage } from "./raster"
import {
  enhanceDocument,
  enhanceGrayscale,
  enhanceBlackAndWhite,
} from "./document-enhancement"

export function computeLuminance(raster: RasterImage): Uint8ClampedArray {
  const total = raster.width * raster.height
  const luminance = new Uint8ClampedArray(total)
  for (let i = 0; i < total; i++) {
    const index = i * 4
    luminance[i] = Math.round(
      0.299 * raster.data[index] + 0.587 * raster.data[index + 1] + 0.114 * raster.data[index + 2]
    )
  }
  return luminance
}

export function computeHistogram(values: Uint8ClampedArray): Uint32Array {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < values.length; i++) {
    histogram[values[i]]++
  }
  return histogram
}

/** Umbral de Otsu (global) sobre un histograma. */
export function otsuThreshold(histogram: Uint32Array): number {
  const total = histogram.reduce((sum, value) => sum + value, 0)
  if (total === 0) return 127

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumBackground = 0
  let weightBackground = 0
  let maxVariance = -1
  let threshold = 127

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]
    if (weightBackground === 0) continue
    const weightForeground = total - weightBackground
    if (weightForeground === 0) break

    sumBackground += t * histogram[t]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }
  return threshold
}

function percentileFromHistogram(histogram: Uint32Array, total: number, percentile: number): number {
  const target = total * percentile
  let accumulated = 0
  for (let i = 0; i < 256; i++) {
    accumulated += histogram[i]
    if (accumulated >= target) return i
  }
  return 255
}

/** Tabla de autocontraste por percentiles (1% y 99%). */
export function autoLevelsLut(values: Uint8ClampedArray, lowPercentile = 0.01, highPercentile = 0.99): Uint8ClampedArray {
  const histogram = computeHistogram(values)
  const low = percentileFromHistogram(histogram, values.length, lowPercentile)
  const high = percentileFromHistogram(histogram, values.length, highPercentile)
  const range = Math.max(1, high - low)
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(Math.min(255, Math.max(0, ((i - low) / range) * 255)))
  }
  return lut
}

/** Aplica el filtro solicitado. Nunca modifica la entrada. */
export function applyScanFilter(source: RasterImage, filter: ScanFilter): RasterImage {
  switch (filter) {
    case "original":
      return cloneRaster(source)
    case "enhanced":
      return enhanceDocument(source)
    case "grayscale":
      return enhanceGrayscale(source)
    case "bw":
      return enhanceBlackAndWhite(source)
    default:
      return cloneRaster(source)
  }
}

export function toBlackAndWhite(source: RasterImage, windowRatio = 0.04, c = 10): RasterImage {
  return enhanceBlackAndWhite(source, windowRatio, c)
}
