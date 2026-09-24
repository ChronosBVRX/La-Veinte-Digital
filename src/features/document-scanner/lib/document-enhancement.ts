/**
 * Pipeline profesional de mejora documental local (100% en dispositivo, sin IA y sin APIs externas).
 *
 * Transforma capturas fotográficas en documentos digitalizados con apariencia de escáner
 * profesional (estilo CamScanner / Microsoft Lens):
 * 1. Estimación robusta del fondo e iluminación desigual por canales RGB.
 * 2. Compensación y reducción suave de sombras (flat-field correction).
 * 3. Normalización del blanco del papel y balance de blancos local.
 * 4. Refuerzo de tinta oscura y preservación de trazos finos/firmas.
 * 5. Conservación natural de colores en sellos, firmas y gráficos.
 * 6. Nitidez suave tipo unsharp mask (filtro binomial 3x3 con zona muerta anti-ruido).
 *
 * La Veinte Digital
 */

import { cloneRaster, createRaster, type RasterImage } from "./raster"

export interface DocumentEnhanceOptions {
  /** Factor de corte del punto blanco (por defecto ~228). */
  whitePointCutoff?: number
  /** Factor de corte del punto negro (por defecto ~32). */
  blackPointCutoff?: number
  /** Intensidad de máscara de enfoque (por defecto 0.42). */
  sharpenAmount?: number
}

/**
 * Filtro principal "Documento" (enhanced):
 * - Fondo blanco y uniforme.
 * - Eliminación de sombras e iluminación irregular.
 * - Tinta oscura, legible y definida.
 * - Colores naturales (sellos y firmas preservados sin saturación excesiva).
 * - Nitidez moderada en bordes de caracteres y líneas.
 */
export function enhanceDocument(source: RasterImage, options?: DocumentEnhanceOptions): RasterImage {
  if (source.width < 2 || source.height < 2) return cloneRaster(source)

  // 1. Normalización de iluminación por canal RGB (elimina sombras y amarillamiento)
  const normalized = normalizeIllumination(source)

  // 2. Curva de tono documental (blanqueamiento suave de papel + refuerzo de tinta)
  const whiteCutoff = options?.whitePointCutoff ?? 228
  const blackCutoff = options?.blackPointCutoff ?? 32
  const lut = buildDocumentToneCurveLut(blackCutoff, whiteCutoff)

  const { width, height } = normalized
  const total = width * height
  const toned = createRaster(width, height)

  for (let i = 0; i < total; i++) {
    const idx = i * 4
    toned.data[idx] = lut[normalized.data[idx]]
    toned.data[idx + 1] = lut[normalized.data[idx + 1]]
    toned.data[idx + 2] = lut[normalized.data[idx + 2]]
    toned.data[idx + 3] = source.data[idx + 3]
  }

  // 3. Máscara de enfoque moderada para definir texto y trazos finos
  const sharpenAmount = options?.sharpenAmount ?? 0.42
  return sharpenRaster(toned, sharpenAmount)
}

/**
 * Filtro "Grises":
 * Iluminación normalizada -> conversión a luminancia -> curva de contraste local -> nitidez suave.
 * Produce apariencia de fotocopia limpia o escáner monocromático, no simple foto en blanco y negro.
 */
