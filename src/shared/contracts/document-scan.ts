/**
 * Contrato compartido del módulo de digitalización de documentos (Document Scanner).
 *
 * Es la frontera entre:
 * - La UI del scanner (`src/features/document-scanner/`).
 * - La persistencia local (IndexedDB web / Room + filesDir nativo).
 * - El puente nativo Android (`window.LaVeinteApp.scanDocument`).
 * - Documentos personales (clasificación explícita por `source`, nunca por nombre de archivo).
 *
 * Reglas del dominio:
 * - La captura y el procesamiento son 100% locales. Ningún archivo escaneado se sube a un API.
 * - La clasificación de un documento usa `source` explícito (DOCUMENT_SCAN / INE_SCAN).
 * - El modo INE genera SIEMPRE una sola página (frente + reverso) y no extrae datos personales.
 *
 * La Veinte Digital
 */

export const SCAN_MODES = ["document", "ine-front", "ine-back"] as const
export type ScanMode = (typeof SCAN_MODES)[number]

export const SCAN_FILTERS = ["original", "enhanced", "grayscale", "bw"] as const
export type ScanFilter = (typeof SCAN_FILTERS)[number]

export const SCAN_DOCUMENT_KINDS = ["documento", "ine"] as const
export type ScanDocumentKind = (typeof SCAN_DOCUMENT_KINDS)[number]

/** Fuente de persistencia para documentos escaneados generales. */
export const SCAN_SOURCE_DOCUMENT = "DOCUMENT_SCAN"
/** Fuente de persistencia para INE (frente + reverso en una hoja). */
export const SCAN_SOURCE_INE = "INE_SCAN"

/** Identificador de origen del escaneo (para métricas locales y depuración). */
export const SCAN_ENGINES = ["mlkit", "web"] as const
export type ScanEngine = (typeof SCAN_ENGINES)[number]

export const SCAN_MAX_PAGES = 30
export const SCAN_DEFAULT_PAGE_LIMIT = 10
export const INE_REQUIRED_PAGES = 2

export interface ScanOptions {
  mode: ScanMode
  allowGallery: boolean
  pageLimit: number
  /** Filtro sugerido al abrir la revisión (el usuario puede cambiarlo). */
  filter?: ScanFilter
}

export type NativeScanFailureReason =
  | "unsupported"
  | "play_services_unavailable"
  | "cancelled"
  | "permission_denied"
  | "busy"
  | "too_large"
  | "invalid_options"
  | "failed"

export interface ScannedPagePayload {
  /** Base64 sin prefijo data URL. */
  base64: string
  mimeType: string
  width: number
  height: number
  rotationDegrees?: number
}

export interface NativeScanResponse {
  ok: boolean
  reason?: NativeScanFailureReason
  engine?: ScanEngine
  pages?: ScannedPagePayload[]
}

export function isScanMode(value: unknown): value is ScanMode {
  return typeof value === "string" && (SCAN_MODES as readonly string[]).includes(value)
}

export function isScanFilter(value: unknown): value is ScanFilter {
  return typeof value === "string" && (SCAN_FILTERS as readonly string[]).includes(value)
}

export function isScanDocumentKind(value: unknown): value is ScanDocumentKind {
  return typeof value === "string" && (SCAN_DOCUMENT_KINDS as readonly string[]).includes(value)
}

/**
 * Fuente de persistencia explícita para una clase de documento escaneado.
 * El mapeo inverso vive en `scanKindForSource` y es la ÚNICA forma válida de clasificar.
 */
export function scanSourceForKind(kind: ScanDocumentKind): string {
  return kind === "ine" ? SCAN_SOURCE_INE : SCAN_SOURCE_DOCUMENT
}

export function scanKindForSource(source: string | null | undefined): ScanDocumentKind | null {
  if (source === SCAN_SOURCE_DOCUMENT) return "documento"
  if (source === SCAN_SOURCE_INE) return "ine"
  return null
}

export function scanKindForMode(mode: ScanMode): ScanDocumentKind {
  return mode === "document" ? "documento" : "ine"
}

export function defaultScanOptions(mode: ScanMode = "document"): ScanOptions {
  return {
    mode,
    allowGallery: true,
    pageLimit: mode === "document" ? SCAN_DEFAULT_PAGE_LIMIT : 1,
    filter: mode === "document" ? "enhanced" : "original",
  }
}

/**
 * Valida y normaliza opciones provenientes del puente nativo o de componentes.
 * Devuelve `null` si el modo es inválido.
 */
export function parseScanOptions(raw: unknown): ScanOptions | null {
  if (!raw || typeof raw !== "object") return null
  const candidate = raw as Record<string, unknown>
  const mode = candidate.mode
  if (!isScanMode(mode)) return null

  const allowGallery = typeof candidate.allowGallery === "boolean" ? candidate.allowGallery : true
  const rawLimit = typeof candidate.pageLimit === "number" ? Math.floor(candidate.pageLimit) : SCAN_DEFAULT_PAGE_LIMIT
  const pageLimit = Math.min(Math.max(rawLimit, 1), SCAN_MAX_PAGES)
  const filter = isScanFilter(candidate.filter) ? candidate.filter : undefined

  return { mode, allowGallery, pageLimit, filter }
}

export function isNativeScanResponse(value: unknown): value is NativeScanResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (candidate.ok === false) return true
  if (candidate.ok !== true) return false
  return Array.isArray(candidate.pages)
}

export function isScannedPagePayload(value: unknown): value is ScannedPagePayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.base64 === "string" &&
    candidate.base64.length > 0 &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  )
}

/**
 * Título legible y estable para un documento escaneado.
 * No contiene datos personales: solo la clase y la fecha/hora local.
 */
export function scanDocumentTitle(kind: ScanDocumentKind, date = new Date()): string {
  const stamp = formatScanTimestamp(date)
  return kind === "ine" ? `INE ${stamp}` : `Documento escaneado ${stamp}`
}

function formatScanTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`
}

/** Sanitiza un nombre para usarlo como nombre de archivo PDF (sin rutas ni caracteres hostiles). */
export function sanitizeScanFileName(raw: string): string {
  let name = (raw || "documento").trim() || "documento"
  const slashIdx = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"))
  if (slashIdx >= 0 && slashIdx < name.length - 1) name = name.substring(slashIdx + 1)
  name = name
    .replace(/\.\./g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
  if (!name) name = "documento"
  if (name.length > 120) name = name.slice(0, 120).trim()
  if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf"
  return name
}
