"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsIn,
} from "@phosphor-icons/react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

export interface PdfFileViewerProps {
  file: File | Blob
  initialScale?: number
  onLoadSuccess?: (numPages: number) => void
  onError?: (error: Error) => void
}

export function PdfFileViewer({
  file,
  initialScale = 1.0,
  onLoadSuccess,
  onError,
}: PdfFileViewerProps) {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [zoomScale, setZoomScale] = useState(initialScale)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
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
    setLoading(true)
    setErrorMsg(null)

    const renderPages = async () => {
      try {
        const buffer = await file.arrayBuffer()
        if (cancelled) return

        const { loadPdfDocument } = await import("@/features/tarjeton/lib/pdfjs-client")
        const { pdf } = await loadPdfDocument(buffer)
        if (cancelled) return

        onLoadSuccess?.(pdf.numPages)

        const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2
        const renderScale = Math.min(Math.max(dpr, 2.0), 2.5)

        const images: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: renderScale })
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const ctx = canvas.getContext("2d")
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise
            images.push(canvas.toDataURL("image/png"))
          }
          canvas.width = 0
          canvas.height = 0
        }

        if (!cancelled) {
          setPageImages(images)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[PdfFileViewer] Error renderizando documento PDF:", err)
          const error = err instanceof Error ? err : new Error("No se pudo procesar el archivo PDF.")
          setErrorMsg(error.message)
          onError?.(error)
          setLoading(false)
        }
      }
    }

    void renderPages()

    return () => {
      cancelled = true
    }
  }, [file, onLoadSuccess, onError])

  // --- Controles de Zoom ---
  const zoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 3.5))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 1)
      if (next <= 1.05) setPanOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  const resetZoom = useCallback(() => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // --- Gestos Táctiles (Pinch to Zoom & Doble Toque) ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
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
        touchStateRef.current.isPanning = true
        touchStateRef.current.startX = e.touches[0].clientX
        touchStateRef.current.startY = e.touches[0].clientY
        touchStateRef.current.initialPanX = panOffset.x
        touchStateRef.current.initialPanY = panOffset.y
        setIsInteracting(true)
      }
    },
    [zoomScale, panOffset]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStateRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault()
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        if (touchStateRef.current.initialDist > 0) {
          const ratio = dist / touchStateRef.current.initialDist
          const targetScale = Math.min(
            Math.max(touchStateRef.current.initialScale * ratio, 1),
            3.5
          )
          setZoomScale(Number(targetScale.toFixed(2)))
        }
      } else if (touchStateRef.current.isPanning && e.touches.length === 1 && zoomScale > 1.05) {
        e.preventDefault()
        const dx = e.touches[0].clientX - touchStateRef.current.startX
        const dy = e.touches[0].clientY - touchStateRef.current.startY
        const maxPanX = (window.innerWidth * (zoomScale - 1)) / 2
        const maxPanY = (window.innerHeight * (zoomScale - 1)) / 2
        setPanOffset({
          x: Math.max(-maxPanX, Math.min(maxPanX, touchStateRef.current.initialPanX + dx)),
          y: Math.max(-maxPanY, Math.min(maxPanY, touchStateRef.current.initialPanY + dy)),
        })
      }
    },
    [zoomScale]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStateRef.current.isPinching || touchStateRef.current.isPanning) {
        touchStateRef.current.isPinching = false
        touchStateRef.current.isPanning = false
        setIsInteracting(false)
        if (zoomScale <= 1.05) {
          setZoomScale(1)
          setPanOffset({ x: 0, y: 0 })
        }
      }

      const now = Date.now()
      if (now - touchStateRef.current.lastTouchEnd < 300) {
        e.preventDefault()
        if (zoomScale > 1.05) {
          resetZoom()
        } else {
          setZoomScale(2)
          setPanOffset({ x: 0, y: 0 })
        }
      }
      touchStateRef.current.lastTouchEnd = now
    },
    [zoomScale, resetZoom]
  )

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "100vw",
        minHeight: "100%",
        position: "relative",
        background: "var(--bg)",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .pdf-zoom-floating-pill {
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
        .pdf-zoom-floating-pill button {
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
        .pdf-zoom-floating-pill button:active {
          transform: scale(0.9);
        }
      `}</style>

      {/* Controles Flotantes de Zoom */}
      {!loading && !errorMsg && pageImages.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
            right: "1.25rem",
            zIndex: 60,
          }}
        >
          <div className="pdf-zoom-floating-pill">
            <button
              onClick={zoomOut}
              disabled={zoomScale <= 1}
              title="Reducir zoom"
              aria-label="Reducir zoom"
            >
              <MagnifyingGlassMinus size={18} weight="bold" />
            </button>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, minWidth: "36px", textAlign: "center" }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoomScale >= 3.5}
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
            >
              <MagnifyingGlassPlus size={18} weight="bold" />
            </button>
            {zoomScale > 1 && (
              <button
                onClick={resetZoom}
                title="Restablecer tamaño original"
                aria-label="Restablecer"
              >
                <ArrowsIn size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: "4rem 1rem", display: "flex", justifyContent: "center", margin: "auto" }}>
          <LoadingSpinner text="Cargando documento PDF…" />
        </div>
      )}

      {errorMsg && !loading && (
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
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem" }}>{errorMsg}</p>
        </div>
      )}

      {/* Páginas renderizadas verticalmente */}
      {!loading && !errorMsg && (
        <div
          ref={contentWrapperRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
            padding: "1rem 0.5rem max(2.5rem, env(safe-area-inset-bottom, 0px))",
            boxSizing: "border-box",
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
            transformOrigin: "center top",
            transition: isInteracting ? "none" : "transform 0.15s ease-out",
            willChange: "transform",
            touchAction: zoomScale > 1.05 ? "none" : "pan-y",
          }}
        >
          {pageImages.map((pageSrc, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--card)",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
                maxWidth: "850px",
                width: "100%",
                overflow: "hidden",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <img
                src={pageSrc}
                alt={`Página ${idx + 1}`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
