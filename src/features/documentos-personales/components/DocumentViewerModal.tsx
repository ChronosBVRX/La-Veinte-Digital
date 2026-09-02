"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  X, ShareNetwork, Printer, PencilSimple,
  UploadSimple, FileText, Clock, PencilLine,
  MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsIn,
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
  const [cachedFile, setCachedFile] = useState<File | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  // Zoom interactivo y gestos táctiles (Pinch to Zoom & Double Tap)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState(false)
  const contentWrapperRef = useRef<HTMLDivElement | null>(null)
  const touchStateRef = useRef<{
    initialDist: number
    initialScale: number
    lastTouchEnd: number
    isPinching: boolean
    isPanning: boolean
    startX: number
    startY: number
    initialPanX: number
    initialPanY: number
  }>({
    initialDist: 0,
    initialScale: 1,
    lastTouchEnd: 0,
    isPinching: false,
    isPanning: false,
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  })

  useEffect(() => {
    let cancelled = false

    const loadContent = async () => {
      try {
        if (doc.kind === "escrito") {
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

          // Pre-generar archivo PDF para compartir instantáneamente sin async gap
          try {
            const generatedFile = await escritoToPdfFile(doc.escrito, currentUserId, {
              nombre: profile?.fullName ?? undefined,
              matricula: profile?.matricula ?? undefined,
              categoria: profile?.categoria ?? undefined,
            })
            if (!cancelled) setCachedFile(generatedFile)
          } catch {}

          if (!cancelled) setLoading(false)
        } else {
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

          setCachedFile(file)
          const buf = await file.arrayBuffer()
          if (cancelled) return

          const { loadPdfDocument } = await import("@/features/tarjeton/lib/pdfjs-client")
          const { pdf } = await loadPdfDocument(buf)
          if (cancelled) return

          const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2
          const renderScale = Math.max(dpr, 2.0)

          const pages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: renderScale })
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
  }, [doc, userId, profile])

  const Icon = TIPO_ICON[doc.tipo]
  const color = TIPO_COLOR[doc.tipo]
  const docName = doc.kind === "nativo" ? doc.name : doc.escrito.titulo || "Escrito Formal"
  const meta = doc.kind === "nativo"
    ? [formatBytes(doc.fileSize), formatFecha(doc.downloadedAt)].filter(Boolean).join("  ·  ")
    : ["Borrador guardado", formatFechaEscrito(doc.escrito.fecha)].filter(Boolean).join("  ·  ")

  const handleShare = async () => {
    setIsSharing(true)
    setShareFeedback(null)
    try {
      // 1. Si estamos en Android nativo y es documento nativo
      if (doc.kind === "nativo" && doc.localPath && typeof window !== "undefined" && window.LaVeinteApp?.shareNativeDocument) {
        window.LaVeinteApp.shareNativeDocument(doc.localPath, docName)
        setIsSharing(false)
        return
      }

      // 2. Si estamos en Android nativo con share de texto genérico
      if (typeof window !== "undefined" && window.LaVeinteApp?.share) {
        window.LaVeinteApp.share(docName, `Documento: ${docName}`)
        setIsSharing(false)
        return
      }

      // 3. Web Share API con archivo preparado (sin delay async para no perder el gesto del usuario)
      const file = cachedFile
      if (file && typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: docName,
        })
        setIsSharing(false)
        return
      }

      // 4. Web Share API de solo texto/URL
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: docName,
          text: `Documento: ${docName}`,
        })
        setIsSharing(false)
        return
      }

      // 5. Fallback a portapapeles
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${docName} - La Veinte Digital`)
        setShareFeedback("Título del documento copiado al portapapeles.")
        setTimeout(() => setShareFeedback(null), 3000)
        setIsSharing(false)
        return
      }

      setShareFeedback("Compartir no disponible en este navegador.")
      setTimeout(() => setShareFeedback(null), 3000)
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error al compartir:", err)
        setShareFeedback("No se pudo compartir el documento.")
        setTimeout(() => setShareFeedback(null), 3000)
      }
    } finally {
      setIsSharing(false)
    }
  }

  // --- Manejo de Gestos Táctiles (Pinch-to-zoom y Doble Toque) ---
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Inicio de pellizco con dos dedos
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStateRef.current.initialDist = dist
      touchStateRef.current.initialScale = zoomScale
      touchStateRef.current.isPinching = true
      touchStateRef.current.isPanning = false
      setIsInteracting(true)
    } else if (e.touches.length === 1 && zoomScale > 1.05) {
      // Inicio de paneo cuando ya está ampliado
      touchStateRef.current.isPanning = true
      touchStateRef.current.startX = e.touches[0].clientX
      touchStateRef.current.startY = e.touches[0].clientY
      touchStateRef.current.initialPanX = panOffset.x
      touchStateRef.current.initialPanY = panOffset.y
      setIsInteracting(true)
    }
  }, [zoomScale, panOffset])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStateRef.current.isPinching && e.touches.length === 2) {
      e.preventDefault()
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      if (touchStateRef.current.initialDist > 0) {
        const factor = currentDist / touchStateRef.current.initialDist
        const nextScale = Math.min(Math.max(touchStateRef.current.initialScale * factor, 1), 3.5)
        setZoomScale(nextScale)
        if (nextScale <= 1.02) {
          setPanOffset({ x: 0, y: 0 })
        }
      }
    } else if (touchStateRef.current.isPanning && e.touches.length === 1 && zoomScale > 1.05) {
      const deltaX = e.touches[0].clientX - touchStateRef.current.startX
      const deltaY = e.touches[0].clientY - touchStateRef.current.startY
      setPanOffset({
        x: touchStateRef.current.initialPanX + deltaX,
        y: touchStateRef.current.initialPanY + deltaY,
      })
    }
  }, [zoomScale])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchStateRef.current.isPinching = false
    }
    if (e.touches.length === 0) {
      touchStateRef.current.isPanning = false
      setIsInteracting(false)
      // Detección de doble toque para alternar zoom (1x <-> 2x)
      const now = Date.now()
      if (now - touchStateRef.current.lastTouchEnd < 300) {
        setZoomScale((prev) => (prev > 1.2 ? 1 : 2))
        setPanOffset({ x: 0, y: 0 })
      }
      touchStateRef.current.lastTouchEnd = now
    }
  }, [])

  const zoomIn = () => setZoomScale((prev) => Math.min(prev + 0.35, 3.5))
  const zoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.35, 1)
      if (next <= 1) setPanOffset({ x: 0, y: 0 })
      return next
    })
  }
  const resetZoom = () => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        maxWidth: "100%",
        height: "100dvh",
        background: "#0f172a",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .doc-viewer-btn-label {
          display: none;
          margin-left: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
        @media (min-width: 640px) {
          .doc-viewer-btn-label {
            display: inline;
          }
        }
        .doc-viewer-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          min-width: 34px;
          padding: 0 0.45rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--fg);
          cursor: pointer;
          flex-shrink: 0;
          box-sizing: border-box;
          transition: background 0.15s ease;
        }
        .doc-viewer-action-btn:hover {
          background: var(--accent);
        }
        @media (min-width: 640px) {
          .doc-viewer-action-btn {
            padding: 0 0.65rem;
          }
        }
        .zoom-floating-pill {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(15, 23, 42, 0.9);
          color: #ffffff;
          padding: 0.35rem 0.6rem;
          border-radius: 2rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          z-index: 50;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .zoom-floating-pill button {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 0.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .zoom-floating-pill button:active {
          transform: scale(0.9);
        }
      `}</style>

      {/* Barra de cabecera superior integrada */}
      <header
        style={{
          width: "100%",
          maxWidth: "100vw",
          padding: "0.5rem 0.625rem",
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          flexShrink: 0,
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        {/* Identidad del Documento */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: "1 1 auto" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "0.5rem",
              flexShrink: 0,
              background: `${color}1a`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
            }}
          >
            <Icon size={18} weight="duotone" />
          </div>
          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--fg)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={docName}
            >
              {docName}
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--muted)",
                marginTop: "0.0625rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ fontWeight: 600, color }}>{grupoLabel(doc.tipo)}</span> · {meta}
            </div>
          </div>
        </div>

        {/* Acciones de Cabecera y Botón Cerrar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          {/* Compartir */}
          <button
            onClick={handleShare}
            disabled={isSharing}
            title="Compartir documento"
            aria-label="Compartir"
            className="doc-viewer-action-btn"
          >
            <ShareNetwork size={16} weight="bold" />
            <span className="doc-viewer-btn-label">Compartir</span>
          </button>

          {/* Imprimir */}
          <button
            onClick={() => onSendPrint(doc)}
            title="Enviar a imprimir o transferir"
            aria-label="Imprimir"
            className="doc-viewer-action-btn"
          >
            <Printer size={16} weight="bold" />
            <span className="doc-viewer-btn-label">Imprimir</span>
          </button>

          {/* Editar (si es escrito) */}
          {doc.tipo === "escrito" && (
            <Link
              href={`/escritos?id=${doc.id}`}
              title="Editar escrito"
              aria-label="Editar escrito"
              className="doc-viewer-action-btn"
              style={{
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              <PencilSimple size={16} weight="bold" />
              <span className="doc-viewer-btn-label">Editar</span>
            </Link>
          )}

          {/* Exportar al perfil (si es tarjetón) */}
          {doc.tipo === "tarjeton" && onImportTarjeton && (
            <button
              onClick={() => onImportTarjeton(doc)}
              title="Exportar datos al perfil laboral"
              aria-label="Exportar al perfil"
              className="doc-viewer-action-btn"
            >
              <UploadSimple size={16} weight="bold" />
              <span className="doc-viewer-btn-label">Exportar</span>
            </button>
          )}

          {/* Separador */}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 0.125rem" }} />

          {/* Botón Cerrar (Esquina superior derecha) */}
          <button
            onClick={onClose}
            aria-label="Cerrar visor"
            title="Cerrar visor"
            className="doc-viewer-action-btn"
            style={{
              background: "var(--accent)",
              color: "var(--fg)",
              width: 34,
              height: 34,
              padding: 0,
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </header>

      {/* Notificación de feedback al compartir si aplica */}
      {shareFeedback && (
        <div
          style={{
            position: "absolute",
            top: "54px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            zIndex: 60,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {shareFeedback}
        </div>
      )}

      {/* Controles Flotantes de Zoom (Inferior Derecho) */}
      {!loading && !error && (
        <div style={{ position: "fixed", bottom: "1.25rem", right: "1.25rem", zIndex: 60 }}>
          <div className="zoom-floating-pill">
            <button onClick={zoomOut} disabled={zoomScale <= 1} title="Reducir zoom" aria-label="Reducir zoom">
              <MagnifyingGlassMinus size={18} weight="bold" />
            </button>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, minWidth: "36px", textAlign: "center" }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button onClick={zoomIn} disabled={zoomScale >= 3.5} title="Aumentar zoom" aria-label="Aumentar zoom">
              <MagnifyingGlassPlus size={18} weight="bold" />
            </button>
            {zoomScale > 1 && (
              <button onClick={resetZoom} title="Restablecer tamaño original" aria-label="Restablecer">
                <ArrowsIn size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Área Principal de Visualización de Documento (Aprovecha 100% de alto y ancho) */}
      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "100vw",
          minHeight: 0,
          overflowY: zoomScale > 1.05 ? "hidden" : "auto",
          overflowX: zoomScale > 1.05 ? "hidden" : "auto",
          WebkitOverflowScrolling: "touch",
          padding: 0,
          margin: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          touchAction: zoomScale > 1.05 ? "none" : "pan-y",
          position: "relative",
        }}
      >
        {loading && (
          <div style={{ padding: "4rem 1rem", display: "flex", justifyContent: "center", margin: "auto" }}>
            <LoadingSpinner text="Generando vista previa del documento…" />
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #f87171",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              color: "#991b1b",
              textAlign: "center",
              maxWidth: "480px",
              margin: "auto",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem" }}>{error}</p>
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.5rem" }}>
              <Button size="sm" variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {/* Contenedor con Transformación de Zoom y Paneo */}
        {!loading && !error && (
          <div
            ref={contentWrapperRef}
            style={{
              width: "100%",
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "0 0 2rem",
              margin: 0,
              boxSizing: "border-box",
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center top",
              transition: isInteracting ? "none" : "transform 0.15s ease-out",
              willChange: "transform",
            }}
          >
            {/* Renderizado de Escrito (Hoja Carta Formal de Alto Completo) */}
            {doc.kind === "escrito" && (
              <div
                style={{
                  background: "#ffffff",
                  color: "#0f172a",
                  minHeight: "calc(100dvh - 56px)",
                  padding: "clamp(1.25rem, 4vw, 3rem) clamp(1rem, 3.5vw, 2.5rem)",
                  fontFamily: "Times New Roman, Times, serif",
                  fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
                  lineHeight: 1.5,
                  maxWidth: "850px",
                  margin: 0,
                  width: "100%",
                  boxSizing: "border-box",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
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

            {/* Renderizado de Páginas PDF Nativas (Tarjetón y Checadas de Borde a Borde) */}
            {doc.kind === "nativo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center", width: "100%", maxWidth: "900px", boxSizing: "border-box" }}>
                {pdfPages.map((pageSrc, pageIdx) => (
                  <div
                    key={pageIdx}
                    style={{
                      background: "#ffffff",
                      width: "100%",
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                    }}
                  >
                    {pdfPages.length > 1 && (
                      <div style={{
                        padding: "0.25rem 0.625rem",
                        background: "var(--accent)",
                        borderBottom: "1px solid var(--border)",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        textAlign: "right",
                      }}>
                        Página {pageIdx + 1} de {pdfPages.length}
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pageSrc}
                      alt={`Página ${pageIdx + 1}`}
                      style={{ width: "100%", height: "auto", display: "block", maxWidth: "100%" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
