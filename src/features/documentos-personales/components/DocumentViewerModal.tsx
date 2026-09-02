"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  X, ShareNetwork, Printer, PencilSimple,
  UploadSimple, FileText, Clock, PencilLine,
  MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsIn,
} from "@phosphor-icons/react"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
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
import { shareGeneratedPdf } from "@/shared/services/pdfShareBridge"

const TIPO_ICON: Record<DocTipo, typeof FileText> = {
  tarjeton: FileText,
  checadas: Clock,
  escrito: PencilLine,
}

const TIPO_COLOR: Record<DocTipo, string> = {
  tarjeton: "#3b82f6",
  checadas: "#22c55e",
  escrito: "#a855f7",
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
  return (
    <FullscreenPortal open={props.open} onClose={props.onClose} ariaLabel="Visor de documento">
      <DocumentViewerModalContent key={props.doc.id} {...props} doc={props.doc} />
    </FullscreenPortal>
  )
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

  // Limpieza de Object URLs de páginas y firmas
  const createdUrlsRef = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false
    const urlsToClean: string[] = []

    const loadContent = async () => {
      try {
        if (doc.kind === "escrito") {
          const currentUserId = userId ?? "anonymous"
          if (doc.escrito.firmaRef) {
            try {
              const fBlob = await getBlobResource(currentUserId, doc.escrito.firmaRef)
              if (!cancelled && fBlob) {
                const u = URL.createObjectURL(fBlob)
                urlsToClean.push(u)
                setFirmaUrl(u)
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
                    const u = URL.createObjectURL(aBlob)
                    urlsToClean.push(u)
                    loadedAnexos.push({
                      id: anx.id,
                      url: u,
                      nombre: anx.nombre,
                      descripcion: anx.descripcion,
                    })
                  }
                } catch {}
              }
            }
            if (!cancelled) setAnexosUrls(loadedAnexos)
          }

          try {
            const generatedFile = await escritoToPdfFile(doc.escrito, currentUserId, {
              nombre: profile?.fullName ?? undefined,
              matricula: profile?.matricula ?? undefined,
              categoria: profile?.categoria ?? undefined,
            })
            if (cancelled) return
            setCachedFile(generatedFile)

            // Renderizado vectorial real tamaño Carta usando PDF.js
            const buf = await generatedFile.arrayBuffer()
            if (cancelled) return

            const { loadPdfDocument } = await import("@/features/tarjeton/lib/pdfjs-client")
            const { pdf } = await loadPdfDocument(buf)
            if (cancelled) return

            const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2
            const renderScale = Math.min(Math.max(dpr, 2.0), 2.5)

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
              canvas.width = 0
              canvas.height = 0
            }

            if (!cancelled) {
              setPdfPages(pages)
              setLoading(false)
            }
          } catch (e) {
            if (!cancelled) {
              console.error("Error generando PDF de escrito:", e)
              setError("No se pudo generar el documento PDF Carta.")
              setLoading(false)
            }
          }
        } else {
          const file = await readNativeDocumentAsFile({
            name: doc.name,
            mimeType: doc.mimeType,
            localPath: doc.localPath,
          })
          if (cancelled) return
          if (!file) {
            setError("No se pudo leer el archivo del documento.")
            setLoading(false)
            return
          }

          setCachedFile(file)
          const buf = await file.arrayBuffer()
          if (cancelled) return

          const { loadPdfDocument } = await import("@/features/tarjeton/lib/pdfjs-client")
          const { pdf } = await loadPdfDocument(buf)
          if (cancelled) return

          // Calidad nítida y segura en memoria
          const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2
          const renderScale = Math.min(Math.max(dpr, 2.0), 2.5)

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
            // Liberar canvas
            canvas.width = 0
            canvas.height = 0
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
      for (const u of urlsToClean) {
        URL.revokeObjectURL(u)
      }
      for (const u of createdUrlsRef.current) {
        URL.revokeObjectURL(u)
      }
      createdUrlsRef.current = []
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
      // 1. Android Nativo con FileProvider para documentos locales existentes (tarjetones/checadas)
      if (doc.kind === "nativo" && doc.localPath && typeof window !== "undefined" && window.LaVeinteApp?.shareNativeDocument) {
        window.LaVeinteApp.shareNativeDocument(doc.localPath, docName)
        setIsSharing(false)
        return
      }

      const file = cachedFile
      if (!file) {
        setShareFeedback("El documento aún se está preparando...")
        setTimeout(() => setShareFeedback(null), 3000)
        setIsSharing(false)
        return
      }

      // 2. Función centralizada: maneja nativa+bridge, nativa+sin-bridge, y web
      const outcome = await shareGeneratedPdf(file, docName)

      if (outcome.status === "error") {
        setShareFeedback(outcome.message)
        setTimeout(() => setShareFeedback(null), 4000)
      } else if (outcome.status === "update_required") {
        setShareFeedback(outcome.message)
        setTimeout(() => setShareFeedback(null), 5000)
      } else if (outcome.status === "ok") {
        // Web: mostrar feedback de descarga iniciada
        if (typeof window !== "undefined" && !window.LaVeinteApp?.isNativeApp?.()) {
          setShareFeedback("Descarga iniciada.")
          setTimeout(() => setShareFeedback(null), 3000)
        }
      }
      // "aborted" → el usuario canceló, no mostramos nada
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error al compartir:", err)
        setShareFeedback("No se pudo compartir el documento.")
        setTimeout(() => setShareFeedback(null), 3500)
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
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        color: "#f8fafc",
        overflow: "hidden",
        position: "relative",
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
          padding: 0 0.5rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(30, 41, 59, 0.9);
          color: #f1f5f9;
          cursor: pointer;
          flex-shrink: 0;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .doc-viewer-action-btn:hover {
          background: rgba(51, 65, 85, 0.95);
          border-color: rgba(255, 255, 255, 0.25);
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
          background: rgba(15, 23, 42, 0.92);
          color: #ffffff;
          padding: 0.35rem 0.6rem;
          border-radius: 2rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          z-index: 50;
          border: 1px solid rgba(255,255,255,0.2);
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

      {/* Barra de cabecera superior compacta */}
      <header
        style={{
          width: "100%",
          padding: "max(0.5rem, env(safe-area-inset-top, 0px)) 0.75rem 0.5rem",
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          flexShrink: 0,
          boxSizing: "border-box",
          zIndex: 10,
          backdropFilter: "blur(10px)",
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
              background: `${color}25`,
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
                color: "#f8fafc",
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
                color: "#94a3b8",
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

          {/* Imprimir / Transferir mediante QR */}
          <button
            onClick={() => onSendPrint(doc)}
            title="Escanear QR para imprimir en oficina sindical"
            aria-label="Imprimir"
            className="doc-viewer-action-btn"
            style={{
              background: "var(--primary)",
              color: "#ffffff",
              borderColor: "transparent",
            }}
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
                color: "#a855f7",
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
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)", margin: "0 0.125rem" }} />

          {/* Botón Cerrar (Esquina superior derecha) */}
          <button
            onClick={onClose}
            aria-label="Cerrar visor"
            title="Cerrar visor"
            className="doc-viewer-action-btn"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              width: 34,
              height: 34,
              padding: 0,
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </header>

      {/* Notificación de feedback al compartir */}
      {shareFeedback && (
        <div
          style={{
            position: "absolute",
            top: "max(60px, calc(env(safe-area-inset-top, 0px) + 54px))",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            zIndex: 60,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            textAlign: "center",
            maxWidth: "90vw",
          }}
        >
          {shareFeedback}
        </div>
      )}

      {/* Controles Flotantes de Zoom */}
      {!loading && !error && (
        <div
          style={{
            position: "fixed",
            bottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
            right: "1.25rem",
            zIndex: 60,
          }}
        >
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

      {/* Área Principal de Visualización con Scroll Vertical Real */}
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
          background: "#0f172a",
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
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              color: "#fca5a5",
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

        {/* Contenedor de Documento con Transformación de Zoom y Paneo */}
        {!loading && !error && (
          <div
            ref={contentWrapperRef}
            style={{
              width: "100%",
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "0 0 max(2rem, env(safe-area-inset-bottom, 0px))",
              margin: 0,
              boxSizing: "border-box",
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center top",
              transition: isInteracting ? "none" : "transform 0.15s ease-out",
              willChange: "transform",
            }}
          >
            {/* Renderizado de Páginas PDF Reales (Escritos Tamaño Carta, Tarjetón y Checadas) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center", width: "100%", maxWidth: "900px", boxSizing: "border-box" }}>
              {pdfPages.map((pageSrc, pageIdx) => (
                <div
                  key={pageIdx}
                  style={{
                    background: "#ffffff",
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  {pdfPages.length > 1 && (
                    <div style={{
                      padding: "0.35rem 0.75rem",
                      background: "#1e293b",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "#94a3b8",
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
          </div>
        )}
      </main>
    </div>
  )
}
