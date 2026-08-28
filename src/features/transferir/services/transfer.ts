import { createClient } from "@/lib/supabase/client"
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_BYTES,
  isAllowedType,
} from "@/features/transferir/lib/transfer"
import type {
  TransferFile,
  TransferFileMeta,
  TransferSession,
} from "@/features/transferir/lib/transfer"

function client() {
  return createClient()
}

export async function createTransferSession(
  ttlMinutes = 10,
): Promise<TransferSession> {
  const { data, error } = await client().rpc("transfer_create_session", {
    p_ttl_minutes: ttlMinutes,
  })
  if (error) throw error
  return data as unknown as TransferSession
}

export async function listTransferFiles(
  ownerToken: string,
): Promise<TransferFileMeta[]> {
  const { data, error } = await client().rpc("transfer_list_files", {
    p_owner_token: ownerToken,
  })
  if (error) throw error
  return (data ?? []) as unknown as TransferFileMeta[]
}

export async function getTransferFile(
  ownerToken: string,
  fileId: string,
): Promise<TransferFile> {
  const { data, error } = await client().rpc("transfer_get_file", {
    p_owner_token: ownerToken,
    p_file_id: fileId,
  })
  if (error) throw error
  return data as unknown as TransferFile
}

export async function closeTransferSession(ownerToken: string): Promise<void> {
  await client().rpc("transfer_close_session", { p_owner_token: ownerToken })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === "string" ? result.split(",")[1] ?? "" : "")
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image_load_failed"))
    img.src = src
  })
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file
  try {
    const url = URL.createObjectURL(file)
    const img = await loadImage(url)
    URL.revokeObjectURL(url)
    const maxDim = 2400
    const scale = Math.min(
      1,
      maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
    )
    if (scale === 1 && file.size <= 2_000_000) return file
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    )
    return blob ?? file
  } catch {
    return file
  }
}

function translateServerError(message: string): string {
  if (message.includes("invalid_session") || message.includes("session_expired")) {
    return "El enlace expiró o ya no es válido. Vuelve a escanear el código QR."
  }
  if (message.includes("session_full")) {
    return "Ya se alcanzó el límite de 10 archivos por transferencia."
  }
  if (message.includes("session_size_exceeded")) {
    return "Se alcanzó el límite de 25 MB por transferencia."
  }
  if (message.includes("capacity_full")) {
    return "El servicio está temporalmente lleno. Inténtalo en unos minutos."
  }
  if (message.includes("file_too_large") || message.includes("invalid_size")) {
    return "El archivo supera el límite de 10 MB."
  }
  if (message.includes("invalid_content_type")) {
    return "Tipo de archivo no permitido. Usa una foto o un PDF."
  }
  if (message.includes("empty_file")) {
    return "El archivo está vacío."
  }
  return "No se pudo subir el archivo. Inténtalo de nuevo."
}

export async function uploadTransferFile(
  token: string,
  file: File,
): Promise<TransferFileMeta> {
  if (!isAllowedType(file.type)) {
    throw new Error(
      `Tipo de archivo no permitido (${file.type || "desconocido"}). Usa una foto o un PDF.`,
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.")
  }

  const blob = await compressImage(file)
  const contentType = (ALLOWED_CONTENT_TYPES as readonly string[]).includes(blob.type)
    ? blob.type
    : file.type

  const data = await blobToBase64(blob)

  const { data: result, error } = await client().rpc("transfer_upload_file", {
    p_token: token,
    p_name: file.name || "archivo",
    p_content_type: contentType,
    p_size_bytes: blob.size,
    p_data: data,
  })
  if (error) throw new Error(translateServerError(error.message))
  return result as unknown as TransferFileMeta
}

function base64ToBlob(data: string, contentType: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

/**
 * Reads a document saved natively by the app (tarjetón / checadas) and returns it as a File so it
 * can be sent through the same transfer upload path. No-ops (returns null) outside the native app
 * or when the file can't be read. A hard timeout guarantees the caller never hangs on a stuck bridge
 * round-trip (which previously left the scanner on "Preparando…").
 */
export async function readNativeDocumentAsFile(
  meta: { name: string; mimeType: string; localPath: string },
  timeoutMs = 6000,
): Promise<File | null> {
  if (typeof window === "undefined" || !window.LaVeinteApp?.readNativeDocument) return null
  try {
    const content = await withTimeout(
      window.LaVeinteApp.readNativeDocument(meta.localPath),
      timeoutMs,
    )
    if (!content?.data) return null
    const blob = base64ToBlob(content.data, content.mimeType || meta.mimeType || "application/pdf")
    return new File([blob], content.name || meta.name || "documento", {
      type: content.mimeType || meta.mimeType || "application/pdf",
    })
  } catch {
    return null
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("bridge_timeout")), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Exposed so callers can bound other native bridge round-trips (e.g. getPendingPrintDoc). */
export function nativeWithTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
  return withTimeout(promise, ms)
}

export function downloadTransferFile(file: TransferFile): void {
  const blob = base64ToBlob(file.data, file.contentType)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function openTransferFile(file: TransferFile): void {
  const blob = base64ToBlob(file.data, file.contentType)
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
