"use client"

import { useEffect, useState, useMemo, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import {
  X,
  ExternalLink,
  FileText,
  BookOpen,
  Search,
  Copy,
  Check,
  Share2,
  Download,
  ArrowLeft,
} from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { formatTipoDocumento } from "../lib/preambulo-helper"
import { PdfViewer } from "./PdfViewer"
import cctClausesRaw from "@/shared/data/normativa/cct-clausulas.json"
import estatutosArticlesRaw from "@/shared/data/normativa/estatutos-articulos.json"
import type { NormativaClause, NormativaArticle } from "@/shared/lib/normativa-lookup"

interface Props {
  doc: LibraryDocumentEntry
  onClose: () => void
  initialTab?: "lectura" | "guia" | "pdf"
  initialQuery?: string
}

function getValidezBadge(val: string): { label: string; color: string } {
  switch (val) {
    case "CURRENT":
      return { label: "🟢 VIGENTE", color: "#15803d" }
    case "PENDING_REVIEW":
      return { label: "🟡 EN REVISIÓN", color: "#b45309" }
    case "HISTORICAL":
      return { label: "🔵 HISTÓRICO", color: "#1d4ed8" }
    case "EXPIRED":
      return { label: "⚪ VENCIDO", color: "#64748b" }
    case "SUPERSEDED":
      return { label: "⚪ SUSTITUIDO", color: "#64748b" }
    case "REPEALED":
      return { label: "⚪ ABROGADO", color: "#64748b" }
    default:
      return { label: "⚪ CONSULTABLE", color: "#64748b" }
  }
}

const CCT_SHORTCUTS = [
  { label: "Cláusula 47 (Vacaciones)", query: "47" },
  { label: "Cláusula 107 (Aguinaldo)", query: "107" },
  { label: "Cláusula 91 (Infectocontagiosidad)", query: "91" },
  { label: "Cláusula 93 (Estímulos)", query: "93" },
  { label: "Cláusula 38 (Tolerancia)", query: "38" },
  { label: "Cláusula 144 (Fondo Ahorro)", query: "144" },
  { label: "Cláusula 110 (RJP Jubilación)", query: "110" },
  { label: "Cláusula 63 Bis (Renta)", query: "63 Bis" },
  { label: "Cláusula 80 (Antigüedad)", query: "80" },
  { label: "Cláusula 42 (Horas Extras)", query: "42" },
]

const ESTATUTOS_SHORTCUTS = [
  { label: "Art. 1 (Constitución SNTSS)", query: "1" },
  { label: "Art. 25 (Derechos de Socios)", query: "25" },
  { label: "Art. 30 (Obligaciones)", query: "30" },
  { label: "Art. 96 (Cuota Sindical)", query: "96" },
  { label: "Art. 104 (Honor y Justicia)", query: "104" },
  { label: "Art. 130 (Asambleas)", query: "130" },
]

export function DocumentDetail({ doc, onClose, initialTab, initialQuery = "" }: Props) {
  const isCct = useMemo(() => {
    const clean = doc.id.trim().toLowerCase()
    return clean === "cct-imss-sntss-2025-2027" || clean === "cct" || clean === "contrato-colectivo"
  }, [doc.id])

  const isEstatutos = useMemo(() => {
    const clean = doc.id.trim().toLowerCase()
    return clean === "sntss-estatutos-2022" || clean === "estatutos" || clean === "estatutos-sntss"
  }, [doc.id])

  // Por defecto, si es CCT o Estatutos se abre directo su articulado completo.
  // Para procedimientos, reglamentos, leyes y NOMs, se abre DIRECTO el documento oficial PDF en fullscreen.
  const defaultTab = useMemo(() => {
    if (initialTab) return initialTab
    return isCct || isEstatutos ? "lectura" : "pdf"
  }, [initialTab, isCct, isEstatutos])

  const [prevDocId, setPrevDocId] = useState(doc.id)
  const [activeTab, setActiveTab] = useState<"lectura" | "guia" | "pdf">(defaultTab)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (prevDocId !== doc.id) {
    setPrevDocId(doc.id)
    setActiveTab(defaultTab)
  }

  const vBadge = getValidezBadge(doc.validity)

  // Bloquear scroll de la página al abrir
  useEffect(() => {
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose])

  // Filtrado de cláusulas CCT
  const filteredCctClauses = useMemo(() => {
    if (!isCct) return []
    const clauses = cctClausesRaw as NormativaClause[]
    const q = searchQuery.trim().toLowerCase()
    if (!q) return clauses

    const cleanNum = q.replace(/^cl[áa]usula\s+/i, "").replace(/[^0-9a-z]/g, "")
    return clauses.filter((c) => {
      const cNum = String(c.numero).toLowerCase().replace(/[^0-9a-z]/g, "")
      if (cNum === cleanNum || cNum.startsWith(cleanNum)) return true
      return (
        c.titulo.toLowerCase().includes(q) ||
        c.capitulo.toLowerCase().includes(q) ||
        c.texto.toLowerCase().includes(q)
      )
    })
  }, [isCct, searchQuery])

  // Filtrado de artículos de Estatutos
  const filteredEstatutosArticles = useMemo(() => {
    if (!isEstatutos) return []
    const articles = estatutosArticlesRaw as NormativaArticle[]
    const q = searchQuery.trim().toLowerCase()
    if (!q) return articles

    const cleanNum = q.replace(/^art[íi]culo\s+/i, "").replace(/[^0-9a-z]/g, "")
    return articles.filter((a) => {
      const aNum = String(a.numero).toLowerCase().replace(/[^0-9a-z]/g, "")
      if (aNum === cleanNum || aNum.startsWith(cleanNum)) return true
      return (
        a.titulo.toLowerCase().includes(q) ||
        a.capitulo.toLowerCase().includes(q) ||
        a.texto.toLowerCase().includes(q)
      )
    })
  }, [isEstatutos, searchQuery])

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback
    }
  }

  const handleShare = (title: string, text: string) => {
    if (typeof window !== "undefined" && window.LaVeinteApp?.share) {
      window.LaVeinteApp.share(title, text)
      return
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, text }).catch(() => {})
    } else {
      handleCopy(title, text)
    }
  }

  const fullscreenContent = (
    <div style={fullscreenContainerStyle} role="dialog" aria-modal="true">
      {/* BARRA SUPERIOR FULLSCREEN FIJA */}
      <div style={fullscreenHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: 1 }}>
          <button
            type="button"
            onClick={onClose}
            style={backBtnStyle}
            title="Volver a la biblioteca"
            aria-label="Volver a la biblioteca"
          >
            <ArrowLeft size={16} />
            <span style={{ fontWeight: 700 }}>Volver</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", background: "rgba(255, 255, 255, 0.1)", borderRadius: 999, color: "#93c5fd", flexShrink: 0 }}>
              {formatTipoDocumento(doc.type)}
            </span>
            {doc.key && (
              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", background: "rgba(37, 99, 235, 0.25)", color: "#bfdbfe", borderRadius: 999, flexShrink: 0 }}>
                {doc.key}
              </span>
            )}
            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", background: "rgba(255, 255, 255, 0.08)", color: vBadge.color, borderRadius: 999, flexShrink: 0 }}>
              {vBadge.label}
            </span>
            <h2 style={{ margin: 0, fontSize: "clamp(0.85rem, 2.5vw, 1.05rem)", fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.title}
            </h2>
          </div>
        </div>

        {/* ACCIONES Y CONTROLES DERECHOS */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0 }}>
          {/* Si es CCT o Estatutos: toggle entre articulado interactivo y facsímil PDF */}
          {(isCct || isEstatutos) && (
            <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.08)", padding: 2, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
              <button
                type="button"
                onClick={() => setActiveTab("lectura")}
                style={{
                  ...toggleBtnStyle,
                  background: activeTab === "lectura" ? "var(--primary)" : "transparent",
                  color: activeTab === "lectura" ? "#fff" : "#cbd5e1",
                }}
              >
                <BookOpen size={14} />
                <span>{isCct ? "Cláusulas (144)" : "Artículos (155)"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pdf")}
                style={{
                  ...toggleBtnStyle,
                  background: activeTab === "pdf" ? "var(--primary)" : "transparent",
                  color: activeTab === "pdf" ? "#fff" : "#cbd5e1",
                }}
              >
                <FileText size={14} />
                <span>PDF Facsímil</span>
              </button>
            </div>
          )}

          <a
            href={`/api/normativa/visor?id=${encodeURIComponent(doc.id)}`}
            target="_blank"
            download
            style={headerActionLink}
            title="Descargar documento PDF original"
          >
            <Download size={14} />
            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Descargar</span>
          </a>

          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...headerActionLink, color: "#93c5fd" }}
              title="Abrir en portal oficial gubernamental"
            >
              <ExternalLink size={14} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Portal oficial</span>
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            style={headerCloseBtn}
            aria-label="Cerrar visor fullscreen"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* CUERPO DEL LECTOR FULLSCREEN */}
      <div style={fullscreenBodyStyle}>
        {(!isCct && !isEstatutos) || activeTab === "pdf" ? (
          <PdfViewer documentId={doc.id} officialUrl={doc.url} />
        ) : (
          <div style={clauseViewerContainerStyle}>
            {/* Buscador de artículos/cláusulas interactivo */}
            <div style={searchContainerStyle}>
              <Search size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isCct
                    ? "Buscar por número o palabra en el CCT (ej. 47, 107, 91, vacaciones, aguinaldo, falta, turno)..."
                    : "Buscar por número o palabra en Estatutos (ej. 1, 25, 104, honor, voto, derechos, cuotas)..."
                }
                style={searchInputStyle}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={clearBtnStyle}>
                  Limpiar
                </button>
              )}
            </div>

            {/* Atajos CCT */}
            {isCct && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>
                  Cláusulas frecuentes:
                </span>
                {CCT_SHORTCUTS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSearchQuery(s.query)}
                    style={{
                      ...chipBtnStyle,
                      background: searchQuery === s.query ? "var(--primary)" : "var(--accent)",
                      color: searchQuery === s.query ? "var(--primary-fg)" : "var(--fg)",
                      borderColor: searchQuery === s.query ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Atajos Estatutos */}
            {isEstatutos && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>
                  Artículos frecuentes:
                </span>
                {ESTATUTOS_SHORTCUTS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSearchQuery(s.query)}
                    style={{
                      ...chipBtnStyle,
                      background: searchQuery === s.query ? "var(--primary)" : "var(--accent)",
                      color: searchQuery === s.query ? "var(--primary-fg)" : "var(--fg)",
                      borderColor: searchQuery === s.query ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Lista CCT */}
            {isCct && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Mostrando <strong>{filteredCctClauses.length}</strong> cláusulas</span>
                  {searchQuery && <span>Filtro: &quot;{searchQuery}&quot;</span>}
                </div>

                {filteredCctClauses.map((c) => (
                  <div key={c.id} style={itemCardStyle}>
                    <div style={itemCardHeaderStyle}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)" }}>
                            Cláusula {c.numero}
                          </span>
                          <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.45rem", background: "var(--card)", borderRadius: 4, border: "1px solid var(--border)", color: "var(--muted)" }}>
                            {c.capitulo}
                          </span>
                          {c.paginaPdf && (
                            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              · Pág. PDF {c.paginaPdf}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "0.925rem", color: "var(--fg)", marginTop: "0.2rem" }}>
                          {c.titulo}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(`cct-${c.numero}`, `Contrato Colectivo de Trabajo IMSS-SNTSS\n${c.capitulo}\nCláusula ${c.numero} - ${c.titulo}\n\n${c.texto}`)}
                          style={actionIconBtn}
                          title="Copiar cláusula al portapapeles"
                        >
                          {copiedId === `cct-${c.numero}` ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                          <span style={{ fontSize: "0.72rem" }}>{copiedId === `cct-${c.numero}` ? "Copiada" : "Copiar"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(`Cláusula ${c.numero} - CCT IMSS-SNTSS`, `Cláusula ${c.numero} (${c.titulo}):\n\n${c.texto}`)}
                          style={actionIconBtn}
                          title="Compartir cláusula"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.825rem", color: "var(--fg)", lineHeight: 1.55, whiteSpace: "pre-line", marginTop: "0.4rem" }}>
                      {c.texto}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista Estatutos */}
            {isEstatutos && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Mostrando <strong>{filteredEstatutosArticles.length}</strong> artículos</span>
                  {searchQuery && <span>Filtro: &quot;{searchQuery}&quot;</span>}
                </div>

                {filteredEstatutosArticles.map((a) => (
                  <div key={a.id} style={itemCardStyle}>
                    <div style={itemCardHeaderStyle}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10b981" }}>
                            Artículo {a.numero}
                          </span>
                          <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.45rem", background: "var(--card)", borderRadius: 4, border: "1px solid var(--border)", color: "var(--muted)" }}>
                            {a.capitulo}
                          </span>
                          {a.paginaPdf && (
                            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              · Pág. PDF {a.paginaPdf}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "0.925rem", color: "var(--fg)", marginTop: "0.2rem" }}>
                          {a.titulo}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(`est-${a.numero}`, `Estatutos SNTSS (Edición Octubre 2022)\n${a.capitulo}\nArtículo ${a.numero} - ${a.titulo}\n\n${a.texto}`)}
                          style={actionIconBtn}
                          title="Copiar artículo al portapapeles"
                        >
                          {copiedId === `est-${a.numero}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                          <span style={{ fontSize: "0.72rem" }}>{copiedId === `est-${a.numero}` ? "Copiado" : "Copiar"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(`Artículo ${a.numero} - Estatutos SNTSS`, `Artículo ${a.numero} (${a.titulo}):\n\n${a.texto}`)}
                          style={actionIconBtn}
                          title="Compartir artículo"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.825rem", color: "var(--fg)", lineHeight: 1.55, whiteSpace: "pre-line", marginTop: "0.4rem" }}>
                      {a.texto}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document !== "undefined" && document.body) {
    return createPortal(fullscreenContent, document.body)
  }
  return fullscreenContent
}

// ESTILOS INLINE CON CSS VARIABLES SEGÚN AGENTS.MD
const fullscreenContainerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  zIndex: 9999,
  background: "#0f172a",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}

const fullscreenHeaderStyle: CSSProperties = {
  height: 52,
  minHeight: 52,
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "0 1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexShrink: 0,
  color: "#f8fafc",
}

const fullscreenBodyStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  height: "calc(100dvh - 52px)",
  overflow: "hidden",
  position: "relative",
  background: "#1e293b",
  display: "flex",
  flexDirection: "column",
}

const clauseViewerContainerStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  height: "100%",
  overflowY: "auto",
  padding: "1rem clamp(0.75rem, 3vw, 2rem)",
  maxWidth: 960,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
  boxSizing: "border-box",
}

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 6,
  color: "#f8fafc",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 700,
  flexShrink: 0,
}

const toggleBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.3rem 0.65rem",
  border: "none",
  borderRadius: 6,
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
}

const headerActionLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: 6,
  color: "#f8fafc",
  fontSize: "0.78rem",
  fontWeight: 600,
  textDecoration: "none",
}

const headerCloseBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.35rem",
  background: "transparent",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  borderRadius: 6,
}

const searchContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.6rem 0.85rem",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
}

const searchInputStyle: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--fg)",
  fontSize: "0.85rem",
}

const clearBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: "0.75rem",
  cursor: "pointer",
  padding: "0.15rem 0.35rem",
}

const chipBtnStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  padding: "0.2rem 0.55rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  cursor: "pointer",
  transition: "all 0.15s ease",
}

const itemCardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.85rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
}

const itemCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.75rem",
}

const actionIconBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.25rem 0.55rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--accent)",
  color: "var(--fg)",
  cursor: "pointer",
}