export function enhanceGrayscale(source: RasterImage, options?: DocumentEnhanceOptions): RasterImage {
  if (source.width < 2 || source.height < 2) {
    const out = createRaster(source.width, source.height)
    for (let i = 0; i < source.data.length; i += 4) {
      const g = Math.round(0.299 * source.data[i] + 0.587 * source.data[i + 1] + 0.114 * source.data[i + 2])
      out.data[i] = g
      out.data[i + 1] = g
      out.data[i + 2] = g
      out.data[i + 3] = source.data[i + 3]
    }
    return out
  }

  const normalized = normalizeIllumination(source)
  const { width, height } = normalized
  const total = width * height

  const whiteCutoff = options?.whitePointCutoff ?? 226
  const blackCutoff = options?.blackPointCutoff ?? 30
  const lut = buildDocumentToneCurveLut(blackCutoff, whiteCutoff)

  const grayRaster = createRaster(width, height)
  for (let i = 0; i < total; i++) {
    const idx = i * 4
    const r = normalized.data[idx]
    const g = normalized.data[idx + 1]
    const b = normalized.data[idx + 2]
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const val = lut[lum]
    grayRaster.data[idx] = val
    grayRaster.data[idx + 1] = val
    grayRaster.data[idx + 2] = val
    grayRaster.data[idx + 3] = source.data[idx + 3]
  }

  const sharpenAmount = options?.sharpenAmount ?? 0.38
  return sharpenRaster(grayRaster, sharpenAmount)
}

/**
 * Filtro "Blanco y negro":
 * 1. Normalización de iluminación previa (evita que las sombras se transformen en manchas negras).
 * 2. Umbralizado adaptativo local con protección para:
 *    - evitar huecos dentro de letras gruesas (umbral absoluto de tinta negra);
 *    - preservar firmas y trazos finos (ventana local ajustada + margen C);
 *    - mantener el fondo blanco puro (sin motas ni granulado).
 */
export function enhanceBlackAndWhite(source: RasterImage, windowRatio = 0.04, c = 10): RasterImage {
  if (source.width < 2 || source.height < 2) return cloneRaster(source)

  // 1. Iluminación normalizada previa
  const normalized = normalizeIllumination(source)
  const { width, height } = normalized
  const total = width * height

  const luminance = new Uint8ClampedArray(total)
  for (let i = 0; i < total; i++) {
    const idx = i * 4
    luminance[i] = Math.round(
      0.299 * normalized.data[idx] + 0.587 * normalized.data[idx + 1] + 0.114 * normalized.data[idx + 2]
    )
  }

  // 2. Imagen integral para cálculo rápido O(1) de medias locales
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    const rowOffset = y * width
    const intRowOffset = (y + 1) * stride
    const prevIntRowOffset = y * stride
    for (let x = 0; x < width; x++) {
      rowSum += luminance[rowOffset + x]
      integral[intRowOffset + (x + 1)] = integral[prevIntRowOffset + (x + 1)] + rowSum
    }
  }

  // Tamaño de ventana adaptativo según resolución (generalmente 25..65 px)
  const calculatedWin = Math.round(Math.min(width, height) * windowRatio) | 1
  const windowSize = Math.max(15, Math.min(65, calculatedWin))
  const half = Math.floor(windowSize / 2)

  const out = createRaster(width, height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(height - 1, y + half)
    const rowOffset = y * width
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(width - 1, x + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)

      const sum =
        integral[(y1 + 1) * stride + (x1 + 1)] -
        integral[y0 * stride + (x1 + 1)] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0]
      const mean = sum / area

      const val = luminance[rowOffset + x]
      // Protección contra huecos dentro de caracteres oscuros (val < 85 siempre tinta)
      // y preservación de firmas sutiles sobre papel claro (val < mean - c).
      const isForeground = val < 85 || (val < mean - c && val < 240)
      const byte = isForeground ? 0 : 255

      const idx = (rowOffset + x) * 4
      out.data[idx] = byte
      out.data[idx + 1] = byte
      out.data[idx + 2] = byte
      out.data[idx + 3] = source.data[idx + 3]
    }
  }

  return out
}

/**
 * Normaliza la iluminación de una imagen fotográfica mediante estimación suave del fondo.
 * `normalized_channel = (source_channel / background_channel) * 255`
 */
