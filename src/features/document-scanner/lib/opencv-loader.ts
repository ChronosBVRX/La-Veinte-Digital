/**
 * Carga opcional de OpenCV.js para la detección de bordes en web.
 *
 * Decisión de arquitectura:
 * - El escáner web funciona SIEMPRE con el detector propio en TypeScript
 *   (`quad-detection.ts`), que no añade dependencias ni descargas.
 * - Si el entorno sirve OpenCV.js localmente (`public/vendor/opencv/opencv.js`,
 *   generado por `scripts/copy-vendor.mjs`), se usa como detector preferente.
 * - Nunca se carga desde CDNs de terceros: los documentos no salen del dispositivo.
 *
 * La Veinte Digital
 */

export interface OpenCvMat {
  rows: number
  cols: number
  data32S: Int32Array
  delete(): void
}

export interface OpenCvMatVector {
  size(): number
  get(index: number): OpenCvMat
  delete(): void
}

export interface OpenCvModule {
  Mat: new () => OpenCvMat
  MatVector: new () => OpenCvMatVector
  matFromImageData(data: ImageData): OpenCvMat
  matFromArray(rows: number, cols: number, type: number, array: number[]): OpenCvMat
  cvtColor(src: OpenCvMat, dst: OpenCvMat, code: number): void
  GaussianBlur(src: OpenCvMat, dst: OpenCvMat, ksize: { width: number; height: number }, sigmaX: number): void
  Canny(src: OpenCvMat, dst: OpenCvMat, threshold1: number, threshold2: number): void
  findContours(src: OpenCvMat, contours: OpenCvMatVector, hierarchy: OpenCvMat, mode: number, method: number): void
  contourArea(contour: OpenCvMat): number
  approxPolyDP(curve: OpenCvMat, approx: OpenCvMat, epsilon: number, closed: boolean): void
  arcLength(curve: OpenCvMat, closed: boolean): number
  isContourConvex(contour: OpenCvMat): boolean
  CV_8UC1: number
  CV_8UC3: number
  CV_32FC2: number
  COLOR_RGBA2GRAY: number
  RETR_LIST: number
  CHAIN_APPROX_SIMPLE: number
}

export interface LoadOpenCvOptions {
  /**
   * Si es true, permite invalidar un fallo previo y reintentar la carga UNA única vez.
   * Si ya se intentó un reintento (exitoso o fallido), se mantiene el resultado sin bucles.
   */
  retry?: boolean
}

const LOCAL_SOURCES = ["/vendor/opencv/opencv.js", "/vendor/opencv.js"]
const LOAD_TIMEOUT_MS = 12_000

let cached: Promise<OpenCvModule | null> | null = null
let hasFailedOnce = false
let retryAttempted = false

export function loadOpenCv(options?: LoadOpenCvOptions): Promise<OpenCvModule | null> {
  const isRetry = Boolean(options?.retry)

  // Si ya tenemos una promesa en curso o resuelta y no se solicitó reintento:
  if (cached && !isRetry) {
    return cached
  }

  // Si se solicita reintento:
  if (isRetry) {
    // Si ya se agotó el único reintento permitido, devolver el estado actual
    if (retryAttempted) {
      return cached ?? Promise.resolve(null)
    }
    // Si ya está disponible globalmente y usable, reutilizarlo
    const existingGlobal = openCvGlobal()
    if (existingGlobal && isUsableOpenCv(existingGlobal)) {
      return Promise.resolve(existingGlobal)
    }

    retryAttempted = true
    cached = null // Limpiar el fallo previo para permitir la segunda y última carga
  }

  if (!cached) {
    cached = loadFromLocalSources(isRetry)
      .then((cv) => {
        if (!cv) {
          hasFailedOnce = true
        }
        return cv
      })
      .catch(() => {
        hasFailedOnce = true
        return null
      })
  }

  return cached
}

/** Ejecuta un único reintento controlado de carga de OpenCV si falló previamente. */
export function retryOpenCv(): Promise<OpenCvModule | null> {
  return loadOpenCv({ retry: true })
}

/** Indica si la carga falló al menos una vez y OpenCV no está disponible. */
export function hasOpenCvFailed(): boolean {
  return hasFailedOnce && !isOpenCvLoaded()
}

/** Indica si se puede realizar el reintento (falló previamente y aún no se ha intentado el reintento). */
export function canRetryOpenCv(): boolean {
  return hasFailedOnce && !retryAttempted && !isOpenCvLoaded()
}

export function isOpenCvLoaded(): boolean {
  const cv = openCvGlobal()
  return Boolean(cv && isUsableOpenCv(cv))
}

/** Solo para pruebas: permite limpiar el caché entre escenarios. */
export function resetOpenCvCacheForTests(): void {
  cached = null
  hasFailedOnce = false
  retryAttempted = false
}

async function loadFromLocalSources(isRetry = false): Promise<OpenCvModule | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null
  for (const source of LOCAL_SOURCES) {
    const loaded = await tryLoadScript(source, isRetry)
    if (loaded) return loaded
  }
  return null
}

async function tryLoadScript(source: string, isRetry = false): Promise<OpenCvModule | null> {
  try {
    const loaded = await new Promise<boolean>((resolve) => {
      let existing = document.querySelector<HTMLScriptElement>(`script[data-opencv-src="${source}"]`)
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve(true)
          return
        }
        // Si estamos en reintento y el script previo falló o no cargó, removerlo
        // para no duplicar tags en el DOM y permitir un nuevo intento limpio.
        if (isRetry && existing.dataset.failed === "true") {
          existing.remove()
          existing = null
        } else {
          resolve(existing.dataset.loaded === "true")
          return
        }
      }
      const script = document.createElement("script")
      script.src = source
      script.async = true
      script.dataset.opencvSrc = source
      script.onload = () => {
        script.dataset.loaded = "true"
        resolve(true)
      }
      script.onerror = () => {
        script.dataset.failed = "true"
        resolve(false)
      }
      document.head.appendChild(script)
      window.setTimeout(() => {
        if (script.dataset.loaded !== "true") {
          script.dataset.failed = "true"
        }
        resolve(script.dataset.loaded === "true")
      }, LOAD_TIMEOUT_MS)
    })
    if (!loaded) return null

    const cv = await waitForRuntime()
    if (!cv) return null
    return isUsableOpenCv(cv) ? cv : null
  } catch {
    return null
  }
}

function openCvGlobal(): unknown {
  return (window as unknown as { cv?: unknown }).cv
}

async function waitForRuntime(): Promise<OpenCvModule | null> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    const cv = openCvGlobal()
    if (cv) {
      if (isUsableOpenCv(cv)) return cv
      if (typeof (cv as { then?: unknown }).then === "function") {
        try {
          const resolved = await (cv as Promise<unknown>)
          if (isUsableOpenCv(resolved)) return resolved
        } catch {
          return null
        }
      } else if (typeof (cv as { onRuntimeInitialized?: unknown }).onRuntimeInitialized === "function") {
        await new Promise<void>((resolve) => {
          ;(cv as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve()
          window.setTimeout(resolve, 2000)
        })
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120))
  }
  return null
}

function isUsableOpenCv(value: unknown): value is OpenCvModule {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.matFromImageData === "function" &&
    typeof candidate.findContours === "function" &&
    typeof candidate.approxPolyDP === "function" &&
    typeof candidate.Canny === "function"
  )
}
