"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  X, DownloadSimple, ShareNetwork, Printer, PencilSimple,
  UploadSimple, FileText, Clock, PencilLine,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { readNativeDocumentAsFile } from "@/features/transferir/services/transfer"
import { getBlobResource } from "@/shared/services/blob-storage"
import { escritoToPdfFile } from "../lib/escrito-pdf"
import {
  grupoLabel, formatBytes, formatFecha, formatFechaEscrito,
  type DocTipo, type DocumentoPersonalItem,
} from "../lib/documents"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

const TIPO_ICON: Record<DocTipo, typeof FileText> = {
  tarjeton: FileText,
  checadas: Clock,
  escrito: PencilLine,
}

const TIPO_COLOR: Record<DocTipo, string> = {
  tarjeton: "#2563eb",
  checadas: "#16a34a",
  escrito: "#7c3aed",
}

export interface DocumentViewerModalProps {
  open: boolean
  doc: DocumentoPersonalItem | null
  userId: string | null
  profile: TarjetonProfileSnapshot | null
  onClose: () => void
  onSendPrint: (doc: DocumentoPersonalItem) => void
  onImportTarjeton?: (doc: DocumentoPersonalItem) => void
}

export function DocumentViewerModal(props: DocumentViewerModalProps) {
  if (!props.open || !props.doc) return null
  return <DocumentViewerModalContent key={props.doc.id} {...props} doc={props.doc} />
}

interface DocumentViewerModalContentProps extends Omit<DocumentViewerModalProps, "doc"> {
  doc: DocumentoPersonalItem
}

