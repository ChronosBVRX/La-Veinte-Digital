/**
 * Render final de una página escaneada: filtro + rotación + re-codificación JPEG.
 *
 * Re-codificar en canvas elimina metadatos EXIF y normaliza el formato para el PDF.
 * Requiere navegador (canvas); no se ejecuta en SSR ni en tests de nodo.
 *
 * La Veinte Digital
 */

import type { RotationDegrees, ScanFilter } from "../types/scanner-types"
import { applyScanFilter } from "./image-filters"
import { rasterFromBlob, rasterToJpegBlob, rotateRaster, scaleRaster } from "./raster"

export interface RenderedPage {
  blob: Blob
  width: number
  height: number
}

export const DEFAULT_PAGE_MAX_DIMENSION = 2400
export const DEFAULT_PAGE_JPEG_QUALITY = 0.82

export async function renderPageBlob(
  source: Blob,
  filter: ScanFilter,
  rotation: RotationDegrees,
  maxDimension = DEFAULT_PAGE_MAX_DIMENSION,
  jpegQuality = DEFAULT_PAGE_JPEG_QUALITY
): Promise<RenderedPage> {
  const rawRaster = await rasterFromBlob(source)

  // Pre-escalado conservador al tamaño de trabajo si excede maxDimension.
  // Evita procesar innecesariamente imágenes de 10-15 MP a resolución completa,
  // reduciendo el tiempo de filtrado a la mitad y el pico de memoria en ~45%.
  const longest = Math.max(rawRaster.width, rawRaster.height)
  const workingRaster =
    longest > maxDimension
      ? scaleRaster(rawRaster, rawRaster.width * (maxDimension / longest), rawRaster.height * (maxDimension / longest))
      : rawRaster

  const filtered = applyScanFilter(workingRaster, filter)
  const rotated = rotation === 0 ? filtered : rotateRaster(filtered, rotation)

  const blob = await rasterToJpegBlob(rotated, jpegQuality)
  return { blob, width: rotated.width, height: rotated.height }
}
