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
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Info,
  ChevronRight,
  Layers,
} from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { getOrSynthesizePreambulo, formatTipoDocumento } from "../lib/preambulo-helper"
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

function formatProcedencia(prov: string, canonical: boolean): string {
  if (canonical) return "Portal Oficial IMSS / DOF"
  if (prov === "CCT") return "Contrato Colectivo de Trabajo"
  if (prov === "SNTSS") return "SNTSS"
  return "Acervo Institucional"
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

export function DocumentDetail({ doc, onClose, initialTab = "lectura", initialQuery = "" }: Props) {
  const [activeTab, setActiveTab] = useState<"lectura" | "guia" | "pdf">(initialTab)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openPage, setOpenPage] = useState(1)
  const [detail, setDetail] = useState<DocDetailData | null>(null)

  const preambulo = useMemo(() => getOrSynthesizePreambulo(doc), [doc])
  const vBadge = getValidezBadge(doc.validity)

  const isCct = useMemo(() => {
    const clean = doc.id.trim().toLowerCase()
    return clean === "cct-imss-sntss-2025-2027" || clean === "cct" || clean === "contrato-colectivo"
  }, [doc.id])

  const isEstatutos = useMemo(() => {
    const clean = doc.id.trim().toLowerCase()
    return clean === "sntss-estatutos-2022" || clean === "estatutos" || clean === "estatutos-sntss"
  }, [doc.id])

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

  // Cargar metadatos y citas desde la API
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

  // Puntos operativos y de flujo desglosados para procedimientos
  const operationalPoints = useMemo(() => {
    if (!preambulo?.preambulo) return []
    const lines = preambulo.preambulo.split("\n")
    return lines
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•") || l.startsWith("-"))
      .map((l) => l.replace(/^[•-]\s*/, ""))
  }, [preambulo])

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

  const modalContent = (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* ENCABEZADO FIJO: IDENTIFICACIÓN CLARA E INEQUÍVOCA */}
        <div style={headerStyle}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "0.2rem 0.6rem", background: "var(--primary)", color: "#fff", borderRadius: 999, letterSpacing: "0.03em" }}>
                📖 LEYENDO EN LA APP
              </span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, padding: "0.2rem 0.55rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 999, color: "var(--fg)" }}>
                {formatTipoDocumento(doc.type)}
              </span>
              {doc.key && (
                <span style={{ fontSize: "0.74rem", fontWeight: 700, padding: "0.2rem 0.55rem", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", borderRadius: 999 }}>
                  Clave: {doc.key}
                </span>
              )}
              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: "var(--accent)", color: vBadge.color }}>
                {vBadge.label}
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: "clamp(1.05rem, 3.5vw, 1.3rem)", fontWeight: 800, lineHeight: 1.35, color: "var(--fg)", wordBreak: "break-word" }}>
              {doc.title}
            </h2>

            {preambulo && (
              <div style={{ marginTop: "0.45rem", fontSize: "0.825rem", color: "var(--fg)", fontWeight: 600, display: "flex", alignItems: "baseline", gap: "0.35rem", lineHeight: 1.35 }}>
                <span style={{ color: "var(--primary)", flexShrink: 0 }}>💡 En cristiano:</span>
                <span style={{ color: "var(--muted)" }}>{preambulo.enUnaFrase}</span>
              </div>
            )}
          </div>

          <button onClick={onClose} style={iconBtnStyle} aria-label="Cerrar ventana de lectura">
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE PESTAÑAS DENTRO DEL LECTOR */}
        <div style={tabBarStyle}>
          <button
            type="button"
            onClick={() => setActiveTab("lectura")}
            style={activeTab === "lectura" ? tabBtnActive : tabBtnStyle}
          >
            <BookOpen size={16} />
            <span>
              {isCct ? "Cláusulas CCT (144)" : isEstatutos ? "Artículos Estatutos (155)" : "Lectura y Procedimiento"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guia")}
            style={activeTab === "guia" ? tabBtnActive : tabBtnStyle}
          >
            <Sparkles size={16} />
            <span>Guía y Derechos Clave</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            style={activeTab === "pdf" ? tabBtnActive : tabBtnStyle}
          >
            <FileText size={16} />
            <span>PDF Original</span>
          </button>
        </div>

        {/* CUERPO DEL LECTOR */}
        <div style={bodyStyle}>
          {/* ============================================================== */}
          {/* PESTAÑA 1: LECTURA EN LA APP (ACTIVA POR DEFECTO)              */}
          {/* ============================================================== */}
          {activeTab === "lectura" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Buscador dentro del documento */}
              <div style={searchContainerStyle}>
                <Search size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isCct
                      ? "Buscar por número o palabra en el CCT (ej. 47, 107, 91, vacaciones, aguinaldo, falta, turno)..."
                      : isEstatutos
                      ? "Buscar por número o palabra en Estatutos (ej. 1, 25, 104, honor, voto, derechos, cuotas)..."
                      : "Filtrar en este documento (ej. turno, jornada, falta, funciones, insumos, plantilla)..."
                  }
                  style={searchInputStyle}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} style={clearBtnStyle}>
                    Limpiar
                  </button>
                )}
              </div>

              {/* Atajos rápidos para CCT */}
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

              {/* Atajos rápidos para Estatutos */}
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

              {/* VISTA 1A: LISTA DE CLÁUSULAS CCT */}
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

                  {filteredCctClauses.length === 0 && (
                    <div style={emptyBoxStyle}>
                      <Info size={20} color="var(--muted)" />
                      <p style={{ margin: 0, fontSize: "0.85rem" }}>
                        No se encontró ninguna cláusula con el término &quot;{searchQuery}&quot;. Intenta con otro número o palabra clave.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* VISTA 1B: LISTA DE ARTÍCULOS DE ESTATUTOS */}
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

                  {filteredEstatutosArticles.length === 0 && (
                    <div style={emptyBoxStyle}>
                      <Info size={20} color="var(--muted)" />
                      <p style={{ margin: 0, fontSize: "0.85rem" }}>
                        No se encontró ningún artículo con el término &quot;{searchQuery}&quot;. Intenta con otro número o palabra clave.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* VISTA 1C: PROCEDIMIENTOS, MANUALES, LEYES Y NOMS */}
              {!isCct && !isEstatutos && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Bloque 1: Objetivo y Fundamento Institucional */}
                  <div style={sectionBlockStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                      <Layers size={17} color="var(--primary)" />
                      <h3 style={sectionTitleStyle}>1. Objetivo y Fundamento Institucional</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.825rem", lineHeight: 1.6, color: "var(--fg)", whiteSpace: "pre-line" }}>
                      {preambulo?.preambulo}
                    </p>
                  </div>

                  {/* Bloque 2: Personal Involucrado y Alcance */}
                  {preambulo?.aQuienAplica && preambulo.aQuienAplica.length > 0 && (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>2. A Quién Aplica y Ámbito Operativo</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
                        {preambulo.aQuienAplica.map((quien, idx) => (
                          <span key={idx} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", background: "var(--accent)", borderRadius: 999, color: "var(--fg)", fontWeight: 500 }}>
                            ✓ {quien}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bloque 3: Flujo de Actividades y Puntos Operativos */}
                  {operationalPoints.length > 0 ? (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>3. Flujo Oficial de Actividades y Responsabilidades</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.45rem" }}>
                        {operationalPoints.map((point, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.55rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.45rem", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", borderRadius: 999, flexShrink: 0, marginTop: 2 }}>
                              Paso {idx + 1}
                            </span>
                            <span style={{ fontSize: "0.825rem", color: "var(--fg)", lineHeight: 1.45 }}>
                              {point}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : preambulo?.aquiPuedesEncontrar && preambulo.aquiPuedesEncontrar.length > 0 ? (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>3. Contenido Clave y Procedimientos</h3>
                      <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem", fontSize: "0.825rem", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {preambulo.aquiPuedesEncontrar.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Bloque 4: Temas Clave y Artículos/Cláusulas Fundantes */}
                  {preambulo?.temasClave && preambulo.temasClave.length > 0 && (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>4. Temas Clave y Cláusulas / Artículos Fundantes</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: "0.5rem", marginTop: "0.45rem" }}>
                        {preambulo.temasClave.map((t, idx) => (
                          <div key={idx} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.6rem 0.75rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "0.825rem", color: "var(--fg)" }}>{t.tema}</strong>
                              <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.45rem", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", borderRadius: 999 }}>
                                {t.referencia}
                              </span>
                            </div>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.35 }}>
                              {t.queEncontraras}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bloque 5: Casos Comunes de Consulta */}
                  {preambulo?.cuandoConsultarlo && preambulo.cuandoConsultarlo.length > 0 && (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>5. ¿Cuándo Debes Consultarlo para Defender tus Derechos?</h3>
                      <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem", fontSize: "0.8rem", color: "var(--fg)", lineHeight: 1.45, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {preambulo.cuandoConsultarlo.map((caso, idx) => (
                          <li key={idx}>{caso}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bloque 6: Alertas Laborales */}
                  {preambulo?.ojoConEsto && preambulo.ojoConEsto.length > 0 && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.75rem 0.9rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#92400e", fontWeight: 700, fontSize: "0.825rem", marginBottom: "0.35rem" }}>
                        <AlertTriangle size={16} />
                        <span>6. Ojo con esto para proteger tus derechos laborales:</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.78rem", color: "#92400e", lineHeight: 1.45, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {preambulo.ojoConEsto.map((ojo, idx) => (
                          <li key={idx}>{ojo}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bloque 7: Citas Oficiales / Numerales del Corpus */}
                  {detail?.citations && detail.citations.length > 0 && (
                    <div style={sectionBlockStyle}>
                      <h3 style={sectionTitleStyle}>
                        7. Citas y Numerales Oficiales del Documento ({detail.citations.length})
                      </h3>
                      <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.45rem" }}>
                        {detail.citations.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              padding: "0.55rem 0.75rem",
                              fontSize: "0.78rem",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.3rem" }}>
                              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                Pág. PDF {c.pdf_page ?? "-"}
                                {c.section_label ? ` · ${c.section_label}` : ""}
                                {c.clause ? ` · Cláusula ${c.clause}` : ""}
                                {c.article ? ` · Artículo ${c.article}` : ""}
                              </span>
                              {c.pdf_page && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (c.pdf_page) setOpenPage(c.pdf_page)
                                    setActiveTab("pdf")
                                  }}
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.45rem",
                                    background: "var(--accent)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    color: "var(--fg)",
                                  }}
                                >
                                  Ver en PDF
                                </button>
                              )}
                            </div>
                            <div style={{ color: "var(--fg)", marginTop: "0.2rem", lineHeight: 1.4 }}>
                              {c.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: GUÍA EXPLICATIVA EN LENGUAJE CLARO                   */}
          {/* ============================================================== */}
          {activeTab === "guia" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Etiquetas de estado y origen */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", fontSize: "0.78rem" }}>
                <span style={kvStyle}>Estado: <strong>{vBadge.label}</strong></span>
                <span style={kvStyle}>Origen: <strong>{formatProcedencia(doc.provenance, doc.canonical)}</strong></span>
                {doc.versionLabel && <span style={kvStyle}>Versión: <strong>{doc.versionLabel}</strong></span>}
                {doc.effectiveFrom && <span style={kvStyle}>Vigente desde: <strong>{doc.effectiveFrom}</strong></span>}
                {doc.effectiveUntil && <span style={kvStyle}>Hasta: <strong>{doc.effectiveUntil}</strong></span>}
                {doc.lastReformDate && <span style={kvStyle}>Última reforma: <strong>{doc.lastReformDate}</strong></span>}
              </div>

              {preambulo && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ background: "rgba(37, 99, 235, 0.04)", border: "1px solid rgba(37, 99, 235, 0.2)", borderRadius: "var(--radius)", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <BookOpen size={17} color="var(--primary)" />
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)" }}>
                        Guía Pedagógica para el Trabajador
                      </span>
                    </div>

                    <div style={{ fontSize: "0.825rem", fontWeight: 600, background: "var(--card)", padding: "0.55rem 0.7rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", color: "var(--fg)", lineHeight: 1.4 }}>
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

                    {preambulo.temasClave && preambulo.temasClave.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--fg)" }}>
                          Temas y Derechos Clave:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {preambulo.temasClave.map((t, i) => (
                            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.65rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.8rem" }}>{t.tema}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("lectura")
                                    setSearchQuery(t.referencia.replace(/^Cláusula\s+/i, ""))
                                  }}
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.45rem",
                                    background: "rgba(37, 99, 235, 0.1)",
                                    color: "var(--primary)",
                                    borderRadius: 999,
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                  }}
                                >
                                  {t.referencia} <ChevronRight size={12} />
                                </button>
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
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 3: PDF ORIGINAL (FAC-SÍMIL)                             */}
          {/* ============================================================== */}
          {activeTab === "pdf" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <PdfViewer documentId={doc.id} initialPage={openPage} officialUrl={doc.url} />
              </div>

              {doc.url && (
                <div style={{ textAlign: "center", padding: "0.5rem" }}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      textDecoration: "underline",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <ExternalLink size={13} />
                    Ver fuente en portal oficial gubernamental (dof.gob.mx / imss.gob.mx)
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIE DE VENTANA CON ACCIONES RÁPIDAS */}
        <div style={footerStyle}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <ShieldCheck size={14} color="#15803d" />
            <span>Documento oficial del acervo normativo IMSS-SNTSS</span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleCopy(`doc-${doc.id}`, `${doc.title}\n${doc.key ? `Clave: ${doc.key}\n` : ""}Fuente: ${formatProcedencia(doc.provenance, doc.canonical)}\n${doc.url ?? ""}`)}
              style={footerBtnStyle}
            >
              {copiedId === `doc-${doc.id}` ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
              <span>{copiedId === `doc-${doc.id}` ? "Referencia copiada" : "Copiar referencia"}</span>
            </button>
            <button type="button" onClick={onClose} style={closeFooterBtnStyle}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== "undefined" && document.body) {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}

// ESTILOS INLINE CON CSS VARIABLES SEGÚN AGENTS.MD
const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: "max(1rem, 2dvh) 1rem max(1.5rem, env(safe-area-inset-bottom, 1rem))",
  overflowY: "auto",
  overscrollBehavior: "contain",
}

const panelStyle: CSSProperties = {
  background: "var(--card)",
  borderRadius: "var(--radius-lg, 16px)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
  border: "1px solid var(--border)",
  width: "100%",
  maxWidth: "min(840px, 95vw)",
  maxHeight: "min(90dvh, calc(var(--visual-viewport-height, 100dvh) - 1.5rem))",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  margin: "auto",
  animation: "scaleIn 0.2s ease forwards",
}

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.75rem",
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--border)",
  background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%)",
  flexShrink: 0,
}

const tabBarStyle: CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
  background: "var(--card)",
  padding: "0 1rem",
  gap: "0.5rem",
  flexShrink: 0,
  overflowX: "auto",
}

const tabBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.65rem 0.85rem",
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: "0.825rem",
  fontWeight: 600,
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  whiteSpace: "nowrap",
}