function DocumentViewerModalContent({
  doc,
  userId,
  profile,
  onClose,
  onSendPrint,
  onImportTarjeton,
}: DocumentViewerModalContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)
  const [anexosUrls, setAnexosUrls] = useState<Array<{ id: string; url: string; nombre: string; descripcion?: string }>>([])
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadContent = async () => {
      try {
        if (doc.kind === "escrito") {
          // Cargar firma y fotos desde IndexedDB
          const currentUserId = userId ?? "anonymous"
          if (doc.escrito.firmaRef) {
            try {
              const fBlob = await getBlobResource(currentUserId, doc.escrito.firmaRef)
              if (!cancelled && fBlob) {
                setFirmaUrl(URL.createObjectURL(fBlob))
              }
            } catch {}
          }

          if (doc.escrito.anexos && doc.escrito.anexos.length > 0) {
            const loadedAnexos: Array<{ id: string; url: string; nombre: string; descripcion?: string }> = []
            for (const anx of doc.escrito.anexos) {
              if (anx.storageRef) {
                try {
                  const aBlob = await getBlobResource(currentUserId, anx.storageRef)
                  if (aBlob) {
                    loadedAnexos.push({
                      id: anx.id,
                      url: URL.createObjectURL(aBlob),
                      nombre: anx.nombre,
                      descripcion: anx.descripcion,
                    })
                  }
                } catch {}
              }
            }
            if (!cancelled) setAnexosUrls(loadedAnexos)
          }

          if (!cancelled) setLoading(false)
        } else {
          // Documento nativo PDF
          const file = await readNativeDocumentAsFile({
            name: doc.name,
            mimeType: doc.mimeType,
            localPath: doc.localPath,
          })
          if (cancelled) return
          if (!file) {
            setError("No se pudo leer el archivo local.")
            setLoading(false)
            return
          }

          const buf = await file.arrayBuffer()
          if (cancelled) return

          const { loadPdfDocument } = await import("@/features/tarjeton/lib/pdfjs-client")
          const { pdf } = await loadPdfDocument(buf)
          if (cancelled) return

          const pages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1.8 })
            const canvas = document.createElement("canvas")
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            const ctx = canvas.getContext("2d")
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport, canvas }).promise
              pages.push(canvas.toDataURL("image/png"))
            }
          }

          if (!cancelled) {
            setPdfPages(pages)
            setLoading(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando vista previa:", err)
          setError("No se pudo generar la vista previa del documento.")
          setLoading(false)
        }
      }
    }

    void loadContent()

    return () => {
      cancelled = true
    }
  }, [doc, userId])

  const Icon = TIPO_ICON[doc.tipo]
  const color = TIPO_COLOR[doc.tipo]
  const docName = doc.kind === "nativo" ? doc.name : doc.escrito.titulo || "Escrito Formal"
  const meta = doc.kind === "nativo"
    ? [formatBytes(doc.fileSize), formatFecha(doc.downloadedAt)].filter(Boolean).join("  ·  ")
    : ["Borrador guardado", formatFechaEscrito(doc.escrito.fecha)].filter(Boolean).join("  ·  ")

  const getFile = async (): Promise<File | null> => {
    if (doc.kind === "nativo") {
      return readNativeDocumentAsFile({ name: doc.name, mimeType: doc.mimeType, localPath: doc.localPath })
    }
    return escritoToPdfFile(doc.escrito, userId ?? "anonymous", {
      nombre: profile?.fullName ?? undefined,
      matricula: profile?.matricula ?? undefined,
      categoria: profile?.categoria ?? undefined,
    })
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const file = await getFile()
      if (!file) return
      const url = URL.createObjectURL(file)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name || `${docName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error al descargar:", err)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const file = await getFile()
      if (!file) return

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: docName,
          text: `Documento: ${docName}`,
        })
        return
      }

      if (typeof window !== "undefined" && window.LaVeinteApp?.share) {
        window.LaVeinteApp.share(docName, `Documento: ${docName}`)
        return
      }

      // Fallback a descarga
      await handleDownload()
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error al compartir:", err)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.92)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1150,
        padding: "clamp(0.5rem, 2vw, 1.25rem)",
        overflow: "auto",
        boxSizing: "border-box",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={containerRef}
        style={{
          background: "var(--card)",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "760px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
          border: "1px solid var(--border)",
          margin: "3vh auto",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Cabecera del Visor */}
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "var(--accent)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            boxSizing: "border-box",
          }}
        >
          {/* Identidad */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: "1 1 220px", minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "0.625rem",
                flexShrink: 0,
                background: `${color}1a`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color,
              }}
            >
              <Icon size={20} weight="duotone" />
            </div>
            <div style={{ minWidth: 0, flex: 1, wordBreak: "break-word" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--fg)", lineHeight: 1.3 }}>
                {docName}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: "0.125rem" }}>
                <span style={{ fontWeight: 600, color }}>{grupoLabel(doc.tipo)}</span> · {meta}
              </div>
            </div>
          </div>

          {/* Botones de acción rápida en cabecera */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", flexShrink: 0 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              loading={isDownloading}
              aria-label="Descargar PDF"
              title="Descargar archivo PDF"
            >
              <DownloadSimple size={16} weight="bold" />
              <span style={{ marginLeft: "0.25rem" }}>Descargar</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              loading={isSharing}
              aria-label="Compartir"
              title="Compartir documento"
            >
              <ShareNetwork size={16} weight="bold" />
              <span style={{ marginLeft: "0.25rem" }}>Compartir</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSendPrint(doc)}
              aria-label="Imprimir"
              title="Enviar a imprimir o transferir"
            >
              <Printer size={16} weight="bold" />
              <span style={{ marginLeft: "0.25rem" }}>Imprimir</span>
            </Button>

            {doc.tipo === "escrito" && (
              <Link
                href={`/escritos?id=${doc.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.375rem 0.625rem",
                  borderRadius: "0.375rem",
                  background: "var(--accent)",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <PencilSimple size={16} weight="bold" />
                <span>Editar</span>
              </Link>
            )}

            {doc.tipo === "tarjeton" && onImportTarjeton && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onImportTarjeton(doc)}
                title="Exportar datos al perfil laboral"
              >
                <UploadSimple size={16} weight="bold" />
                <span style={{ marginLeft: "0.25rem" }}>Exportar al perfil</span>
              </Button>
            )}

            <button
              onClick={onClose}
              aria-label="Cerrar visor"
              title="Cerrar"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0.375rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.375rem",
              }}
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        </div>

        {/* Contenido / Vista Previa */}
        <div
          style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            maxHeight: "75vh",
            overflowY: "auto",
            background: "var(--bg)",
            boxSizing: "border-box",
          }}
        >
          {loading && (
            <div style={{ padding: "3rem 1rem", display: "flex", justifyContent: "center" }}>
              <LoadingSpinner text="Generando vista previa del documento…" />
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: "#fee2e2", border: "1px solid #f87171",
              borderRadius: "0.75rem", padding: "1.25rem", color: "#991b1b",
              textAlign: "center",
            }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{error}</p>
              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                <Button size="sm" variant="primary" onClick={handleDownload}>
                  Descargar archivo
                </Button>
                <Button size="sm" variant="secondary" onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {/* Renderizado de Escrito (Hoja Carta Formal) */}
          {!loading && !error && doc.kind === "escrito" && (
            <div
              style={{
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: "0.5rem",
                padding: "clamp(1.5rem, 5vw, 3rem) clamp(1rem, 4vw, 2.5rem)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                border: "1px solid var(--border)",
                fontFamily: "Times New Roman, Times, serif",
                fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
                lineHeight: 1.5,
                maxWidth: "680px",
                margin: "0 auto",
                width: "100%",
                boxSizing: "border-box",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {/* Lugar y Fecha */}
              <div style={{ textAlign: "right", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
                {doc.escrito.ciudad ? `${doc.escrito.ciudad}, ` : ""}
                {doc.escrito.fecha}
              </div>

              {/* Asunto */}
              {doc.escrito.asunto && (
                <div style={{ textAlign: "right", fontWeight: "bold", marginBottom: "1.5rem", fontSize: "0.9375rem" }}>
                  ASUNTO: {doc.escrito.asunto}
                </div>
              )}

              {/* Destinatario Principal */}
              <div style={{ marginBottom: "1.25rem" }}>
                {doc.escrito.destino?.nombre && (
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "1rem" }}>
                    {doc.escrito.destino.nombre}
                  </div>
                )}
                {doc.escrito.destino?.cargo && (
                  <div style={{ fontSize: "0.9375rem" }}>
                    {doc.escrito.destino.cargo}
                  </div>
                )}

                {/* Atenciones Múltiples */}
                {doc.escrito.atencion && doc.escrito.atencion.length > 0 && (
                  <div style={{ marginTop: "0.5rem", fontStyle: "italic", fontSize: "0.875rem" }}>
                    {doc.escrito.atencion.map((at) => (
                      <div key={at.id}>
                        AT&apos;N: {at.nombre} {at.cargo ? `(${at.cargo})` : ""}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontWeight: "bold", marginTop: "0.75rem", letterSpacing: "1px" }}>
                  P R E S E N T E .
                </div>
              </div>

              {/* Cuerpo del Documento */}
              <div style={{ textAlign: "justify", marginBottom: "2rem" }}>
                {(doc.escrito.cuerpo || "").split(/\n\s*\n/).map((para, idx) => (
                  <p key={idx} style={{ textIndent: "2rem", marginBottom: "1rem", lineHeight: 1.6 }}>
                    {para.trim()}
                  </p>
                ))}
              </div>

              {/* Firma y Datos del Trabajador */}
              <div style={{ textAlign: "center", marginTop: "2.5rem", pageBreakInside: "avoid" }}>
                <div style={{ fontWeight: "bold", marginBottom: "0.5rem", letterSpacing: "1px" }}>
                  A T E N T A M E N T E
                </div>

                {/* Imagen de la firma digital si existe */}
                {firmaUrl ? (
                  <div style={{ display: "flex", justifyContent: "center", margin: "0.75rem 0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={firmaUrl}
                      alt="Firma del trabajador"
                      style={{ height: "70px", maxWidth: "220px", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div style={{ height: "45px" }} />
                )}

                <div style={{ borderTop: "1px solid #000", width: "240px", margin: "0.5rem auto 0.25rem" }} />

                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>
                  {profile?.fullName || "Nombre del Trabajador"}
                </div>
                {profile?.matricula && (
                  <div style={{ fontSize: "0.875rem" }}>
                    Matrícula: {profile.matricula}
                  </div>
                )}
                {profile?.categoria && (
                  <div style={{ fontSize: "0.875rem" }}>
                    Categoría: {profile.categoria}
                  </div>
                )}
              </div>

              {/* Anexos Fotográficos */}
              {anexosUrls.length > 0 && (
                <div style={{ marginTop: "3rem", borderTop: "1px dashed #cbd5e1", paddingTop: "1.5rem" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9375rem", marginBottom: "1rem", color: "#475569" }}>
                    ANEXOS Y EVIDENCIAS ({anexosUrls.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {anexosUrls.map((anx, i) => (
                      <div key={anx.id} style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", background: "#f8fafc" }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                          Anexo {i + 1}: {anx.nombre}
                        </div>
                        {anx.descripcion && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                            {anx.descripcion}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={anx.url}
                            alt={anx.nombre}
                            style={{ maxWidth: "100%", maxHeight: "350px", objectFit: "contain", borderRadius: "0.375rem" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Renderizado de Páginas PDF Nativas (Tarjetón y Checadas) */}
          {!loading && !error && doc.kind === "nativo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", width: "100%" }}>
              {pdfPages.map((pageSrc, pageIdx) => (
                <div
                  key={pageIdx}
                  style={{
                    background: "#ffffff",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                    border: "1px solid var(--border)",
                    width: "100%",
                    maxWidth: "700px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{
                    padding: "0.375rem 0.75rem",
                    background: "#f1f5f9",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#64748b",
                    textAlign: "right",
                  }}>
                    Página {pageIdx + 1} de {pdfPages.length}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pageSrc}
                    alt={`Página ${pageIdx + 1}`}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
