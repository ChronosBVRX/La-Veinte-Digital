/**
 * Proveedor web del escáner: captura, detección, corrección de perspectiva y filtros
 * ejecutados 100% en el dispositivo (canvas + buffers propios; OpenCV.js opcional).
 *
 * Este proveedor se usa cuando `window.LaVeinteApp.scanDocument` no existe
 * (navegador de escritorio, APK antigua o Play services no disponibles).
 *
 * La Veinte Digital
 */

import type { DetectedQuad, Quad, ScanFilter } from "../types/scanner-types"
import { applyScanFilter } from "../lib/image-filters"
import { detectDocumentQuad } from "../lib/quad-detection"
import { detectQuadWithOpenCv } from "../lib/opencv-detector"
import { loadOpenCv } from "../lib/opencv-loader"
import {
  downscaleForAnalysis,
  rasterFromBlob,
  rasterToJpegBlob,
  type RasterImage,
} from "../lib/raster"
import { scaleQuad, warpPerspectiveRaster } from "../lib/warp"

export interface AnalysisImage {
  raster: RasterImage
  /** Factor para convertir coordenadas de análisis a coordenadas de la imagen completa. */
  scaleToSource: number
}

export interface ProcessedPage {
  blob: Blob
  width: number
  height: number
}

export interface ProcessPageParams {
  source: Blob
  /** Esquinas en coordenadas de la imagen completa. */
  corners: Quad
  filter: ScanFilter
  /** Lado máximo del resultado (200-240 DPI equivalentes). */
  maxDimension?: number
  jpegQuality?: number
}

export const DEFAULT_PROCESS_MAX_DIMENSION = 2200
export const DEFAULT_JPEG_QUALITY = 0.82
export const DEFAULT_ANALYSIS_DIMENSION = 900

export class WebDocumentScanner {
  readonly engine = "web" as const

  /** Decodifica el archivo a un raster reducido para análisis y previsualización. */
  async createAnalysis(blob: Blob, maxDimension = DEFAULT_ANALYSIS_DIMENSION): Promise<AnalysisImage> {
    const full = await rasterFromBlob(blob)
    const analysis = downscaleForAnalysis(full, maxDimension)
    const scaleToSource = analysis.width > 0 ? full.width / analysis.width : 1
    return { raster: analysis, scaleToSource }
  }

  /**
   * Detección automática de bordes: OpenCV.js si está disponible localmente,
   * y siempre como respaldo el detector propio (sin dependencias).
   */
  async detectCorners(raster: RasterImage, options?: { retryOpenCv?: boolean }): Promise<DetectedQuad | null> {
    try {
      const cv = await loadOpenCv({ retry: options?.retryOpenCv })
      if (cv) {
        const detected = detectQuadWithOpenCv(cv, raster)
        if (detected) return detected
      }
    } catch {
      // OpenCV es una mejora opcional: se ignora cualquier fallo.
    }
    return detectDocumentQuad(raster)
  }

  /** Aplica esquinas + filtro y devuelve el JPEG final listo para el PDF. */
  async processPage(params: ProcessPageParams): Promise<ProcessedPage> {
    const maxDimension = params.maxDimension ?? DEFAULT_PROCESS_MAX_DIMENSION
    const full = await rasterFromBlob(params.source)

    const corners = clampQuadToImage(params.corners, full)
    const warped = warpPerspectiveRaster(full, corners, { maxDimension })
    if (!warped) {
      throw new Error("No se pudo enderezar el documento con las esquinas seleccionadas.")
    }

    const filtered = applyScanFilter(warped, params.filter)
    const blob = await rasterToJpegBlob(filtered, params.jpegQuality ?? DEFAULT_JPEG_QUALITY)
    return { blob, width: filtered.width, height: filtered.height }
  }

  /**
   * Endereza sin filtro: produce la imagen fuente de la página.
   * Los filtros se aplican después con `renderPageBlob` (una sola ruta de render).
   */
  async extractSource(params: {
    source: Blob
    corners: Quad
    maxDimension?: number
    jpegQuality?: number
  }): Promise<ProcessedPage> {
    const maxDimension = params.maxDimension ?? DEFAULT_PROCESS_MAX_DIMENSION
    const full = await rasterFromBlob(params.source)
    const corners = clampQuadToImage(params.corners, full)
    const warped = warpPerspectiveRaster(full, corners, { maxDimension })
    if (!warped) {
      throw new Error("No se pudo enderezar el documento con las esquinas seleccionadas.")
    }
    const blob = await rasterToJpegBlob(warped, params.jpegQuality ?? DEFAULT_JPEG_QUALITY)
    return { blob, width: warped.width, height: warped.height }
  }

  /** Versión sin canvas del paso de procesamiento (para pruebas unitarias). */
  processRaster(raster: RasterImage, corners: Quad, filter: ScanFilter, maxDimension = DEFAULT_PROCESS_MAX_DIMENSION): RasterImage | null {
    const clamped = clampQuadToImage(corners, raster)
    const warped = warpPerspectiveRaster(raster, clamped, { maxDimension })
    if (!warped) return null
    return applyScanFilter(warped, filter)
  }
}

/** Escala esquinas de análisis a coordenadas de origen. */
export function toSourceQuad(quad: Quad, analysis: AnalysisImage): Quad {
  return scaleQuad(quad, analysis.scaleToSource)
}

function clampQuadToImage(quad: Quad, raster: RasterImage): Quad {
  const maxX = raster.width - 1
  const maxY = raster.height - 1
  return quad.map((p) => ({
    x: Math.min(Math.max(p.x, 0), maxX),
    y: Math.min(Math.max(p.y, 0), maxY),
  })) as Quad
}

