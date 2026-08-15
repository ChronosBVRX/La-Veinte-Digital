"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { X, ExternalLink, FileText } from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { PdfViewer } from "./PdfViewer"

interface Props {
  doc: LibraryDocumentEntry
  onClose: () => void
}

interface CitationRow {
  id: number
  pdf_page: number | null
  printed_page: string | null
  section_label: string | null
  article: string | null
  clause: string | null
  text: string
}

interface DocDetailData {
  document: Record<string, unknown>
  versions: Array<Record<string, unknown>>
  currentVersion: Record<string, unknown> | null
  citations: CitationRow[] | null
}

export function DocumentDetail({ doc, onClose }: Props) {
  const [detail, setDetail] = useState<DocDetailData | null>(null)
  const [openPage, setOpenPage] = useState(1)
  const [showViewer, setShowViewer] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/normativa/document?id=${encodeURIComponent(doc.id)}&citations=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setDetail(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [doc.id])

  const goToCitation = (page: number | null) => {
    if (!page) return
    setOpenPage(page)
    setShowViewer(true)
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{doc.title}</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              {doc.id} {doc.key ? `· Clave ${doc.key}` : ""} · {doc.organization.join(", ")}
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.75rem" }}>
          <span style={kvStyle}>Validez: <strong>{doc.validity}</strong></span>
          <span style={kvStyle}>Procedencia: <strong>{doc.provenance}</strong></span>
          {doc.versionLabel && <span style={kvStyle}>Versión: <strong>{doc.versionLabel}</strong></span>}
          {doc.effectiveFrom && <span style={kvStyle}>Desde: <strong>{doc.effectiveFrom}</strong></span>}
          {doc.effectiveUntil && <span style={kvStyle}>Hasta: <strong>{doc.effectiveUntil}</strong></span>}
          {doc.lastReformDate && <span style={kvStyle}>Última reforma: <strong>{doc.lastReformDate}</strong></span>}
          {doc.sha256 && (
            <span style={kvStyle}>
              SHA-256: <code style={{ fontSize: "0.72rem" }}>{doc.sha256}</code>
            </span>
          )}
        </div>

        {doc.warning && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.6rem" }}>
            {doc.warning}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
          <button style={primaryBtn} onClick={() => { setOpenPage(1); setShowViewer(true) }}>
            <FileText size={15} /> Abrir original local
          </button>
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtn, textDecoration: "none" }}>
              <ExternalLink size={15} /> Fuente oficial
            </a>
          )}
        </div>

        {showViewer && (
          <div style={{ marginTop: "0.9rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <PdfViewer documentId={doc.id} initialPage={openPage} />
          </div>
        )}

        {detail?.citations && detail.citations.length > 0 && (
          <div style={{ marginTop: "0.9rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Citas documentales ({detail.citations.length})
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {detail.citations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goToCitation(c.pdf_page)}
                  style={{
                    textAlign: "left", background: "var(--accent)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "0.5rem 0.65rem", cursor: "pointer", fontSize: "0.78rem",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    Página PDF {c.pdf_page ?? "-"}{c.printed_page ? ` · impresa ${c.printed_page}` : ""}
                    {c.section_label ? ` · ${c.section_label}` : ""}
                    {c.clause ? ` · Cláusula ${c.clause}` : ""}
                    {c.article ? ` · Artículo ${c.article}` : ""}
                  </div>
                  <div style={{ color: "var(--muted)", marginTop: "0.15rem" }}>
                    {c.text.length > 220 ? c.text.slice(0, 220) + "…" : c.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {detail && (
          <div style={{ marginTop: "0.9rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            Versiones conservadas: {detail.versions.map((v) => `${v.label} (${String(v.status)})`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", zIndex: 60,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
}
const panelStyle: CSSProperties = {
  background: "var(--card)", borderRadius: "var(--radius)", padding: "1.25rem",
  width: "min(880px, 100%)", maxHeight: "90vh", overflowY: "auto",
}
const iconBtnStyle: CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.3rem" }
const kvStyle: CSSProperties = { padding: "0.3rem 0.6rem", background: "var(--accent)", borderRadius: 999 }
const primaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.85rem",
}
const secondaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.85rem",
}
