/**
 * Adaptadores por origen para el Visor Unificado de Documentos.
 *
 * Arquitectura por origen:
 * - Escrito: Repositorio canónico Escritos V2 -> Blob en IndexedDB -> (si no existe) generar PDF institucional -> crear renderUrl -> abrir visor.
 * - Tarjetón/Checada Web: Recuperar Blob o URL persistente -> crear renderUrl -> abrir visor.
 * - Tarjetón/Checada Android: Resolver URI mediante puente nativo (readNativeDocument) -> Blob/File -> crear renderUrl -> abrir visor.
 *
 * Contrato canónico común: ViewerDocument.
 * La Veinte Digital
 */

import type { EscritoDraftV2, LegacyEscritoV1 } from "@/shared/contracts/escrito-draft"
import { isEscritoDraftV2, migrateLegacyEscritoToV2 } from "@/shared/contracts/escrito-draft"
import { getEscritoById, getEscritosGuardados } from "@/shared/services/escritos-storage"
import { getBlobResource, saveBlobResource, buildBlobKey } from "@/shared/services/blob-storage"
import { escritoToPdfFile } from "../lib/escrito-pdf"
import { syncEscritoBlobToNative } from "./escrito-native-sync"
import { readNativeDocumentAsFile } from "@/features/transferir/services/transfer"
import type { DocumentoPersonalItem, UnifiedViewerDocument } from "../lib/documents"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

export type ViewerSourceType = "escrito" | "tarjeton" | "checada"

export interface ViewerDocument {
  id: string
  name: string
  mimeType: string
  renderUrl: string
  sourceType: ViewerSourceType
  file?: File | Blob
  cleanup?: () => void
  createdAt?: string | number
  fileSize?: number
  localPath?: string
  escrito?: EscritoDraftV2
  metadata?: Record<string, unknown>
}

export type ResolvableViewerInput =
  | DocumentoPersonalItem
  | UnifiedViewerDocument
  | ViewerDocument
  | EscritoDraftV2
  | { id: string; [k: string]: unknown }

/**
 * Determina de forma estricta si un documento corresponde a un Escrito.
 * Garantiza que un Escrito NUNCA ingrese al adaptador de documentos nativos.
 */
export function isEscritoDocument(item: unknown): boolean {
  if (!item || typeof item !== "object") return false
  const candidate = item as Record<string, unknown>
  if (candidate.sourceType === "escrito") return true
  if (candidate.kind === "escrito") return true
  if (candidate.tipo === "escrito") return true
  if (candidate.type === "escrito") return true
  if ("escrito" in candidate && candidate.escrito) return true
  if (typeof candidate.id === "string" && candidate.id.startsWith("esc_")) return true
  return false
}

/**
 * Adaptador de Escritos:
 * 1. Recupera el registro completo desde el repositorio canónico de Escritos V2.
 * 2. Recupera su Blob PDF desde IndexedDB si ya fue generado previamente.
 * 3. Si no existe, genera el PDF institucional tamaño Carta vectorizado con escritoToPdfFile y lo persiste en IndexedDB.
 * 4. Valida que el Blob exista y tenga type === "application/pdf".
 * 5. Crea la URL visualizable (URL.createObjectURL).
 * 6. Asigna el cleanup para ser ejecutado únicamente tras cerrar el visor.
 */
