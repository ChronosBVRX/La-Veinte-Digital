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
  BookmarkCheck,
} from "lucide-react"
import { loadPdfDocument } from "@/shared/lib/pdfjs-client"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  saveNormativaToVault,
  isNormativaInVault,
} from "@/features/documentos-personales/services/normativa-boveda"

export interface PdfViewerProps {
  documentId: string
  initialPage?: number
  officialUrl?: string | null
  title?: string
  keyLabel?: string
  category?: string
}

export function PdfViewer({
  documentId,
  initialPage = 1,
  officialUrl = null,
  title,
  keyLabel,
  category,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(initialPage)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [docType, setDocType] = useState<"pdf" | "html">("pdf")
  const [htmlContent, setHtmlContent] = useState<string>("")
  const [inVault, setInVault] = useState(() => isNormativaInVault(documentId))
  const [vaultToast, setVaultToast] = useState<string | null>(null)
  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)

  const url = `/api/normativa/visor?id=${encodeURIComponent(documentId)}`

  // Sincronizar estado de la bóveda mediante evento
  useEffect(() => {
    const onVaultChange = () => {
      setInVault(isNormativaInVault(documentId))
    }
    window.addEventListener("lvd:normativa-vault-changed", onVaultChange)
    return () => window.removeEventListener("lvd:normativa-vault-changed", onVaultChange)
  }, [documentId])

  const handleSaveToVault = () => {
    saveNormativaToVault({
      id: documentId,
      title: title || documentId,
      key: keyLabel,
      category,
      url: officialUrl,
    })
    setInVault(true)
    setVaultToast("¡Guardado en tu Bóveda (Pestaña Normativos)!")
    setTimeout(() => setVaultToast(null), 3500)
  }

  const handleDownloadAndSave = () => {
    saveNormativaToVault({
      id: documentId,
      title: title || documentId,
      key: keyLabel,
      category,
      url: officialUrl,
    })
    setInVault(true)
    setVaultToast("¡Descargando y registrado en tu Bóveda!")
    setTimeout(() => setVaultToast(null), 3500)
  }

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

        // Detección de formato PDF vs HTML
        const firstBytes = new Uint8Array(buf.slice(0, 5))
        const isPdfMagic =
          firstBytes[0] === 0x25 &&
          firstBytes[1] === 0x50 &&
          firstBytes[2] === 0x44 &&
          firstBytes[3] === 0x46 // %PDF

        const formatHeader = res.headers.get("X-Normativa-Format")
        const contentType = res.headers.get("Content-Type") || ""
        const isHtml = formatHeader === "html" || contentType.includes("html") || !isPdfMagic

        if (isHtml) {
          const text = new TextDecoder("utf-8").decode(buf)
          setDocType("html")
          setHtmlContent(text)
          setLoading(false)
          setError(null)
          return
        }

        setDocType("pdf")
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
          console.warn("[PdfViewer] Error cargando documento:", e)
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
    if (docType !== "pdf") return
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
  }, [page, numPages, scale, docType])

  return (
    <div style={containerStyle}>
      {/* Toast de guardado en bóveda */}
      {vaultToast && (
        <div style={vaultToastStyle}>
          <BookmarkCheck size={16} color="#10b981" />
          <span>{vaultToast}</span>
        </div>
      )}

      {/* BARRA DE HERRAMIENTAS DEL VISOR PDF - COMPACTA (1 SOLA FILA) */}
      <div style={toolbarStyle}>
        {/* Paginación */}
        {docType === "pdf" && numPages > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
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
            <span style={{ fontSize: "0.75rem", color: "#f8fafc", padding: "0 0.15rem", whiteSpace: "nowrap" }}>
              {page}/{numPages}
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
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
            {loading ? "Cargando..." : docType === "html" ? "Documento Oficial DOF" : "Visor Oficial"}
          </span>
        )}

        {/* CONTROLES DE ZOOM Y PANTALLA AMPLIA */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.7, Number((s - 0.2).toFixed(1))))}
            style={toolbarBtn}
            title="Alejar (Zoom -)"
            aria-label="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => setScale(1.3)}
            style={{ ...toolbarBtn, minWidth: 42, fontSize: "0.72rem", padding: "0.25rem 0.35rem" }}
            title="Restablecer zoom al 130%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))))}
            style={toolbarBtn}
            title="Acercar (Zoom +)"
            aria-label="Acercar"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* ACCIONES: GUARDAR EN BÓVEDA Y DESCARGAR */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSaveToVault}
            style={{
              ...toolbarBtn,
              background: inVault ? "rgba(16, 185, 129, 0.2)" : "rgba(37, 99, 235, 0.25)",
              color: inVault ? "#34d399" : "#93c5fd",
              borderColor: inVault ? "rgba(16, 185, 129, 0.4)" : "rgba(37, 99, 235, 0.4)",
            }}
            title={inVault ? "Documento guardado en tu Bóveda" : "Guardar en tu Bóveda de Documentos"}
          >
            <BookmarkCheck size={14} />
            <span>{inVault ? "En Bóveda" : "Bóveda"}</span>
          </button>

          <a
            href={url}
            target="_blank"
            download
            onClick={handleDownloadAndSave}
            style={{ ...toolbarBtn, textDecoration: "none", color: "#f8fafc" }}
            title="Descargar copia oficial a tu dispositivo y registrar en tu Bóveda"
          >
            <Download size={14} />
          </a>

          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...toolbarBtn, textDecoration: "none", color: "#94a3b8" }}
              title="Abrir en portal gubernamental oficial"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* ÁREA DE VISUALIZACIÓN DEL DOCUMENTO - PANTALLA MÁS AMPLIA */}
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
                onClick={handleDownloadAndSave}
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
                Descargar copia oficial a mi Bóveda
              </a>
            </div>
          </div>
        ) : docType === "html" ? (
          <div style={{ width: "100%", height: "100%", background: "#fff", flex: 1, display: "flex", flexDirection: "column" }}>
            <iframe
              srcDoc={htmlContent}
              sandbox="allow-same-origin"
              title="Documento Oficial DOF"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                flex: 1,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              padding: "0.25rem 0",
              minHeight: "100%",
              overflow: "auto",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: scale <= 1.3 ? "100%" : "none",
                height: "auto",
                background: "#fff",
                borderRadius: 2,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                display: "block",
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
  position: "relative",
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.4rem",
  padding: "0.45rem 0.65rem",
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  flexWrap: "nowrap",
  overflowX: "auto",
  scrollbarWidth: "none",
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
  justifyContent: "center",
  gap: "0.25rem",
  padding: "0.3rem 0.5rem",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 600,
  flexShrink: 0,
}

const vaultToastStyle: CSSProperties = {
  position: "absolute",
  top: "3rem",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 50,
  background: "#0f172a",
  border: "1px solid rgba(16, 185, 129, 0.4)",
  color: "#f8fafc",
  padding: "0.45rem 0.9rem",
  borderRadius: 999,
  fontSize: "0.8rem",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5)",
  animation: "fadeIn 0.2s ease",
}
