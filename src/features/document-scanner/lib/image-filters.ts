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
import { cloneRaster, createRaster, type RasterImage } from "./raster"

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
      return enhanceColor(source)
    case "grayscale":
      return toGrayscale(source)
    case "bw":
      return toBlackAndWhite(source)
    default:
      return cloneRaster(source)
  }
}

function enhanceColor(source: RasterImage): RasterImage {
  const total = source.width * source.height
  const luminance = computeLuminance(source)
  const lut = autoLevelsLut(luminance)

  const out = createRaster(source.width, source.height)
  for (let i = 0; i < total; i++) {
    const index = i * 4
    const r = lut[source.data[index]]
    const g = lut[source.data[index + 1]]
    const b = lut[source.data[index + 2]]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    // Saturación moderada para conservar naturalidad (no altera legibilidad).
    const saturation = 1.12
    out.data[index] = clampByte(gray + (r - gray) * saturation)
    out.data[index + 1] = clampByte(gray + (g - gray) * saturation)
    out.data[index + 2] = clampByte(gray + (b - gray) * saturation)
    out.data[index + 3] = source.data[index + 3]
  }
  return out
}

function toGrayscale(source: RasterImage): RasterImage {
  const total = source.width * source.height
  const luminance = computeLuminance(source)
  const lut = autoLevelsLut(luminance)

  const out = createRaster(source.width, source.height)
  for (let i = 0; i < total; i++) {
    const value = lut[luminance[i]]
    const index = i * 4
    out.data[index] = value
    out.data[index + 1] = value
    out.data[index + 2] = value
    out.data[index + 3] = source.data[index + 3]
  }
  return out
}

/**
 * Binarizado con umbral adaptativo local (imagen integral) sobre la luminancia
 * autocontrastada. Ventana proporcional a la imagen y margen `C` para limpiar fondo.
 */
export function toBlackAndWhite(source: RasterImage, windowRatio = 0.09, c = 8): RasterImage {
  const { width, height } = source
  const total = width * height
  const luminance = computeLuminance(source)
  const lut = autoLevelsLut(luminance)
  const leveled = new Uint8ClampedArray(total)
  for (let i = 0; i < total; i++) leveled[i] = lut[luminance[i]]

  // Imagen integral (suma + 1 para evitar ceros).
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += leveled[y * width + x]
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum
    }
  }

  const windowSize = Math.max(15, Math.round(Math.min(width, height) * windowRatio) | 1)
  const half = Math.floor(windowSize / 2)

  const out = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(height - 1, y + half)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(width - 1, x + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0]
      const mean = sum / area
      const value = leveled[y * width + x] < mean - c ? 0 : 255
      const index = (y * width + x) * 4
      out.data[index] = value
      out.data[index + 1] = value
      out.data[index + 2] = value
      out.data[index + 3] = source.data[index + 3]
    }
  }
  return out
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}
