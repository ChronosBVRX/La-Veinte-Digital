"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  X, ShareNetwork, Printer, PencilSimple,
  UploadSimple, FileText, Clock, PencilLine,
  MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsIn,
  DownloadSimple, Trash,
} from "@phosphor-icons/react"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  grupoLabel, formatBytes, formatFecha, formatFechaEscrito,
  type DocumentoPersonalItem,
  type DocTipo,
  type UnifiedViewerDocument,
} from "../lib/documents"
import {
  resolveViewerDocument,
  type ViewerDocument,
} from "../services/document-viewer-adapter"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { shareGeneratedPdf } from "@/shared/services/pdfShareBridge"

export type { UnifiedViewerDocument, ViewerDocument }

const TIPO_ICON: Record<string, typeof FileText> = {
  tarjeton: FileText,
  checadas: Clock,
  checada: Clock,
  escrito: PencilLine,
  documento: FileText,
}

const TIPO_COLOR: Record<string, string> = {
  tarjeton: "#3b82f6",
  checadas: "#22c55e",
  checada: "#22c55e",
  escrito: "#a855f7",
  documento: "#64748b",
}

export interface DocumentViewerModalProps<
  T extends DocumentoPersonalItem | UnifiedViewerDocument | ViewerDocument =
    | DocumentoPersonalItem
    | UnifiedViewerDocument
    | ViewerDocument
> {
  open: boolean
  doc: T | null
  userId?: string | null
  profile?: TarjetonProfileSnapshot | null
  onClose: () => void
  onSendPrint?: (doc: T) => void
  onImportTarjeton?: (doc: T) => void
  onDelete?: (doc: T) => void
  onDownload?: (doc: T) => void
}

export function DocumentViewerModal<
  T extends DocumentoPersonalItem | UnifiedViewerDocument | ViewerDocument =
    | DocumentoPersonalItem
    | UnifiedViewerDocument
    | ViewerDocument
>(props: DocumentViewerModalProps<T>) {
  const { open, onClose, doc } = props

  // Interceptar botón atrás de Android / navegador para cerrar primero el visor
  // Manejo de historial para botón atrás en Android sin duplicar el listener de FullscreenPortal
  useEffect(() => {
    if (!open) return
    const stateKey = `modal-viewer-${Date.now()}`
    window.history.pushState({ modal: stateKey }, "")
    let closedByPop = false

    const handlePopState = () => {
      closedByPop = true
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (!closedByPop && window.history.state?.modal === stateKey) {
        window.history.back()
      }
    }
  }, [open])

  if (!open || !doc) return null
  return (
    <FullscreenPortal open={open} onClose={onClose} ariaLabel="Visor de documento">
      <DocumentViewerModalContent
        key={doc.id}
        {...props}
        doc={doc}
        onSendPrint={props.onSendPrint as ((d: unknown) => void) | undefined}
        onImportTarjeton={props.onImportTarjeton as ((d: unknown) => void) | undefined}
        onDelete={props.onDelete as ((d: unknown) => void) | undefined}
        onDownload={props.onDownload as ((d: unknown) => void) | undefined}
      />
    </FullscreenPortal>
  )
}

interface DocumentViewerModalContentProps extends Omit<DocumentViewerModalProps, "doc"> {
  doc: DocumentoPersonalItem | UnifiedViewerDocument | ViewerDocument
}

