"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { X, ExternalLink, FileText, BookOpen } from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { getPreambulo } from "../data/preambulos-normativos"
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

function formatValidez(val: string): string {
  switch (val) {
    case "CURRENT": return "🟢 Vigente"
    case "PENDING_REVIEW": return "🟡 En revisión"
    case "HISTORICAL": return "🔵 Histórico"
    case "EXPIRED": return "⚪ Vencido"
    case "SUPERSEDED": return "⚪ Sustituido"
    case "REPEALED": return "⚪ Abrogado"
    default: return val
  }
}

function formatProcedencia(prov: string, canonical: boolean): string {
  if (canonical) return "Portal Oficial IMSS / DOF"
  if (prov === "CCT") return "Contrato Colectivo de Trabajo"
  if (prov === "SNTSS") return "SNTSS"
  return "Acervo Institucional"
}

export function DocumentDetail({ doc, onClose }: Props) {
  const [detail, setDetail] = useState<DocDetailData | null>(null)
  const [openPage, setOpenPage] = useState(1)
  const [showViewer, setShowViewer] = useState(false)
  const preambulo = getPreambulo(doc.id) || (doc.key ? getPreambulo(doc.key) : undefined)

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
          <span style={kvStyle}>Estado: <strong>{formatValidez(doc.validity)}</strong></span>
          <span style={kvStyle}>Origen: <strong>{formatProcedencia(doc.provenance, doc.canonical)}</strong></span>
          {doc.versionLabel && <span style={kvStyle}>Versión: <strong>{doc.versionLabel}</strong></span>}
          {doc.effectiveFrom && <span style={kvStyle}>Vigente desde: <strong>{doc.effectiveFrom}</strong></span>}
          {doc.effectiveUntil && <span style={kvStyle}>Hasta: <strong>{doc.effectiveUntil}</strong></span>}
          {doc.lastReformDate && <span style={kvStyle}>Última reforma: <strong>{doc.lastReformDate}</strong></span>}
        </div>

        {preambulo && (
          <div
            style={{
              marginTop: "0.9rem",
              background: "rgba(37, 99, 235, 0.04)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              borderRadius: "var(--radius)",
              padding: "0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <BookOpen size={17} color="var(--primary)" />
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)" }}>
                Guía en Lenguaje Claro para el Trabajador
              </span>
            </div>

            <div
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                background: "var(--card)",
                padding: "0.55rem 0.7rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                lineHeight: 1.4,
              }}
            >
              💡 {preambulo.enUnaFrase}
            </div>

            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.25rem", color: "var(--fg)" }}>
                ¿De qué trata este documento?
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.5, color: "var(--fg)", whiteSpace: "pre-line" }}>
                {preambulo.preambulo}
              </p>
            </div>

            {preambulo.aQuienAplica && preambulo.aQuienAplica.length > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--fg)" }}>
                  ¿A quién le aplica?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {preambulo.aQuienAplica.map((quien, i) => (
                    <span key={i} style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem", background: "var(--accent)", borderRadius: 999 }}>
                      ✓ {quien}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preambulo.aquiPuedesEncontrar && preambulo.aquiPuedesEncontrar.length > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--fg)" }}>
                  Aquí puedes encontrar:
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", lineHeight: 1.45, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {preambulo.aquiPuedesEncontrar.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {preambulo.temasClave && preambulo.temasClave.length > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--fg)" }}>
                  Temas y Derechos Clave:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {preambulo.temasClave.map((t, i) => (
                    <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.45rem 0.65rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.8rem" }}>{t.tema}</span>
                        <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", borderRadius: 999, fontWeight: 600 }}>
                          {t.referencia}
                        </span>
                      </div>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.35 }}>
                        {t.queEncontraras}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preambulo.cuandoConsultarlo && preambulo.cuandoConsultarlo.length > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--fg)" }}>
                  ¿Cuándo debes consultarlo? (Casos comunes):
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", lineHeight: 1.4, color: "var(--muted)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {preambulo.cuandoConsultarlo.map((caso, i) => (
                    <li key={i}>{caso}</li>
                  ))}
                </ul>
              </div>
            )}

            {preambulo.ojoConEsto && preambulo.ojoConEsto.length > 0 && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.55rem 0.7rem" }}>
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#92400e", marginBottom: "0.2rem" }}>
                  ⚠️ Ojo con esto para proteger tus derechos:
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.76rem", color: "#92400e", lineHeight: 1.35 }}>
                  {preambulo.ojoConEsto.map((ojo, i) => (
                    <li key={i}>{ojo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