const tabBtnActive: CSSProperties = {
  ...tabBtnStyle,
  color: "var(--primary)",
  borderBottomColor: "var(--primary)",
}

const bodyStyle: CSSProperties = {
  padding: "1.1rem 1.25rem",
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
  WebkitOverflowScrolling: "touch",
}

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.75rem 1.25rem",
  borderTop: "1px solid var(--border)",
  background: "var(--accent)",
  flexShrink: 0,
  flexWrap: "wrap",
  gap: "0.5rem",
}

const iconBtnStyle: CSSProperties = {
  background: "var(--accent)",
  border: "none",
  borderRadius: "50%",
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--muted)",
  flexShrink: 0,
}

const searchContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.5rem 0.75rem",
}

const searchInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: "0.825rem",
  color: "var(--fg)",
  width: "100%",
}

const clearBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  fontSize: "0.75rem",
  cursor: "pointer",
}

const chipBtnStyle: CSSProperties = {
  fontSize: "0.72rem",
  padding: "0.2rem 0.55rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  cursor: "pointer",
  fontWeight: 600,
  whiteSpace: "nowrap",
}

const itemCardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.85rem 1rem",
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
}

const itemCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.5rem",
  flexWrap: "wrap",
  borderBottom: "1px solid var(--border)",
  paddingBottom: "0.45rem",
}

const actionIconBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.25rem 0.5rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--accent)",
  color: "var(--fg)",
  cursor: "pointer",
}

const sectionBlockStyle: CSSProperties = {
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.85rem 1rem",
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "var(--fg)",
}

const kvStyle: CSSProperties = {
  padding: "0.25rem 0.55rem",
  background: "var(--accent)",
  borderRadius: 999,
  fontSize: "0.75rem",
}

const emptyBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "1.25rem",
  background: "var(--accent)",
  borderRadius: "var(--radius)",
  color: "var(--muted)",
}

const footerBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.4rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
}

const closeFooterBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.4rem 0.85rem",
  borderRadius: "var(--radius)",
  border: "none",
  background: "var(--primary)",
  color: "var(--primary-fg)",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
}