function DocumentViewerModalContent({
  doc: rawDoc,
  userId,
  profile,
  onClose,
  onSendPrint,
  onImportTarjeton,
  onDelete,
  onDownload,
}: DocumentViewerModalContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [cachedFile, setCachedFile] = useState<File | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  const rawType =
    ("sourceType" in rawDoc && rawDoc.sourceType
      ? rawDoc.sourceType
      : ("tipo" in rawDoc
      ? rawDoc.tipo
      : ("type" in rawDoc
      ? rawDoc.type
      : "documento"))) as string

  const normalizedType = rawType === "checadas" ? "checada" : rawType
  const Icon = TIPO_ICON[normalizedType] || FileText
  const color = TIPO_COLOR[normalizedType] || "#3b82f6"
  const docName =
    ("name" in rawDoc && rawDoc.name ? String(rawDoc.name) : undefined) ||
    ("titulo" in rawDoc && rawDoc.titulo ? String(rawDoc.titulo) : "Documento")

  // Limpieza de Object URLs de páginas y firmas
  const createdUrlsRef = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false
    const urlsToClean: string[] = []

    const loadContent = async () => {
      setLoading(true)
      setError(null)

      try {
        let viewerDoc: ViewerDocument
        if ("renderUrl" in rawDoc && rawDoc.renderUrl && "sourceType" in rawDoc && rawDoc.sourceType) {
          viewerDoc = rawDoc as ViewerDocument
        } else {
          viewerDoc = await resolveViewerDocument(rawDoc, userId ?? "anonymous", profile)
        }

        if (cancelled) return

        const mime = viewerDoc.mimeType || "application/pdf"

        // Caso 1: Imágenes (PNG, JPG, WebP)
        if (mime.startsWith("image/")) {
          setPdfPages([viewerDoc.renderUrl])
          setLoading(false)
          return
        }

        // Caso 2: Documentos PDF
        let fileToRender: File | Blob | null = viewerDoc.file || null
        if (!fileToRender && viewerDoc.renderUrl) {
          try {
            const res = await fetch(viewerDoc.renderUrl)
            fileToRender = await res.blob()
          } catch {}
        }

        if (fileToRender) {
          const buf = await fileToRender.arrayBuffer()
          if (cancelled) return

          setCachedFile(
            fileToRender instanceof File
              ? fileToRender
              : new File([fileToRender], viewerDoc.name, { type: "application/pdf" })
          )

          try {
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
          } catch (pdfErr) {
            if (!cancelled) {
              console.warn("[DocumentViewerModal] Fallback a renderUrl:", pdfErr)
              if (viewerDoc.renderUrl) {
                setPdfPages([viewerDoc.renderUrl])
                setLoading(false)
              } else {
                throw pdfErr
              }
            }
          }
        } else {
          // Fallback a renderUrl directo si existe
          if (viewerDoc.renderUrl) {
            setPdfPages([viewerDoc.renderUrl])
            setLoading(false)
          } else {
            throw new Error("No se pudo obtener el archivo del documento para renderizar.")
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando vista previa en DocumentViewerModal:", err)
          setError(err instanceof Error ? err.message : "No se pudo generar la vista previa del documento.")
          setLoading(false)
        }
      }
    }

    void loadContent()

    return () => {
      cancelled = true
      for (const u of urlsToClean) {
        try {
          URL.revokeObjectURL(u)
        } catch {}
      }
      for (const u of createdUrlsRef.current) {
        try {
          URL.revokeObjectURL(u)
        } catch {}
      }
      createdUrlsRef.current = []
    }
  }, [rawDoc.id, userId])
  const createdAt = "createdAt" in rawDoc ? rawDoc.createdAt : ("fecha" in rawDoc ? rawDoc.fecha : undefined)
  const fileSize = "fileSize" in rawDoc ? rawDoc.fileSize : undefined
  const localPath = "localPath" in rawDoc ? rawDoc.localPath : undefined
  const sourceUri = "sourceUri" in rawDoc ? rawDoc.sourceUri : ("renderUrl" in rawDoc ? rawDoc.renderUrl : undefined)

  const metaDate = createdAt
    ? (typeof createdAt === "number" ? formatFecha(createdAt) : formatFechaEscrito(String(createdAt)))
    : ""
  const metaSize = fileSize ? formatBytes(fileSize) : ""
  const meta = [metaSize, metaDate].filter(Boolean).join("  ·  ") || "Documento"

  const handleShare = async () => {
    setIsSharing(true)
    setShareFeedback(null)
    try {
      // 1. Android Nativo con FileProvider para documentos locales existentes (tarjetones/checadas)
      if (localPath && typeof window !== "undefined" && window.LaVeinteApp?.shareNativeDocument) {
        window.LaVeinteApp.shareNativeDocument(localPath, docName)
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

  const handleDownload = () => {
    if (onDownload) {
      onDownload(rawDoc)
      return
    }
    if (!cachedFile && !sourceUri) {
      setShareFeedback("El documento aún se está preparando...")
      setTimeout(() => setShareFeedback(null), 3000)
      return
    }

    let downloadUrl = ""
    let shouldRevoke = false

    if (cachedFile) {
      downloadUrl = URL.createObjectURL(cachedFile)
      shouldRevoke = true
    } else if (sourceUri) {
      downloadUrl = sourceUri
    }

    if (!downloadUrl) return

    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = docName.endsWith(".pdf") ? docName : `${docName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000)
    }
    setShareFeedback("Descarga iniciada.")
    setTimeout(() => setShareFeedback(null), 3000)
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
              <span style={{ fontWeight: 600, color }}>{grupoLabel(normalizedType as DocTipo)}</span> · {meta}
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

          {/* Descargar */}
          <button
            onClick={handleDownload}
            title="Descargar documento"
            aria-label="Descargar"
            className="doc-viewer-action-btn"
          >
            <DownloadSimple size={16} weight="bold" />
            <span className="doc-viewer-btn-label">Descargar</span>
          </button>

          {/* Imprimir / Transferir mediante QR */}
          {onSendPrint && (
            <button
              onClick={() => onSendPrint(rawDoc)}
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
          )}

          {/* Editar (si es escrito) */}
          {normalizedType === "escrito" && (
            <Link
              href={`/escritos?id=${rawDoc.id}`}
              title="Editar escrito"
              aria-label="Editar"
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
          {normalizedType === "tarjeton" && onImportTarjeton && (
            <button
              onClick={() => onImportTarjeton(rawDoc)}
              title="Exportar datos al perfil laboral"
              aria-label="Exportar al perfil"
              className="doc-viewer-action-btn"
            >
              <UploadSimple size={16} weight="bold" />
              <span className="doc-viewer-btn-label">Exportar</span>
            </button>
          )}

          {/* Eliminar */}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Eliminar documento"
              aria-label="Eliminar"
              className="doc-viewer-action-btn"
              style={{ color: "#ef4444" }}
            >
              <Trash size={16} weight="bold" />
              <span className="doc-viewer-btn-label">Eliminar</span>
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

      {/* Diálogo modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              color: "#f8fafc",
            }}
          >
            <h3
              id="delete-dialog-title"
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.0625rem",
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              ¿Eliminar este documento?
            </h3>
            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.875rem",
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              Esta acción eliminará <strong>{docName}</strong> de tu dispositivo. No se podrá recuperar.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </Button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onDelete?.(rawDoc)
                  onClose()
                }}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
