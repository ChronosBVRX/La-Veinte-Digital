/**
 * Puente TypeScript para compartir documentos PDF generados localmente.
 *
 * Implementa el protocolo fragmentado robusto:
 * - Detección de WebView nativo de La Veinte Digital (`window.LaVeinteApp` y `window.laVeintePdfBridge`).
 * - Cálculo de hash SHA-256 usando Web Crypto API.
 * - Fragmentación en bloques de 64 KB en Base64.
 * - Control de orden estricto, límite de 10 MB y timeout de 30 segundos.
 * - Limpieza y cancelación automática ante fallos.
 * - Respuestas tipadas con el contrato canónico.
 */

export interface PdfShareSuccessResponse {
  ok: true
  status: "chooser_opened"
  transferId: string
  fileName: string
  byteLength: number
  sha256: string
}

export interface PdfShareErrorResponse {
  ok: false
  code:
    | "BUSY"
    | "INVALID_REQUEST"
    | "CHUNK_OUT_OF_ORDER"
    | "INVALID_PDF"
    | "FILE_TOO_LARGE"
    | "WRITE_FAILED"
    | "CHECKSUM_MISMATCH"
    | "TIMEOUT"
    | "NO_APP_AVAILABLE"
    | "CANCELLED"
    | "INTERNAL_ERROR"
    | "UNSUPPORTED"
  message: string
  transferId?: string
}

export type PdfShareResult = PdfShareSuccessResponse | PdfShareErrorResponse

const CHUNK_SIZE = 64 * 1024 // 64 KB bytes binarios por fragmento
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Convierte un ArrayBuffer o Uint8Array a string Base64 de forma eficiente.
 */
function bufferToBase64(bytes: Uint8Array): string {
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Calcula el hash SHA-256 hexadecimal de un buffer.
 */
async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuf))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Genera un identificador único para la transferencia.
 */
function generateTransferId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "transfer_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now()
}

/**
 * Determina si el entorno actual cuenta con soporte del puente nativo de La Veinte Digital.
 */
export function isNativePdfShareSupported(): boolean {
  if (typeof window === "undefined") return false
  const hasApp = !!window.LaVeinteApp?.isNativeApp?.()
  const hasBridge = typeof window.laVeintePdfBridge?.postMessage === "function" || typeof window.LaVeinteApp?.sendPdfShareMessage === "function"
  return hasApp && hasBridge
}

/**
 * Envía un mensaje JSON a través del canal WebMessageListener o del puente nativo.
 */
function postBridgeMessage(message: Record<string, unknown>): boolean {
  if (typeof window === "undefined") return false
  if (window.laVeintePdfBridge && typeof window.laVeintePdfBridge.postMessage === "function") {
    try {
      window.laVeintePdfBridge.postMessage(JSON.stringify(message))
      return true
    } catch (e) {
      console.error("[PdfShareBridge] Error posting to laVeintePdfBridge:", e)
    }
  }
  if (window.LaVeinteApp && typeof window.LaVeinteApp.sendPdfShareMessage === "function") {
    return window.LaVeinteApp.sendPdfShareMessage(message)
  }
  return false
}

/**
 * Comparte un archivo File o Blob de PDF mediante el puente nativo de fragmentos.
 */
