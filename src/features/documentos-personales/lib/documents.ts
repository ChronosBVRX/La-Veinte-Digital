import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { scanKindForSource, type ScanDocumentKind } from "@/shared/contracts/document-scan"
export type { ViewerDocument, ViewerSourceType } from "../services/document-viewer-adapter"

export interface NativeDocumentMeta {
  id: number
  name: string
  localPath: string
  source: string
  fileSize: number
  downloadedAt: number
  mimeType: string
  /** Clave externa del escrito (solo source === "ESCRITO"; no se muestra en la lista web). */
  escritoId?: string | null
}

export type DocTipo = "tarjeton" | "checadas" | "documento" | "ine" | "escrito"

export interface DocNativo {
  kind: "nativo"
  tipo: "tarjeton" | "checadas" | "documento" | "ine"
  id: string
  numericId?: number
  name: string
  localPath: string
  source: string
  fileSize: number
  downloadedAt: number
  mimeType: string
}

export interface DocEscrito {
  kind: "escrito"
  tipo: "escrito"
  id: string
  titulo: string
  fecha: string
  escrito: EscritoDraftV2
}

/**
 * Documento escaneado con el módulo de digitalización y guardado en IndexedDB
 * (solo web; en Android los escaneos viven como documentos nativos).
 */
export interface DocEscaneado {
  kind: "escaneado"
  tipo: ScanDocumentKind
  id: string
  name: string
  fileSize: number
  createdAt: number
  mimeType: string
  pageCount: number
}

export type DocumentoPersonalItem = DocNativo | DocEscrito | DocEscaneado

export interface UnifiedViewerDocument {
  id: string
  type: "tarjeton" | "checadas" | "escrito" | "documento" | "ine"
  name: string
  mimeType?: string
  sourceUri?: string
  localPath?: string
  fileSize?: number
  createdAt?: string | number
  escrito?: EscritoDraftV2
  metadata?: Record<string, unknown>
}

export function toUnifiedViewerDocument(
  item: DocumentoPersonalItem | UnifiedViewerDocument
): UnifiedViewerDocument {
  if ("kind" in item) {
    if (item.kind === "nativo") {
      return {
        id: item.id,
        type: item.tipo,
        name: item.name,
        mimeType: item.mimeType,
        localPath: item.localPath,
        fileSize: item.fileSize,
        createdAt: item.downloadedAt,
      }
    } else if (item.kind === "escaneado") {
      return {
        id: item.id,
        type: item.tipo,
        name: item.name,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        createdAt: item.createdAt,
      }
    } else {
      return {
        id: item.id,
        type: "escrito",
        name: item.escrito.titulo || "Escrito Formal",
        mimeType: "application/pdf",
        createdAt: item.fecha,
        escrito: item.escrito,
      }
    }
  }
  return item
}

/**
 * Clasifica un documento nativo por su `source` EXPLÍCITO (Room), nunca por nombre
 * de archivo: TU_PERFIL / TARJETON_DIGITAL / TU_PERFIL_BIOMETRIC / DOCUMENT_SCAN / INE_SCAN.
 */
export function tipoDeSource(source: string): "tarjeton" | "checadas" | "documento" | "ine" | null {
  const scanKind = scanKindForSource(source)
  if (scanKind) return scanKind
  if (source.includes("BIOMETRIC")) return "checadas"
  if (source === "TU_PERFIL" || source === "TARJETON_DIGITAL") return "tarjeton"
  return null
}

export function toNativo(doc: NativeDocumentMeta): DocNativo | null {
  const tipo = tipoDeSource(doc.source)
  if (!tipo) return null
  return {
    kind: "nativo",
    tipo,
    id: String(doc.id),
    numericId: doc.id,
    name: doc.name,
    localPath: doc.localPath,
    source: doc.source,
    fileSize: doc.fileSize,
    downloadedAt: doc.downloadedAt,
    mimeType: doc.mimeType,
  }
}

export function formatFecha(downloadedAt: number): string {
  if (!downloadedAt) return ""
  return new Date(downloadedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
}

export function formatFechaEscrito(fecha: string): string {
  if (!fecha) return ""
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function grupoLabel(tipo: DocTipo | UnifiedViewerDocument["type"] | "checada"): string {
  switch (tipo) {
    case "tarjeton":
      return "Tarjetones"
    case "checadas":
    case "checada":
      return "Checadas"
    case "escrito":
      return "Escritos"
    case "ine":
      return "Identificaciones"
    case "documento":
      return "Documentos"
    default:
      return "Documento"
  }
}

export function fechaDe(item: DocumentoPersonalItem): string {
  if (item.kind === "escaneado") return formatFecha(item.createdAt)
  if (item.kind === "nativo") return formatFecha(item.downloadedAt)
  return formatFechaEscrito(item.fecha)
}

export function tituloDe(item: DocumentoPersonalItem): string {
  if (item.kind === "nativo" || item.kind === "escaneado") return item.name
  return item.escrito.titulo || "Escrito"
}
