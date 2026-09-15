/**
 * Utilidades raster puras (sin DOM) más adaptadores de canvas.
 *
 * El pipeline de escaneo web trabaja sobre `RasterImage` (buffers RGBA) para poder
 * probarse en Node/jsdom sin canvas. Solo las operaciones de decodificación,
 * codificación y rotación visual usan `HTMLCanvasElement`.
 *
 * La Veinte Digital
 */

export interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function createRaster(width: number, height: number): RasterImage {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
}

export function cloneRaster(source: RasterImage): RasterImage {
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data),
  }
}

export function isRasterImageLike(value: unknown): value is RasterImage {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    candidate.width > 0 &&
    candidate.height > 0 &&
    candidate.data instanceof Uint8ClampedArray
  )
}

export function getPixel(raster: RasterImage, x: number, y: number): [number, number, number, number] {
  const index = (y * raster.width + x) * 4
  return [raster.data[index], raster.data[index + 1], raster.data[index + 2], raster.data[index + 3]]
}

export function setPixel(raster: RasterImage, x: number, y: number, rgba: [number, number, number, number]): void {
  const index = (y * raster.width + x) * 4
  raster.data[index] = rgba[0]
  raster.data[index + 1] = rgba[1]
  raster.data[index + 2] = rgba[2]
  raster.data[index + 3] = rgba[3]
}

/** Escala bilineal pura (sin canvas). */
export function scaleRaster(source: RasterImage, targetWidth: number, targetHeight: number): RasterImage {
  const w = Math.max(1, Math.round(targetWidth))
  const h = Math.max(1, Math.round(targetHeight))
  const out = createRaster(w, h)
  if (w === source.width && h === source.height) {
    out.data.set(source.data)
    return out
  }

  const xRatio = source.width / w
  const yRatio = source.height / h

  for (let y = 0; y < h; y++) {
    const srcY = Math.min(source.height - 1, y * yRatio)
    const y0 = Math.floor(srcY)
    const y1 = Math.min(source.height - 1, y0 + 1)
    const wy = srcY - y0

    for (let x = 0; x < w; x++) {
      const srcX = Math.min(source.width - 1, x * xRatio)
      const x0 = Math.floor(srcX)
      const x1 = Math.min(source.width - 1, x0 + 1)
      const wx = srcX - x0

      const index00 = (y0 * source.width + x0) * 4
      const index10 = (y0 * source.width + x1) * 4
      const index01 = (y1 * source.width + x0) * 4
      const index11 = (y1 * source.width + x1) * 4

      const outIndex = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = source.data[index00 + c] * (1 - wx) + source.data[index10 + c] * wx
        const bottom = source.data[index01 + c] * (1 - wx) + source.data[index11 + c] * wx
        out.data[outIndex + c] = top * (1 - wy) + bottom * wy
      }
      out.data[outIndex + 3] = 255
    }
  }
  return out
}

/** Reduce la imagen para análisis si excede `maxDimension` (sin canvas). */
export function downscaleForAnalysis(source: RasterImage, maxDimension = 1000): RasterImage {
  const longest = Math.max(source.width, source.height)
  if (longest <= maxDimension) return cloneRaster(source)
  const ratio = maxDimension / longest
  return scaleRaster(source, source.width * ratio, source.height * ratio)
}

/** Rotación en múltiplos de 90° sobre buffers (sin canvas). */
export function rotateRaster(source: RasterImage, degrees: 0 | 90 | 180 | 270): RasterImage {
  const normalized = ((degrees % 360) + 360) % 360
  if (normalized === 0) return cloneRaster(source)
  if (normalized === 180) {
    const out = createRaster(source.width, source.height)
    const total = source.width * source.height
    for (let i = 0; i < total; i++) {
      const srcIndex = i * 4
      const dstIndex = (total - 1 - i) * 4
      out.data[dstIndex] = source.data[srcIndex]
      out.data[dstIndex + 1] = source.data[srcIndex + 1]
      out.data[dstIndex + 2] = source.data[srcIndex + 2]
      out.data[dstIndex + 3] = source.data[srcIndex + 3]
    }
    return out
  }

  const out = createRaster(source.height, source.width)
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const srcIndex = (y * source.width + x) * 4
      const dstX = normalized === 90 ? source.height - 1 - y : y
      const dstY = normalized === 90 ? x : source.width - 1 - x
      const dstIndex = (dstY * out.width + dstX) * 4
      out.data[dstIndex] = source.data[srcIndex]
      out.data[dstIndex + 1] = source.data[srcIndex + 1]
      out.data[dstIndex + 2] = source.data[srcIndex + 2]
      out.data[dstIndex + 3] = source.data[srcIndex + 3]
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Adaptadores de canvas (solo navegador; los tests no los ejercitan) */
/* ------------------------------------------------------------------ */

export function rasterToImageData(raster: RasterImage): ImageData {
  return new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height)
}

export function rasterFromImageData(imageData: ImageData): RasterImage {
  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data),
  }
}

export function canvasFromRaster(raster: RasterImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = raster.width
  canvas.height = raster.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del lienzo.")
  ctx.putImageData(rasterToImageData(raster), 0, 0)
  return canvas
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("No se pudo codificar la imagen."))
      },
      "image/jpeg",
      quality
    )
  })
}

export function rasterToJpegBlob(raster: RasterImage, quality = 0.85): Promise<Blob> {
  return canvasToJpegBlob(canvasFromRaster(raster), quality)
}

/**
 * Decodifica un archivo/blob de imagen a raster. Re-encodear en canvas elimina
 * de forma natural metadatos EXIF del archivo original.
 */
export async function rasterFromBlob(blob: Blob): Promise<RasterImage> {
  const bitmap = await decodeBlobToDrawable(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del lienzo.")
  ctx.drawImage(bitmap.source, 0, 0, bitmap.width, bitmap.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return rasterFromImageData(imageData)
}

interface DrawableImage {
  source: CanvasImageSource
  width: number
  height: number
}

async function decodeBlobToDrawable(blob: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob)
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // continúa con el fallback HTMLImageElement
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("No se pudo leer la imagen."))
      img.src = url
    })
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Convierte base64 (sin prefijo) a Blob; usado por el proveedor nativo. */
export function base64ToBlob(base64: string, mimeType = "image/jpeg"): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}
