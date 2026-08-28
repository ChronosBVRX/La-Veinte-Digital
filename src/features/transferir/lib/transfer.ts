export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES_PER_SESSION = 10
export const MAX_SESSION_BYTES = 25 * 1024 * 1024

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const

export interface TransferSession {
  id: string
  token: string
  ownerToken: string
  expiresAt: string
  ttlMinutes: number
}

export interface TransferFileMeta {
  id: string
  name: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface TransferFile extends TransferFileMeta {
  data: string
}

export interface NativeDocumentMeta {
  id: number
  name: string
  localPath: string
  source: string
  fileSize: number
  downloadedAt: number
  mimeType: string
}

export function isAllowedType(mime: string): boolean {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(mime)
}

/**
 * Official hosts that a transfer QR URL may come from. We do NOT trust the current page origin
 * blindly: the main domain, its www alias and any Vercel/preview alias are the only acceptable
 * hosts, so a forged/pasted QR pointing to an arbitrary origin is rejected.
 */
export const ALLOWED_TRANSFER_HOSTS = [
  "la-veinte-digital.vercel.app",
  "laveinte-digital.vercel.app",
  "la-veinte-digital.pages.dev",
  "la20.com.mx",
  "www.la20.com.mx",
] as const

/**
 * Extracts the transfer token from a scanned QR text, but ONLY if it points to an official
 * host's `/transfer?t=<token>` route. Returns null for any other host/path/missing token.
 */
export function extractTransferToken(text: string): string | null {
  try {
    const url = new URL(text)
    if (!(ALLOWED_TRANSFER_HOSTS as readonly string[]).includes(url.hostname)) {
      return null
    }
    if (url.pathname !== "/transfer") return null
    const token = url.searchParams.get("t")
    if (!token) return null
    return token
  } catch {
    return null
  }
}

/**
 * Builds a canonical transfer URL (origin + /transfer?t=token) from scanned text, or null if not
 * an official transfer link.
 */
export function extractUploadUrl(text: string): string | null {
  try {
    const url = new URL(text)
    if (!(ALLOWED_TRANSFER_HOSTS as readonly string[]).includes(url.hostname)) return null
    if (url.pathname !== "/transfer") return null
    const token = url.searchParams.get("t")
    if (!token) return null
    return `${url.origin}/transfer?t=${encodeURIComponent(token)}`
  } catch {
    return null
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
