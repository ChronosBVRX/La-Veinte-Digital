/**
 * Gestor de Descarga y Consulta Offline de Documentos Normativos Completos.
 *
 * Soporta la estrategia híbrida:
 * - Detección nativa (Android Room / filesDir/normativa vía LaVeinteBridge y PdfShareBridge).
 * - Detección web (Cache API 'la-veinte-normativa-v1').
 * - Control de progreso de descarga y descarte local.
 */

import { savePdfToNativeDocs } from "./pdfShareBridge"

export interface OfflineNormativaDoc {
  id: string
  title: string
  shortTitle: string
  fileName: string
  sizeBytes: number
  sizeFormatted: string
  pages: number
  url: string
  category: "cct" | "sntss"
  description: string
}

export const OFFLINE_NORMATIVA_DOCS: Record<string, OfflineNormativaDoc> = {
  "CCT-IMSS-SNTSS-2025-2027": {
    id: "CCT-IMSS-SNTSS-2025-2027",
    title: "Contrato Colectivo de Trabajo IMSS–SNTSS 2025–2027",
    shortTitle: "CCT 2025–2027 (Completo)",
    fileName: "CCT-2025-2027.pdf",
    sizeBytes: 13162592,
    sizeFormatted: "13.1 MB",
    pages: 597,
    url: "https://media.sntss.org.mx/media/elements/contrato-colectivo-de-trabajo-2025-2027.pdf",
    category: "cct",
    description: "Texto facsimilar oficial completo con 597 páginas, anexos, reglamentos y profesiogramas.",
  },
  "SNTSS-ESTATUTOS-2022": {
    id: "SNTSS-ESTATUTOS-2022",
    title: "Estatutos SNTSS (Edición Octubre 2022)",
    shortTitle: "Estatutos SNTSS (Completo)",
    fileName: "estatutos-sntss-2022.pdf",
    sizeBytes: 2597830,
    sizeFormatted: "2.59 MB",
    pages: 72,
    url: "https://media.sntss.org.mx/media/elements/estatutos-sntss-2022-kc64-image.pdf",
    category: "sntss",
    description: "Edición oficial de octubre de 2022 con 72 páginas y estatutos de la organización sindical.",
  },
}

const CACHE_NAME = "la-veinte-normativa-v1"

/**
 * Verifica si el documento PDF oficial completo ya está descargado en el dispositivo.
 */
export async function isNormativaDocDownloaded(docId: string): Promise<boolean> {
  const meta = OFFLINE_NORMATIVA_DOCS[docId]
  if (!meta) return false

  // 1. Android Native check
  if (typeof window !== "undefined" && window.LaVeinteApp?.listNativeDocuments) {
    try {
      const nativeDocs = await window.LaVeinteApp.listNativeDocuments()
      const found = nativeDocs.some(
        (d) =>
          d.source === "NORMATIVA" &&
          (d.name === meta.fileName || d.escritoId === meta.id)
      )
      if (found) return true
    } catch {
      // Fallback to cache API
    }
  }

  // 2. Web Cache API check
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const match = await cache.match(meta.url)
      if (match) return true
    } catch {
      // noop
    }
  }

  return false
}

/**
 * Descarga el PDF facsimilar oficial completo para consulta offline.
 */
export async function downloadNormativaDoc(
  docId: string,
  onProgress?: (percent: number) => void
): Promise<{ ok: boolean; error?: string }> {
  const meta = OFFLINE_NORMATIVA_DOCS[docId]
  if (!meta) return { ok: false, error: "Documento no reconocido." }

  try {
    onProgress?.(5)
    const res = await fetch(meta.url)
    if (!res.ok) {
      return {
        ok: false,
        error: `Error al descargar (${res.status} ${res.statusText}).`,
      }
    }

    const contentLength = Number(res.headers.get("content-length")) || meta.sizeBytes
    const reader = res.body?.getReader()
    if (!reader) {
      const blob = await res.blob()
      onProgress?.(90)
      await persistDoc(meta, blob)
      onProgress?.(100)
      return { ok: true }
    }

    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      receivedBytes += value.length
      if (contentLength > 0 && onProgress) {
        const pct = Math.min(90, Math.round((receivedBytes / contentLength) * 90))
        onProgress(pct)
      }
    }

    const blob = new Blob(chunks as unknown as BlobPart[], { type: "application/pdf" })
    onProgress?.(95)
    await persistDoc(meta, blob)
    onProgress?.(100)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error durante la descarga.",
    }
  }
}

