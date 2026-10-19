"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react"
import { loadPdfDocument } from "../lib/pdfjs-client"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

interface Props {
  documentId: string
  initialPage?: number
  officialUrl?: string | null
}

export function PdfViewer({ documentId, initialPage = 1, officialUrl = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(initialPage)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)

  const url = `/api/normativa/visor?id=${encodeURIComponent(documentId)}`

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(url)
        if (cancelled) return
        if (!res.ok) {
          throw new Error(`Código HTTP ${res.status}`)
        }
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const loaded = await loadPdfDocument(buf)
        if (cancelled) {
          void loaded.loadingTask.destroy()
          return
        }
        pdfRef.current = loaded
        setNumPages(loaded.pdf.numPages)
        setLoading(false)
        setError(null)
      } catch (e) {
        if (!cancelled) {
          console.warn("[PdfViewer] Error cargando PDF:", e)
          setError(e instanceof Error ? e.message : "Error al procesar el archivo")
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      void pdfRef.current?.loadingTask.destroy()
      pdfRef.current = null
    }
  }, [url, retryCount])

  useEffect(() => {
    const pdf = pdfRef.current
    if (!pdf) return
    let cancelled = false

    void pdf.pdf.getPage(page).then(async (p) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const viewport = p.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      await p.render({ canvas, canvasContext: ctx, viewport }).promise
    })

    return () => {
      cancelled = true
    }
  }, [page, numPages, scale])

  return (
    <div style={containerStyle}>
      {/* BARRA DE HERRAMIENTAS DEL VISOR PDF */}
      <div style={toolbarStyle}>
        {numPages > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={toolbarBtn}
              title="Página anterior"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "0.8rem", color: "#f8fafc", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              Pág.
              <input
                type="number"
                min={1}
                max={numPages}
                value={page}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 1 && v <= numPages) setPage(v)
                }}
                style={pageInputStyle}
                aria-label="Número de página"
              />
              de {numPages}
            </span>
            <button
              type="button"
              disabled={page >= numPages}
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              style={toolbarBtn}
              title="Página siguiente"
              aria-label="Página siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
            {loading ? "Cargando documento..." : "Visor Oficial PDF"}
          </div>
        )}

        {/* CONTROLES DE ZOOM Y ACCIONES */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          {numPages > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginRight: "0.35rem" }}>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.8, Number((s - 0.2).toFixed(1))))}
                style={toolbarBtn}
                title="Alejar (Zoom -)"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: "0.75rem", color: "#cbd5e1", minWidth: 38, textAlign: "center" }}>
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(1))))}
                style={toolbarBtn}
                title="Acercar (Zoom +)"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          )}

          <a
            href={url}
            target="_blank"
            download
            style={{ ...toolbarBtn, textDecoration: "none", color: "#f8fafc" }}
            title="Descargar archivo PDF original"
          >
            <Download size={14} />
            <span>Descargar</span>
          </a>

          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...toolbarBtn, textDecoration: "none", color: "#93c5fd" }}
              title="Abrir en repositorio oficial IMSS / DOF"
            >
              <ExternalLink size={14} />
              <span>Portal oficial</span>
            </a>
          )}
        </div>
      </div>

      {/* ÁREA DE VISUALIZACIÓN DEL DOCUMENTO */}
      <div style={viewportStyle}>
        {loading ? (
          <div style={{ padding: "4rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <LoadingSpinner text="Abriendo documento oficial completo..." />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#f8fafc", maxWidth: 480, margin: "auto" }}>
            <p style={{ fontWeight: 700, fontSize: "1.05rem", margin: "0 0 0.5rem", color: "#f8fafc" }}>
              Visualización directa del documento oficial
            </p>
            <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
              No se pudo renderizar la vista previa en el navegador, pero el archivo oficial está completamente disponible para consulta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center", width: "100%" }}>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  padding: "0.6rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  width: "100%",
                  maxWidth: 320,
                }}
              >
                <RotateCw size={15} />
                Reintentar carga del visor
              </button>

              {officialUrl && (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    padding: "0.65rem 1.25rem",
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: "var(--radius)",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    width: "100%",
                    maxWidth: 320,
                  }}
                >
                  <ExternalLink size={16} />
                  Abrir en portal oficial (IMSS / DOF)
                </a>
              )}

              <a
                href={url}
                target="_blank"
                download
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  padding: "0.6rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#f8fafc",
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  width: "100%",
                  maxWidth: 320,
                }}
              >
                <Download size={15} />
                Descargar copia oficial PDF
              </a>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "1.25rem 0.5rem" }}>
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: "100%",
                height: "auto",
                background: "#fff",
                borderRadius: 4,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#0f172a",
  overflow: "hidden",
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  padding: "0.45rem 0.85rem",
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  flexWrap: "wrap",
  flexShrink: 0,
}

const viewportStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  height: "100%",
  overflow: "auto",
  background: "#1e293b",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  WebkitOverflowScrolling: "touch",
}

const toolbarBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.35rem 0.6rem",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 600,
}

const pageInputStyle: CSSProperties = {
  width: 52,
  padding: "0.2rem 0.35rem",
  borderRadius: 4,
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "rgba(255, 255, 255, 0.1)",
  color: "#fff",
  textAlign: "center",
  fontSize: "0.8rem",
  fontWeight: 600,
}

