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
  const raster = await rasterFromBlob(source)
  const filtered = applyScanFilter(raster, filter)
  const rotated = rotation === 0 ? filtered : rotateRaster(filtered, rotation)

  const longest = Math.max(rotated.width, rotated.height)
  const finalRaster =
    longest > maxDimension
      ? scaleRaster(rotated, rotated.width * (maxDimension / longest), rotated.height * (maxDimension / longest))
      : rotated

  const blob = await rasterToJpegBlob(finalRaster, jpegQuality)
  return { blob, width: finalRaster.width, height: finalRaster.height }
}