export async function adaptEscritoToViewerDocument(params: {
  item: ResolvableViewerInput
  userId: string
  profile?: TarjetonProfileSnapshot | null
}): Promise<ViewerDocument> {
  const { item, userId, profile } = params
  const safeUserId = userId && userId.trim() ? userId.trim() : "anonymous"

  // 1. Recuperar registro estructurado completo
  let draft: EscritoDraftV2 | null = null

  if ("escrito" in item && item.escrito) {
    const rawEscrito = item.escrito as EscritoDraftV2 | LegacyEscritoV1
    draft = isEscritoDraftV2(rawEscrito)
      ? rawEscrito
      : migrateLegacyEscritoToV2(rawEscrito, safeUserId)
  } else if (isEscritoDraftV2(item)) {
    draft = item
  } else if ("id" in item && typeof item.id === "string") {
    const fromStore = getEscritoById(item.id, safeUserId)
    if (fromStore) {
      draft = fromStore
    } else {
      const all = getEscritosGuardados(safeUserId) || []
      const found = all.find((e) => e.id === item.id)
      if (found) {
        draft = isEscritoDraftV2(found) ? found : migrateLegacyEscritoToV2(found, safeUserId)
      }
    }
  }

  if (!draft) {
    throw new Error("No se encontró el escrito en tu biblioteca personal.")
  }

  // 2. Recuperar Blob PDF desde IndexedDB si ya existe
  const pdfKey = draft.pdfRef || buildBlobKey(safeUserId, draft.id, "pdf", "documento")
  let pdfBlob: Blob | null = null

  try {
    const existing = await getBlobResource(safeUserId, pdfKey)
    if (existing && existing.size > 0) {
      pdfBlob = existing
    }
  } catch (err) {
    console.warn("[document-viewer-adapter] Error consultando PDF en IndexedDB:", err)
  }

  // 3. Si no existe PDF preexistente pero sí contenido estructurado, generarlo institucionalmente
  if (!pdfBlob || pdfBlob.size === 0) {
    try {
      const generatedFile = await escritoToPdfFile(draft, safeUserId, {
        nombre: profile?.fullName ?? draft.workerProfile?.nombre,
        matricula: profile?.matricula ?? draft.workerProfile?.matricula,
        categoria: profile?.categoria ?? draft.workerProfile?.categoria,
        adscripcion: draft.workerProfile?.adscripcion,
      })

      if (!generatedFile || generatedFile.size === 0) {
        throw new Error("El servicio canónico generó un archivo PDF vacío.")
      }

      pdfBlob = generatedFile

      // Persistir en IndexedDB de forma asíncrona para accesos instantáneos posteriores
      try {
        await saveBlobResource(safeUserId, draft.id, "pdf", "documento", generatedFile)
      } catch (saveErr) {
        console.warn("[document-viewer-adapter] No se pudo cachear PDF en IndexedDB:", saveErr)
      }
    } catch (genErr) {
      console.error("[document-viewer-adapter] Error generando PDF institucional de escrito:", genErr)
      throw new Error(
        `Error al generar PDF del escrito: ${genErr instanceof Error ? genErr.message : "Error desconocido"}`
      )
    }
  }

  // 4. Garantizar tipo application/pdf estricto
  let finalBlob = pdfBlob
  if (finalBlob.type !== "application/pdf") {
    finalBlob = new Blob([pdfBlob], { type: "application/pdf" })
  }

  // 4b. Respaldo offline Android (fire-and-forget): el PDF definitivo queda en Room/filesDir.
  if (draft) {
    syncEscritoBlobToNative(finalBlob, {
      escritoId: draft.id,
      title: draft.titulo || "Escrito Formal",
      ownerId: safeUserId,
      fecha: draft.fecha,
    })
  }

  // 5. Crear la URL visualizable
  const renderUrl = URL.createObjectURL(finalBlob)

  let cleaned = false
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true
      try {
        URL.revokeObjectURL(renderUrl)
      } catch {}
    }
  }

  const rawTitle = (draft.titulo || "").trim()
  const name = rawTitle
    ? (rawTitle.toLowerCase().endsWith(".pdf") ? rawTitle : `${rawTitle}.pdf`)
    : "Escrito_Formal.pdf"

  return {
    id: draft.id,
    name,
    mimeType: "application/pdf",
    renderUrl,
    sourceType: "escrito",
    file: finalBlob,
    createdAt: draft.updatedAt || draft.createdAt,
    fileSize: finalBlob.size,
    escrito: draft,
    cleanup,
  }
}

/**
 * Adaptador de Tarjetón / Checada en entorno Web:
 * Recupera Blob local o URL persistente y genera el contrato ViewerDocument.
 */
