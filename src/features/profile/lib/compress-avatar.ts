/**
 * Utilidades para procesamiento y compresión de imagen de avatar en el cliente.
 * Garantiza fotos centradas (1:1), ultraligeras (~15-25 KB) y nítidas para
 * la miniatura de la topbar (32x32) y ficha de perfil (hasta 128x128).
 */

export interface CropRegion {
  sx: number
  sy: number
  sWidth: number
  sHeight: number
}

export interface CompressionResult {
  blob: Blob
  fileName: string
  mimeType: string
  dataUrl?: string
}

export const AVATAR_TARGET_SIZE = 256
export const MAX_AVATAR_INPUT_BYTES = 25 * 1024 * 1024 // 25 MB

/**
 * Calcula las coordenadas de recorte centrado 1:1 (cuadrado)
 * para cualquier imagen de dimensiones arbitrarias.
 */
export function calculateCenterCrop(width: number, height: number): CropRegion {
  if (width <= 0 || height <= 0) {
    return { sx: 0, sy: 0, sWidth: 0, sHeight: 0 }
  }

  const side = Math.min(width, height)
  const sx = Math.floor((width - side) / 2)
  const sy = Math.floor((height - side) / 2)

  return {
    sx,
    sy,
    sWidth: side,
    sHeight: side,
  }
}

/**
 * Valida si un archivo es una imagen admitida antes de procesar.
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No se seleccionó ningún archivo." }
  }

  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "El archivo seleccionado debe ser una imagen (JPG, PNG o WebP)." }
  }

  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    return { valid: false, error: "La imagen es demasiado pesada. Elige una de hasta 25 MB." }
  }

  return { valid: true }
}

/**
 * Comprime y recorta la imagen al centro usando HTML5 Canvas.
 * Genera un Blob WebP (o JPEG como fallback) de 256x256 px a ~15-25 KB.
 */
export async function compressAvatarImage(
  file: File,
  targetSize: number = AVATAR_TARGET_SIZE,
  quality: number = 0.85
): Promise<CompressionResult> {
  const validation = validateAvatarFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || "Archivo de imagen inválido")
  }

  if (typeof window === "undefined") {
    throw new Error("La compresión de imagen se ejecuta exclusivamente en el navegador.")
  }

  return new Promise<CompressionResult>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      try {
        const crop = calculateCenterCrop(img.naturalWidth || img.width, img.naturalHeight || img.height)
        if (crop.sWidth <= 0 || crop.sHeight <= 0) {
          reject(new Error("Dimensiones de imagen inválidas."))
          return
        }

        const canvas = document.createElement("canvas")
        canvas.width = targetSize
        canvas.height = targetSize

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("No se pudo inicializar el lienzo de compresión."))
          return
        }

        // Suavizado de imagen de alta calidad
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"

        // Dibujar el recorte cuadrado escalado al tamaño destino
        ctx.drawImage(
          img,
          crop.sx,
          crop.sy,
          crop.sWidth,
          crop.sHeight,
          0,
          0,
          targetSize,
          targetSize
        )

        // Generar Data URL optimizado para respaldo directo en base de datos
        let dataUrl: string | undefined
        try {
          const webpData = canvas.toDataURL("image/webp", quality)
          if (webpData.startsWith("data:image/webp")) {
            dataUrl = webpData
          } else {
            dataUrl = canvas.toDataURL("image/jpeg", quality)
          }
        } catch {
          try {
            dataUrl = canvas.toDataURL("image/jpeg", quality)
          } catch {
            // Data URL opcional
          }
        }

        // Intentar exportar a WebP
        canvas.toBlob(
          (webpBlob) => {
            if (webpBlob && webpBlob.size > 0) {
              resolve({
                blob: webpBlob,
                fileName: "avatar.webp",
                mimeType: "image/webp",
                dataUrl,
              })
              return
            }

            // Fallback a JPEG si WebP no es admitido por el motor del navegador
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob || jpegBlob.size === 0) {
                  reject(new Error("Error al procesar y comprimir la imagen."))
                  return
                }
                resolve({
                  blob: jpegBlob,
                  fileName: "avatar.jpg",
                  mimeType: "image/jpeg",
                  dataUrl,
                })
              },
              "image/jpeg",
              quality
            )
          },
          "image/webp",
          quality
        )
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error inesperado al comprimir la imagen."))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("No se pudo leer la imagen seleccionada."))
    }

    img.src = objectUrl
  })
}