export function normalizeIllumination(source: RasterImage): RasterImage {
  const { width, height } = source
  const out = createRaster(width, height)

  // Estimación de cuadrícula de fondo para cada canal
  const blockSize = Math.max(4, Math.min(32, Math.floor(Math.min(width, height) / 8)))
  const gw = Math.ceil(width / blockSize)
  const gh = Math.ceil(height / blockSize)

  const gridR = new Float32Array(gw * gh)
  const gridG = new Float32Array(gw * gh)
  const gridB = new Float32Array(gw * gh)

  // Muestreo por bloques para estimar el color del papel (percentil alto por bloque)
  estimateChannelGrid(source, blockSize, gw, gh, gridR, gridG, gridB)

  // Suavizado espacial de la estimación de fondo (eliminación de artefactos de bloque)
  smoothGrid(gridR, gw, gh)
  smoothGrid(gridG, gw, gh)
  smoothGrid(gridB, gw, gh)

  // Aplicación por filas con interpolación bilineal eficiente O(width * height)
  const sliceR = new Float32Array(gw)
  const sliceG = new Float32Array(gw)
  const sliceB = new Float32Array(gw)

  for (let y = 0; y < height; y++) {
    const gy = (y + 0.5) / blockSize - 0.5
    const gy0 = Math.max(0, Math.min(gh - 1, Math.floor(gy)))
    const gy1 = Math.max(0, Math.min(gh - 1, gy0 + 1))
    const wy = Math.max(0, Math.min(1, gy - gy0))
    const wy0 = 1 - wy

    const rowOffset0 = gy0 * gw
    const rowOffset1 = gy1 * gw

    // Mezcla vertical de la fila de cuadrícula
    for (let gx = 0; gx < gw; gx++) {
      sliceR[gx] = gridR[rowOffset0 + gx] * wy0 + gridR[rowOffset1 + gx] * wy
      sliceG[gx] = gridG[rowOffset0 + gx] * wy0 + gridG[rowOffset1 + gx] * wy
      sliceB[gx] = gridB[rowOffset0 + gx] * wy0 + gridB[rowOffset1 + gx] * wy
    }

    const rowOffsetPixel = y * width * 4
    for (let x = 0; x < width; x++) {
      const gx = (x + 0.5) / blockSize - 0.5
      const gx0 = Math.max(0, Math.min(gw - 1, Math.floor(gx)))
      const gx1 = Math.max(0, Math.min(gw - 1, gx0 + 1))
      const wx = Math.max(0, Math.min(1, gx - gx0))
      const wx0 = 1 - wx

      const bgR = Math.max(35, sliceR[gx0] * wx0 + sliceR[gx1] * wx)
      const bgG = Math.max(35, sliceG[gx0] * wx0 + sliceG[gx1] * wx)
      const bgB = Math.max(35, sliceB[gx0] * wx0 + sliceB[gx1] * wx)

      const pixelIdx = rowOffsetPixel + x * 4
      const srcR = source.data[pixelIdx]
      const srcG = source.data[pixelIdx + 1]
      const srcB = source.data[pixelIdx + 2]

      out.data[pixelIdx] = Math.min(255, Math.max(0, Math.round((srcR / bgR) * 255)))
      out.data[pixelIdx + 1] = Math.min(255, Math.max(0, Math.round((srcG / bgG) * 255)))
      out.data[pixelIdx + 2] = Math.min(255, Math.max(0, Math.round((srcB / bgB) * 255)))
      out.data[pixelIdx + 3] = source.data[pixelIdx + 3]
    }
  }

  return out
}

/**
 * Estima el valor del fondo (papel) en cada bloque calculando el percentil ~88
 * de cada canal. En un documento, el texto cubre ~10-25% del área, por lo que
 * el percentil 88 representa fielmente la superficie del papel, ignorando el texto.
 */
