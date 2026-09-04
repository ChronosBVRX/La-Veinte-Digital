import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

export interface NativeDocumentMeta {
  id: number
  name: string
  localPath: string
  source: string
  fileSize: number
  downloadedAt: number
  mimeType: string
}

export type DocTipo = "tarjeton" | "checadas" | "escrito"

export interface DocNativo {
  kind: "nativo"
  tipo: "tarjeton" | "checadas"
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

export type DocumentoPersonalItem = DocNativo | DocEscrito

export interface UnifiedViewerDocument {
  id: string
  type: "tarjeton" | "checadas" | "escrito" | "documento"
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

/** Clasifica un documento nativo (source de Room: TU_PERFIL / TARJETON_DIGITAL / TU_PERFIL_BIOMETRIC). */
export function tipoDeSource(source: string): "tarjeton" | "checadas" | null {
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

export function grupoLabel(tipo: DocTipo | UnifiedViewerDocument["type"]): string {
  switch (tipo) {
    case "tarjeton":
      return "Tarjetones"
    case "checadas":
      return "Checadas"
    case "escrito":
      return "Escritos"
    case "documento":
      return "Documentos"
    default:
      return "Documento"
  }
}

export function fechaDe(item: DocumentoPersonalItem): string {
  if (item.kind === "nativo") return formatFecha(item.downloadedAt)
  return formatFechaEscrito(item.fecha)
}

export function tituloDe(item: DocumentoPersonalItem): string {
  if (item.kind === "nativo") return item.name
  return item.escrito.titulo || "Escrito"
}