export async function sharePdfViaNativeBridge(file: File | Blob, rawFileName?: string): Promise<PdfShareResult> {
  const fileName = (rawFileName || (file instanceof File ? file.name : "documento.pdf")) || "documento.pdf"

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "El archivo supera el límite de 10 MB.",
    }
  }

  if (file.size === 0) {
    return {
      ok: false,
      code: "INVALID_PDF",
      message: "El archivo generado está vacío.",
    }
  }

  if (!isNativePdfShareSupported()) {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: "El puente nativo de documentos no está disponible en este entorno.",
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const totalSize = bytes.byteLength

  // Validación de cabecera %PDF-
  const headerBytes = bytes.slice(0, 5)
  const headerStr = String.fromCharCode(...headerBytes)
  if (headerStr !== "%PDF-") {
    return {
      ok: false,
      code: "INVALID_PDF",
      message: "El archivo no contiene una cabecera de PDF válida.",
    }
  }

  const sha256 = await computeSha256Hex(arrayBuffer)
  const transferId = generateTransferId()

  return new Promise<PdfShareResult>((resolve) => {
    let settled = false
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
        timeoutTimer = null
      }
      if (typeof window !== "undefined" && window.__laveintePdfShareCallback === onBridgeResponse) {
        window.__laveintePdfShareCallback = undefined
      }
    }

    const finish = (result: PdfShareResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    timeoutTimer = setTimeout(() => {
      postBridgeMessage({ action: "cancel", transferId, reason: "client_timeout" })
      finish({
        ok: false,
        code: "TIMEOUT",
        message: "Tiempo de espera agotado al comunicar con la app nativa.",
        transferId,
      })
    }, 35000)

    const onBridgeResponse = (rawPayload: unknown) => {
      try {
        const data = (typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload) as Record<string, unknown>
        if (!data || typeof data !== "object") return

        // Confirmación de inicio
        if (data.ok === true && data.status === "ready" && data.transferId === transferId) {
          sendAllChunks().catch((err) => {
            postBridgeMessage({ action: "cancel", transferId, reason: "chunk_error" })
            finish({
              ok: false,
              code: "WRITE_FAILED",
              message: err instanceof Error ? err.message : "Error enviando fragmentos de archivo.",
              transferId,
            })
          })
          return
        }

        // Éxito final
        if (data.ok === true && data.status === "chooser_opened" && data.transferId === transferId) {
          finish(data as unknown as PdfShareSuccessResponse)
          return
        }

        // Error devuelto por la app nativa
        if (data.ok === false) {
          finish(data as unknown as PdfShareErrorResponse)
          return
        }
      } catch (err) {
        console.error("[PdfShareBridge] Error procesando respuesta del bridge:", err)
      }
    }

    if (typeof window !== "undefined") {
      window.__laveintePdfShareCallback = onBridgeResponse
    }

    const sendAllChunks = async () => {
      let offset = 0
      let index = 0

      while (offset < totalSize) {
        const end = Math.min(offset + CHUNK_SIZE, totalSize)
        const chunkSlice = bytes.slice(offset, end)
        const base64Chunk = bufferToBase64(chunkSlice)

        const chunkMsg = {
          action: "chunk",
          transferId,
          index,
          chunk: base64Chunk,
        }

        const sent = postBridgeMessage(chunkMsg)
        if (!sent) {
          throw new Error("No se pudo enviar el fragmento al puente nativo.")
        }

        offset = end
        index++
        // Pequeño rendimiento cooperativo para no bloquear el hilo de render
        if (index % 5 === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      // Enviar confirmación (commit)
      const commitMsg = {
        action: "commit",
        transferId,
        sha256,
        totalSize,
      }
      postBridgeMessage(commitMsg)
    }

    // Iniciar transferencia
    const startMsg = {
      action: "start",
      transferId,
      fileName,
    }

    const started = postBridgeMessage(startMsg)
    if (!started) {
      finish({
        ok: false,
        code: "UNSUPPORTED",
        message: "No fue posible comunicarse con el puente nativo de Android.",
        transferId,
      })
    }
  })
}

/**
 * Devuelve true si el código está ejecutándose dentro de la app nativa (WebView).
 * Nunca devuelve true en un navegador web normal, PWA o entorno SSR.
 */
export function isRunningInNativeApp(): boolean {
  if (typeof window === "undefined") return false
  return !!(window.LaVeinteApp?.isNativeApp?.())
}

/**
 * Resultado de shareGeneratedPdf.
 *
 * - `"ok"`: compartición exitosa (chooser abierto o descarga web iniciada).
 * - `"error"`: falló; `message` contiene el texto para mostrar al usuario.
 * - `"update_required"`: la app es nativa pero no tiene el puente de PDF;
 *    se debe invitar al usuario a actualizar. `message` contiene el texto.
 * - `"aborted"`: el usuario canceló (AbortError en Web Share API).
 */
export type ShareOutcome =
  | { status: "ok" }
  | { status: "error"; message: string }
  | { status: "update_required"; message: string }
  | { status: "aborted" }

/**
 * Función centralizada de compartición de PDFs generados en JavaScript.
 *
 * Política:
 *  1. App nativa + puente nuevo → protocolo fragmentado.
 *     Si falla, devuelve error; NO continúa hacia descarga.
 *  2. App nativa SIN puente nuevo → update_required; NO ejecuta blob://<a>.
 *  3. Navegador web → Web Share API con File (si disponible).
 *  4. Navegador web sin Web Share → descarga via blob: + <a download>.
 *
 * @param file   PDF generado como File o Blob.
 * @param fileName Nombre sugerido del archivo.
 */
export async function shareGeneratedPdf(
  file: File | Blob,
  fileName: string
): Promise<ShareOutcome> {
  // ── Rama nativa ────────────────────────────────────────────────────────────
  if (isRunningInNativeApp()) {
    if (isNativePdfShareSupported()) {
      // Nuevo puente: protocolo fragmentado
      const result = await sharePdfViaNativeBridge(file, fileName)
      if (result.ok) return { status: "ok" }
      return { status: "error", message: result.message || "No se pudo compartir el archivo." }
    }

    // App nativa sin el puente nuevo: pedir actualización
    if (typeof window !== "undefined" && typeof window.LaVeinteApp?.checkForUpdate === "function") {
      try { window.LaVeinteApp.checkForUpdate() } catch { /* best-effort */ }
    }
    return {
      status: "update_required",
      message: "Actualiza La Veinte Digital para compartir escritos en PDF.",
    }
  }

  // ── Rama web ───────────────────────────────────────────────────────────────
  // Web Share API con File (Chrome Android, Safari 15.4+)
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  ) {
    const fileObj = file instanceof File ? file : new File([file], fileName, { type: "application/pdf" })
    if (navigator.canShare({ files: [fileObj] })) {
      try {
        await navigator.share({ files: [fileObj], title: fileName })
        return { status: "ok" }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return { status: "aborted" }
        // Cualquier otro error: cae al fallback de descarga
      }
    }
  }

  // Descarga directa (solo en navegador web)
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blobUrl = URL.createObjectURL(file instanceof Blob ? file : new Blob([file], { type: "application/pdf" }))
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    return { status: "ok" }
  }

  return { status: "error", message: "Compartir archivos no está disponible en este entorno." }
}