function estimateChannelGrid(
  source: RasterImage,
  blockSize: number,
  gw: number,
  gh: number,
  gridR: Float32Array,
  gridG: Float32Array,
  gridB: Float32Array
): void {
  const { width, height } = source
  const histR = new Uint16Array(256)
  const histG = new Uint16Array(256)
  const histB = new Uint16Array(256)

  // Referencia global aproximada para evitar amplificar áreas 100% negras
  let globalLumaSum = 0
  let sampleCount = 0
  const globalStep = Math.max(1, Math.floor(Math.min(width, height) / 30))
  for (let y = 0; y < height; y += globalStep) {
    for (let x = 0; x < width; x += globalStep) {
      const idx = (y * width + x) * 4
      globalLumaSum += 0.299 * source.data[idx] + 0.587 * source.data[idx + 1] + 0.114 * source.data[idx + 2]
      sampleCount++
    }
  }
  const avgGlobalLuma = sampleCount > 0 ? globalLumaSum / sampleCount : 180
  const minFloor = Math.max(45, Math.round(avgGlobalLuma * 0.4))

  const step = blockSize >= 16 ? 2 : 1

  for (let gy = 0; gy < gh; gy++) {
    const y0 = gy * blockSize
    const y1 = Math.min(height, (gy + 1) * blockSize)

    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * blockSize
      const x1 = Math.min(width, (gx + 1) * blockSize)

      histR.fill(0)
      histG.fill(0)
      histB.fill(0)
      let count = 0

      for (let y = y0; y < y1; y += step) {
        const rowOffset = y * width * 4
        for (let x = x0; x < x1; x += step) {
          const idx = rowOffset + x * 4
          histR[source.data[idx]]++
          histG[source.data[idx + 1]]++
          histB[source.data[idx + 2]]++
          count++
        }
      }

      const target = Math.max(1, Math.round(count * 0.88))
      const cellIdx = gy * gw + gx

      gridR[cellIdx] = Math.max(minFloor, getPercentileFromHistogram(histR, target))
      gridG[cellIdx] = Math.max(minFloor, getPercentileFromHistogram(histG, target))
      gridB[cellIdx] = Math.max(minFloor, getPercentileFromHistogram(histB, target))
    }
  }
}

function getPercentileFromHistogram(hist: Uint16Array, target: number): number {
  let accum = 0
  for (let i = 0; i < 256; i++) {
    accum += hist[i]
    if (accum >= target) return i
  }
  return 255
}

/**
 * Suaviza la cuadrícula de fondo usando 2 pasadas de filtro separable 1D con replicación
 * en los extremos. Equivale a un blur gaussiano de radio amplio a resolución completa.
 */
function smoothGrid(grid: Float32Array, gw: number, gh: number): void {
  if (gw <= 1 && gh <= 1) return
  const temp = new Float32Array(gw * gh)

  // 2 pasadas para aproximar una respuesta gaussiana suave
  for (let pass = 0; pass < 2; pass++) {
    // Paso horizontal
    for (let y = 0; y < gh; y++) {
      const rowOffset = y * gw
      for (let x = 0; x < gw; x++) {
        const xPrev = Math.max(0, x - 1)
        const xNext = Math.min(gw - 1, x + 1)
        temp[rowOffset + x] =
          grid[rowOffset + xPrev] * 0.25 + grid[rowOffset + x] * 0.5 + grid[rowOffset + xNext] * 0.25
      }
    }

    // Paso vertical
    for (let x = 0; x < gw; x++) {
      for (let y = 0; y < gh; y++) {
        const yPrev = Math.max(0, y - 1)
        const yNext = Math.min(gh - 1, y + 1)
        grid[y * gw + x] =
          temp[yPrev * gw + x] * 0.25 + temp[y * gw + x] * 0.5 + temp[yNext * gw + x] * 0.25
      }
    }
  }
}

/**
 * Construye una tabla de correspondencia (LUT 0..255) mediante una curva sigmoide suave
 * (Hermite smoothstep + leve gamma) que blanquea el papel y profundiza los negros.
 */
export function buildDocumentToneCurveLut(blackCutoff: number, whiteCutoff: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  const range = Math.max(1, whiteCutoff - blackCutoff)

  for (let i = 0; i < 256; i++) {
    if (i <= blackCutoff) {
      lut[i] = 0
    } else if (i >= whiteCutoff) {
      lut[i] = 255
    } else {
      const t = (i - blackCutoff) / range
      // Smoothstep 3*t^2 - 2*t^3
      const smooth = t * t * (3 - 2 * t)
      // Ligero gamma para reforzar la tinta oscura en letras y firmas
      const shaped = Math.pow(smooth, 1.15)
      lut[i] = Math.round(Math.min(255, Math.max(0, shaped * 255)))
    }
  }
  return lut
}

