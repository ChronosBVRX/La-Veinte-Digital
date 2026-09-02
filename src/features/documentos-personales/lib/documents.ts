import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

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

export function grupoLabel(tipo: DocTipo): string {
  switch (tipo) {
    case "tarjeton":
      return "Tarjetones"
    case "checadas":
      return "Checadas"
    case "escrito":
      return "Escritos"
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