async function persistDoc(meta: OfflineNormativaDoc, blob: Blob): Promise<void> {
  // Always cache in web Cache API
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(
        meta.url,
        new Response(blob, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(blob.size),
            "X-Normativa-Doc-Id": meta.id,
          },
        })
      )
    } catch {
      // noop
    }
  }

  // If in native Android WebView, also send through chunked bridge to Room / filesDir
  if (typeof window !== "undefined" && window.LaVeinteApp?.isNativeApp()) {
    try {
      await savePdfToNativeDocs(
        blob,
        {
          escritoId: meta.id,
          title: meta.title,
          source: "NORMATIVA",
          fecha: meta.shortTitle,
        },
        meta.fileName
      )
    } catch (e) {
      console.warn("[NormativaOfflineManager] Native bridge save failed:", e)
    }
  }
}

/**
 * Elimina la copia local del documento para liberar memoria.
 */
export async function deleteOfflineNormativaDoc(docId: string): Promise<boolean> {
  const meta = OFFLINE_NORMATIVA_DOCS[docId]
  if (!meta) return false

  let ok = false

  // 1. Android native delete
  if (typeof window !== "undefined" && window.LaVeinteApp?.listNativeDocuments) {
    try {
      const nativeDocs = await window.LaVeinteApp.listNativeDocuments()
      const target = nativeDocs.find(
        (d) =>
          d.source === "NORMATIVA" &&
          (d.name === meta.fileName || d.escritoId === meta.id)
      )
      if (target) {
        if (target.id && window.LaVeinteApp.deleteNativeDocumentById) {
          await window.LaVeinteApp.deleteNativeDocumentById(target.id, target.localPath)
          ok = true
        } else if (target.localPath && window.LaVeinteApp.deleteNativeDocument) {
          await window.LaVeinteApp.deleteNativeDocument(target.localPath)
          ok = true
        }
      }
    } catch {
      // noop
    }
  }

  // 2. Web Cache delete
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const deleted = await cache.delete(meta.url)
      if (deleted) ok = true
    } catch {
      // noop
    }
  }

  return ok
}

/**
 * Obtiene la URL local (Object URL) o abre el documento guardado.
 */
export async function getOfflineDocUrl(docId: string): Promise<string | null> {
  const meta = OFFLINE_NORMATIVA_DOCS[docId]
  if (!meta) return null

  // 1. Check Web Cache
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const res = await cache.match(meta.url)
      if (res) {
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      }
    } catch {
      // noop
    }
  }

  // 2. Fallback to native base64 read
  if (typeof window !== "undefined" && window.LaVeinteApp?.listNativeDocuments && window.LaVeinteApp.readNativeDocument) {
    try {
      const nativeDocs = await window.LaVeinteApp.listNativeDocuments()
      const target = nativeDocs.find(
        (d) =>
          d.source === "NORMATIVA" &&
          (d.name === meta.fileName || d.escritoId === meta.id)
      )
      if (target?.localPath) {
        const docData = await window.LaVeinteApp.readNativeDocument(target.localPath)
        if (docData?.data) {
          const byteCharacters = atob(docData.data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: "application/pdf" })
          return URL.createObjectURL(blob)
        }
      }
    } catch {
      // noop
    }
  }

  return null
}