/**
 * Máscara de enfoque (unsharp mask) 3x3 binomial para definir bordes y trazos finos.
 * Incorpora zona muerta (coring) para no amplificar el ruido en zonas planas de papel.
 */
export function sharpenRaster(source: RasterImage, amount = 0.42): RasterImage {
  const { width, height } = source
  if (width < 3 || height < 3 || amount <= 0) return cloneRaster(source)

  const out = createRaster(width, height)
  // Copia bordes
  out.data.set(source.data)

  for (let y = 1; y < height - 1; y++) {
    const rowPrev = (y - 1) * width * 4
    const rowCurr = y * width * 4
    const rowNext = (y + 1) * width * 4

    for (let x = 1; x < width - 1; x++) {
      const currIdx = rowCurr + x * 4
      const xPrev = (x - 1) * 4
      const xNext = (x + 1) * 4

      for (let c = 0; c < 3; c++) {
        const c00 = source.data[rowPrev + xPrev + c]
        const c01 = source.data[rowPrev + x * 4 + c]
        const c02 = source.data[rowPrev + xNext + c]

        const c10 = source.data[rowCurr + xPrev + c]
        const c11 = source.data[currIdx + c]
        const c12 = source.data[rowCurr + xNext + c]

        const c20 = source.data[rowNext + xPrev + c]
        const c21 = source.data[rowNext + x * 4 + c]
        const c22 = source.data[rowNext + xNext + c]

        // Kernel binomial [1 2 1; 2 4 2; 1 2 1] / 16
        const blurred =
          (c00 + c02 + c20 + c22 + (c01 + c10 + c12 + c21) * 2 + c11 * 4) / 16

        const diff = c11 - blurred
        // Zona muerta (coring): no amplifica ruido sutil (|diff| < 3)
        if (Math.abs(diff) >= 3) {
          out.data[currIdx + c] = Math.min(255, Math.max(0, Math.round(c11 + diff * amount)))
        } else {
          out.data[currIdx + c] = c11
        }
      }
      out.data[currIdx + 3] = source.data[currIdx + 3]
    }
  }

  return out
}

/**
 * Mejora conservadora para identificaciones (INE/credenciales):
 * - NO normaliza fondo a blanco (no altera el plástico ni las tramas guilloché).
 * - NO aplica white cut ni estira luces a 255 (conserva el valor absoluto del fondo).
 * - NO binariza ni elimina gradaciones tonales.
 * - Leve refuerzo de vivacidad de color (saturación sutil 1.05) y nitidez moderada
 *   para definir microtexto y firmas sin amplificar grano ni quemar fotografía.
 */
export function enhanceIdentification(source: RasterImage): RasterImage {
  const { width, height } = source
  if (width < 2 || height < 2) return cloneRaster(source)

  const total = width * height
  const out = createRaster(width, height)

  for (let i = 0; i < total; i++) {
    const idx = i * 4
    const r = source.data[idx]
    const g = source.data[idx + 1]
    const b = source.data[idx + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b

    // Saturación conservadora (1.05) para realzar tintas y tonos de piel sin distorsión
    const sat = 1.05
    out.data[idx] = Math.min(255, Math.max(0, Math.round(gray + (r - gray) * sat)))
    out.data[idx + 1] = Math.min(255, Math.max(0, Math.round(gray + (g - gray) * sat)))
    out.data[idx + 2] = Math.min(255, Math.max(0, Math.round(gray + (b - gray) * sat)))
    out.data[idx + 3] = source.data[idx + 3]
  }

  // Nitidez muy suave (0.22) con zona muerta para no acentuar el grano del plástico
  return sharpenRaster(out, 0.22)
}
