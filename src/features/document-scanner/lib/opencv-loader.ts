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

const LOCAL_SOURCES = ["/vendor/opencv/opencv.js", "/vendor/opencv.js"]
const LOAD_TIMEOUT_MS = 12_000

let cached: Promise<OpenCvModule | null> | null = null

export function loadOpenCv(): Promise<OpenCvModule | null> {
  if (!cached) {
    cached = loadFromLocalSources()
  }
  return cached
}

/** Solo para pruebas: permite limpiar el caché entre escenarios. */
export function resetOpenCvCacheForTests(): void {
  cached = null
}

async function loadFromLocalSources(): Promise<OpenCvModule | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null
  for (const source of LOCAL_SOURCES) {
    const loaded = await tryLoadScript(source)
    if (loaded) return loaded
  }
  return null
}

async function tryLoadScript(source: string): Promise<OpenCvModule | null> {
  try {
    const loaded = await new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-opencv-src="${source}"]`)
      if (existing) {
        resolve(existing.dataset.loaded === "true")
        return
      }
      const script = document.createElement("script")
      script.src = source
      script.async = true
      script.dataset.opencvSrc = source
      script.onload = () => {
        script.dataset.loaded = "true"
        resolve(true)
      }
      script.onerror = () => resolve(false)
      document.head.appendChild(script)
      window.setTimeout(() => resolve(script.dataset.loaded === "true"), LOAD_TIMEOUT_MS)
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
