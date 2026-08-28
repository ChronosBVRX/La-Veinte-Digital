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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