export async function adaptTarjetonChecadaWebToViewerDocument(
  item: ResolvableViewerInput
): Promise<ViewerDocument> {
  const docId = item.id
  const rawType = ("tipo" in item ? item.tipo : ("type" in item ? item.type : "tarjeton")) as string
  const sourceType: ViewerSourceType = rawType === "checadas" || rawType === "checada" ? "checada" : "tarjeton"
  const name = ("name" in item && item.name ? String(item.name) : ("titulo" in item && item.titulo ? String(item.titulo) : "Documento.pdf"))

  // Si ya tiene un renderUrl o sourceUri válido
  const sourceUri = ("sourceUri" in item ? (item.sourceUri as string) : undefined)
  const mimeType = ("mimeType" in item && item.mimeType ? (item.mimeType as string) : "application/pdf")

  if (sourceUri) {
    // Si es un data URL, creamos un Blob para soporte óptimo de visualización
    if (sourceUri.startsWith("data:")) {
      try {
        const parts = sourceUri.split(",")
        const mimeMatch = parts[0].match(/:(.*?);/)
        const detectedMime = mimeMatch ? mimeMatch[1] : mimeType
        const byteStr = atob(parts[1])
        const ab = new ArrayBuffer(byteStr.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteStr.length; i++) {
          ia[i] = byteStr.charCodeAt(i)
        }
        const blob = new Blob([ab], { type: detectedMime })
        const renderUrl = URL.createObjectURL(blob)

        let cleaned = false
        const cleanup = () => {
          if (!cleaned) {
            cleaned = true
            try {
              URL.revokeObjectURL(renderUrl)
            } catch {}
          }
        }

        return {
          id: docId,
          name,
          mimeType: detectedMime,
          renderUrl,
          sourceType,
          file: blob,
          fileSize: blob.size,
          cleanup,
        }
      } catch {
        // Fallback a URL directa si no se pudo convertir
        return {
          id: docId,
          name,
          mimeType,
          renderUrl: sourceUri,
          sourceType,
        }
      }
    }

    return {
      id: docId,
      name,
      mimeType,
      renderUrl: sourceUri,
      sourceType,
    }
  }

  throw new Error(`No se pudo encontrar la fuente de datos para ${name} en entorno web.`)
}

/**
 * Adaptador de Tarjetón / Checada en entorno Android:
 * Resuelve URI mediante el puente nativo y obtiene una fuente compatible con WebView.
 */
export async function adaptTarjetonChecadaAndroidToViewerDocument(
  item: ResolvableViewerInput
): Promise<ViewerDocument> {
  const docId = item.id
  const rawType = ("tipo" in item ? item.tipo : ("type" in item ? item.type : "tarjeton")) as string
  const sourceType: ViewerSourceType = rawType === "checadas" || rawType === "checada" ? "checada" : "tarjeton"
  const name = ("name" in item && item.name ? String(item.name) : "Documento.pdf")
  const localPath = ("localPath" in item && item.localPath ? String(item.localPath) : "")
  const mimeType = ("mimeType" in item && item.mimeType ? String(item.mimeType) : "application/pdf")

  if (!localPath) {
    throw new Error("El documento no contiene una ruta nativa local válida.")
  }

  const file = await readNativeDocumentAsFile({
    name,
    mimeType,
    localPath,
  })

  if (!file || file.size === 0) {
    throw new Error("No se pudo leer el archivo del documento desde el almacenamiento nativo.")
  }

  const renderUrl = URL.createObjectURL(file)

  let cleaned = false
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true
      try {
        URL.revokeObjectURL(renderUrl)
      } catch {}
    }
  }

  return {
    id: docId,
    name,
    mimeType: file.type || mimeType,
    renderUrl,
    sourceType,
    file,
    localPath,
    fileSize: file.size,
    cleanup,
  }
}

/**
 * Despachador principal que resuelve cualquier documento a su contrato ViewerDocument.
 */
export async function resolveViewerDocument(
  item: ResolvableViewerInput,
  userId = "anonymous",
  profile?: TarjetonProfileSnapshot | null
): Promise<ViewerDocument> {
  // Si ya es un ViewerDocument completamente resuelto con renderUrl activa
  if ("renderUrl" in item && item.renderUrl && "sourceType" in item && item.sourceType) {
    return item as ViewerDocument
  }

  // 1. Si es un Escrito: NUNCA entra por el puente nativo
  if (isEscritoDocument(item)) {
    return adaptEscritoToViewerDocument({ item, userId, profile })
  }

  // 2. Si es Android nativo con puente disponible
  const isAndroidNative =
    typeof window !== "undefined" &&
    Boolean(window.LaVeinteApp?.listNativeDocuments || window.LaVeinteApp?.readNativeDocument)

  if (isAndroidNative && "localPath" in item && item.localPath) {
    return adaptTarjetonChecadaAndroidToViewerDocument(item)
  }

  // 3. Tarjetón o Checada en Web
  return adaptTarjetonChecadaWebToViewerDocument(item)
}
