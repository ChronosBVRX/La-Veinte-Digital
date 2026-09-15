/**
 * Detección de bordes con OpenCV.js (opcional). Si algo falla, el llamador
 * conserva el detector propio en TypeScript como camino garantizado.
 *
 * La Veinte Digital
 */

import type { DetectedQuad, Point } from "../types/scanner-types"
import { isPlausibleQuad, orderCorners, quadArea } from "./geometry"
import type { OpenCvMat, OpenCvMatVector, OpenCvModule } from "./opencv-loader"
import { rasterToImageData, type RasterImage } from "./raster"

export function detectQuadWithOpenCv(
  cv: OpenCvModule,
  raster: RasterImage,
  minAreaRatio = 0.08
): DetectedQuad | null {
  let src: OpenCvMat | null = null
  let gray: OpenCvMat | null = null
  let blurred: OpenCvMat | null = null
  let edges: OpenCvMat | null = null
  let hierarchy: OpenCvMat | null = null
  let contours: OpenCvMatVector | null = null

  try {
    const sourceMat = cv.matFromImageData(rasterToImageData(raster))
    src = sourceMat
    const grayMat = new cv.Mat()
    gray = grayMat
    const blurredMat = new cv.Mat()
    blurred = blurredMat
    const edgesMat = new cv.Mat()
    edges = edgesMat
    const hierarchyMat = new cv.Mat()
    hierarchy = hierarchyMat
    const contourVector = new cv.MatVector()
    contours = contourVector

    cv.cvtColor(sourceMat, grayMat, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(grayMat, blurredMat, { width: 5, height: 5 }, 0)
    cv.Canny(blurredMat, edgesMat, 50, 150)
    cv.findContours(edgesMat, contourVector, hierarchyMat, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    const totalArea = raster.width * raster.height
    const minArea = totalArea * minAreaRatio
    let best: { quad: DetectedQuad["quad"]; score: number } | null = null

    for (let i = 0; i < contourVector.size(); i++) {
      const contour = contourVector.get(i)
      try {
        const area = Math.abs(cv.contourArea(contour))
        if (area < minArea) continue

        const perimeter = cv.arcLength(contour, true)
        const approx = new cv.Mat()
        try {
          cv.approxPolyDP(contour, approx, perimeter * 0.02, true)
          if (approx.rows !== 4) continue
          if (typeof cv.isContourConvex === "function" && !cv.isContourConvex(approx)) continue
          const points: Point[] = []
          for (let row = 0; row < 4; row++) {
            points.push({ x: approx.data32S[row * 2], y: approx.data32S[row * 2 + 1] })
          }
          const quad = orderCorners(points)
          if (!isPlausibleQuad(quad, raster.width, raster.height, minAreaRatio)) continue
          const score = quadArea(quad) / totalArea
          if (!best || score > best.score) best = { quad, score }
        } finally {
          approx.delete()
        }
      } finally {
        contour.delete()
      }
    }

    if (!best) return null
    return { quad: best.quad, confidence: Math.min(1, Math.max(0.3, best.score * 1.4)) }
  } catch {
    return null
  } finally {
    src?.delete()
    gray?.delete()
    blurred?.delete()
    edges?.delete()
    hierarchy?.delete()
    contours?.delete()
  }
}
