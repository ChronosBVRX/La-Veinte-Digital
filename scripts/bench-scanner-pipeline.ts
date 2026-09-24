/**
 * Benchmark de desarrollo para medir rendimiento y memoria real del pipeline
 * de mejora documental a distintas resoluciones.
 *
 * Ejecutar con: npx tsx scripts/bench-scanner-pipeline.ts
 */

import {
  enhanceDocument,
  enhanceGrayscale,
  enhanceBlackAndWhite,
} from "../src/features/document-scanner/lib/document-enhancement"
import {
  createRaster,
  scaleRaster,
  setPixel,
  type RasterImage,
} from "../src/features/document-scanner/lib/raster"

function createBenchmarkDocument(width: number, height: number): RasterImage {
  const raster = createRaster(width, height)
  // Fondo con gradiente de iluminación (sombra lateral: de 235 a 140)
  for (let y = 0; y < height; y++) {
    const rowProgress = y / height
    for (let x = 0; x < width; x++) {
      const colProgress = x / width
      const bg = Math.round(235 - colProgress * 75 - rowProgress * 20)
      setPixel(raster, x, y, [bg, bg, bg, 255])
    }
  }

  // Líneas de texto simuladas cada 30 píxeles
  const lineSpacing = Math.max(16, Math.round(height / 40))
  for (let y = lineSpacing * 2; y < height - lineSpacing * 2; y += lineSpacing) {
    for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x++) {
      // Simular caracteres con espacios
      if ((x % 14) > 3) {
        setPixel(raster, x, y, [30, 30, 30, 255])
        if (y + 1 < height) setPixel(raster, x, y + 1, [35, 35, 35, 255])
      }
    }
  }

  // Sello azul en un cuadrante
  const sealX0 = Math.round(width * 0.65)
  const sealY0 = Math.round(height * 0.65)
  const sealRadius = Math.round(Math.min(width, height) * 0.08)
  for (let dy = -sealRadius; dy <= sealRadius; dy++) {
    for (let dx = -sealRadius; dx <= sealRadius; dx++) {
      if (dx * dx + dy * dy <= sealRadius * sealRadius) {
        const px = sealX0 + dx
        const py = sealY0 + dy
        if (px >= 0 && px < width && py >= 0 && py < height) {
          setPixel(raster, px, py, [50, 90, 210, 255])
        }
      }
    }
  }

  return raster
}

function estimateRasterMemoryBytes(width: number, height: number): number {
  return width * height * 4
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function runBenchmark() {
  const resolutions = [
    { label: "1600×1200", w: 1600, h: 1200 },
    { label: "2400×1800", w: 2400, h: 1800 },
    { label: "4032×3024", w: 4032, h: 3024 },
  ]

  console.log("=========================================================================================")
  console.log("  BENCHMARK: Pipeline de Mejora Documental Local (La Veinte Digital)")
  console.log("=========================================================================================\n")

  // Calentamiento JIT
  const warmup = createBenchmarkDocument(400, 300)
  enhanceDocument(warmup)
  enhanceGrayscale(warmup)
  enhanceBlackAndWhite(warmup)

  for (const res of resolutions) {
    console.log(`--- Resolución: ${res.label} (${(res.w * res.h / 1e6).toFixed(2)} MP) ---`)
    const rawRaster = createBenchmarkDocument(res.w, res.h)
    const rawMem = estimateRasterMemoryBytes(res.w, res.h)

    // 1. MEDICIÓN A RESOLUCIÓN COMPLETA (sin pre-escalar)
    console.log(`  [Modo 1: Full Resolution (${res.w}×${res.h})]`)
    console.log(`  Buffer base RGBA: ${formatBytes(rawMem)}`)

    // Documento
    const t0Doc = performance.now()
    const _docFull = enhanceDocument(rawRaster)
    const tDocFull = performance.now() - t0Doc

    // Grises
    const t0Gray = performance.now()
    const _grayFull = enhanceGrayscale(rawRaster)
    const tGrayFull = performance.now() - t0Gray

    // Blanco y negro
    const t0Bw = performance.now()
    const _bwFull = enhanceBlackAndWhite(rawRaster)
    const tBwFull = performance.now() - t0Bw

    // Pico estimado: input + normalized + output + buffers internos
    const peakMemFull = rawMem * 3 + (res.w * res.h * 8) // integral image para bw
    console.log(`  -> Documento:      ${tDocFull.toFixed(1)} ms`)
    console.log(`  -> Grises:         ${tGrayFull.toFixed(1)} ms`)
    console.log(`  -> Blanco y negro: ${tBwFull.toFixed(1)} ms`)
    console.log(`  -> Pico estimado:  ~${formatBytes(peakMemFull)}`)

    // 2. MEDICIÓN CON PRE-ESCALADO CONSERVADOR A <= 2400 MAX DIMENSION
    const longest = Math.max(res.w, res.h)
    const maxDim = 2400
    if (longest > maxDim) {
      const scale = maxDim / longest
      const targetW = Math.round(res.w * scale)
      const targetH = Math.round(res.h * scale)
      console.log(`\n  [Modo 2: Pre-scale conservador a <= ${maxDim}px (${targetW}×${targetH} = ${(targetW * targetH / 1e6).toFixed(2)} MP)]`)

      const t0Scale = performance.now()
      const workingRaster = scaleRaster(rawRaster, targetW, targetH)
      const tScale = performance.now() - t0Scale
      const workingMem = estimateRasterMemoryBytes(targetW, targetH)

      const t0DocScale = performance.now()
      enhanceDocument(workingRaster)
      const tDocScale = performance.now() - t0DocScale + tScale

      const t0GrayScale = performance.now()
      enhanceGrayscale(workingRaster)
      const tGrayScale = performance.now() - t0GrayScale + tScale

      const t0BwScale = performance.now()
      enhanceBlackAndWhite(workingRaster)
      const tBwScale = performance.now() - t0BwScale + tScale

      const peakMemScale = rawMem + workingMem * 3 + (targetW * targetH * 8)
      console.log(`  -> Pre-scale time: ${tScale.toFixed(1)} ms`)
      console.log(`  -> Documento:      ${tDocScale.toFixed(1)} ms (ahorro: -${(100 - (tDocScale / tDocFull) * 100).toFixed(0)}%)`)
      console.log(`  -> Grises:         ${tGrayScale.toFixed(1)} ms (ahorro: -${(100 - (tGrayScale / tGrayFull) * 100).toFixed(0)}%)`)
      console.log(`  -> Blanco y negro: ${tBwScale.toFixed(1)} ms (ahorro: -${(100 - (tBwScale / tBwFull) * 100).toFixed(0)}%)`)
      console.log(`  -> Pico estimado:  ~${formatBytes(peakMemScale)} (ahorro mem: -${(100 - (peakMemScale / peakMemFull) * 100).toFixed(0)}%)`)
    } else {
      console.log(`  (Resolución ya es <= 2400px; no requiere pre-escalado)`)
    }

    console.log("")
  }
}

runBenchmark()
