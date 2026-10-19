"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react"
import { loadPdfDocument } from "../lib/pdfjs-client"

interface Props {
  documentId: string
  initialPage?: number
  officialUrl?: string | null
}

export function PdfViewer({ documentId, initialPage = 1, officialUrl = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(initialPage)
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)

  const url = `/api/normativa/visor?id=${encodeURIComponent(documentId)}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(url)
        if (cancelled) return
        if (!res.ok) {
          setError("No se pudo cargar el original local.")
          return
        }
        const buf = await res.arrayBuffer()
        const loaded = await loadPdfDocument(buf)
        if (cancelled) {
          void loaded.loadingTask.destroy()
          return
        }
        pdfRef.current = loaded
        setNumPages(loaded.pdf.numPages)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al abrir el documento")
      }
    })()
    return () => {
      cancelled = true
      void pdfRef.current?.loadingTask.destroy()
      pdfRef.current = null
    }
  }, [url])

  useEffect(() => {
    const pdf = pdfRef.current
    if (!pdf) return
    let cancelled = false
    void pdf.pdf.getPage(page).then(async (p) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const viewport = p.getViewport({ scale: 1.4 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      await p.render({ canvas, canvasContext: ctx, viewport }).promise
    })
    return () => {
      cancelled = true
    }
  }, [page, numPages])

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={navBtn}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: "0.8rem" }}>
          Página <input
            type="number"
            min={1}
            max={numPages}
            value={page}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v >= 1 && v <= numPages) setPage(v)
            }}
            style={{ width: 56, padding: "0.2rem", borderRadius: 6, border: "1px solid var(--border)", textAlign: "center" }}
          /> de {numPages}
        </span>
        <button disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))} style={navBtn}>
          <ChevronRight size={16} />
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...navBtn, textDecoration: "none", marginLeft: "auto" }}>
          <Download size={16} /> Original
        </a>
      </div>
      <div style={{ overflow: "auto", background: "#334155", padding: "1.25rem", display: "flex", justifyContent: "center" }}>
        {error ? (
          <div style={{ textAlign: "center", padding: "1.5rem 1rem", color: "#f8fafc", maxWidth: 440 }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 0.5rem", color: "#f8fafc" }}>
              Facsímil PDF no precargado en el servidor
            </p>
            <p style={{ fontSize: "0.825rem", color: "#cbd5e1", lineHeight: 1.45, margin: 0 }}>
              Puedes consultar la <strong>Guía y Resumen</strong> con los puntos operativos y derechos clave, o abrir el documento directamente en el repositorio oficial con el botón de abajo.
            </p>
            {officialUrl && (
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  marginTop: "1rem",
                  padding: "0.55rem 1rem",
                  background: "var(--primary)",
                  color: "#fff",
                  borderRadius: "var(--radius)",
                  fontSize: "0.825rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={15} />
                Abrir documento en repositorio oficial (IMSS / DOF)
              </a>
            )}
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto", background: "#fff", borderRadius: 4 }} />
        )}
      </div>
      <div style={{ padding: "0.4rem 0.6rem", fontSize: "0.7rem", color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        Copia local utilizada por la Biblioteca Normativa. El original oficial se conserva sin modificaciones (SHA-256 registrado).
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.3rem",
  padding: "0.35rem 0.6rem", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", background: "var(--card)",
  color: "var(--fg)", cursor: "pointer", fontSize: "0.8rem",
}
