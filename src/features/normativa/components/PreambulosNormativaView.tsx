"use client"

import { useState, useMemo, useEffect, type CSSProperties } from "react"
import {
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react"
import {
  TEMAS_COTIDIANOS_TRABAJADOR,
  searchPreambulosEnLenguajeNatural,
  PREAMBULOS_NORMATIVOS,
  type PreambuloNormativo,
} from "../data/preambulos-normativos"
import type { LibraryDocumentEntry } from "../services/catalog"

interface Props {
  documents: LibraryDocumentEntry[]
  onOpenDoc: (doc: LibraryDocumentEntry) => void
  onPreviewDoc?: (doc: LibraryDocumentEntry) => void
}

const ITEMS_PER_PAGE = 8 // 4 filas de 2 tarjetas en móvil

export function PreambulosNormativaView({ documents, onOpenDoc, onPreviewDoc }: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [prevSearch, setPrevSearch] = useState(searchTerm)
  const [prevCat, setPrevCat] = useState(selectedCategoria)
  const [isDesktop, setIsDesktop] = useState(false)

  // Ajustar página durante el render si cambiaron los filtros sin necesidad de cascada de efectos
  if (searchTerm !== prevSearch || selectedCategoria !== prevCat) {
    setPrevSearch(searchTerm)
    setPrevCat(selectedCategoria)
    setCurrentPage(1)
  }

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(typeof window !== "undefined" && window.innerWidth >= 768)
    }
    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  // Filtrado reactivo
  const filteredPreambulos = useMemo(() => {
    let list = searchPreambulosEnLenguajeNatural(searchTerm)
    if (selectedCategoria !== "todas") {
      list = list.filter((p) => p.categoria === selectedCategoria)
    }
    return list
  }, [searchTerm, selectedCategoria])

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredPreambulos.length / ITEMS_PER_PAGE))
  const paginatedPreambulos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredPreambulos.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredPreambulos, currentPage])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    const el = document.getElementById("normativa-grid-header")
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const resolveDocEntry = (docId: string): LibraryDocumentEntry | null => {
    const cleanId = docId.trim().toLowerCase()
    const found = documents.find(
      (d) =>
        d.id.toLowerCase() === cleanId ||
        (d.key && d.key.toLowerCase() === cleanId) ||
        (d.key && d.key.toLowerCase().includes(cleanId)) ||
        (cleanId.length > 5 && d.id.toLowerCase().includes(cleanId))
    )
    if (found) return found

    const p = PREAMBULOS_NORMATIVOS.find(
      (item: PreambuloNormativo) =>
        item.documentId.toLowerCase() === cleanId ||
        (item.claveOficial && item.claveOficial.toLowerCase() === cleanId) ||
        item.aliasIds?.some((a: string) => a.toLowerCase() === cleanId)
    )
    if (p) {
      return {
        id: p.documentId,
        key: p.claveOficial ?? null,
        title: p.tituloComun,
        organization: [p.organizacion],
        type:
          p.categoria === "cct"
            ? "collective_agreement"
            : p.categoria === "sntss"
            ? "union_statutes"
            : p.categoria === "leyes"
            ? "federal_law"
            : p.categoria === "seguridad"
            ? "NOM"
            : "procedure",
        category: p.categoria,
        canonical: true,
        provenance: p.organizacion || "IMSS",
        validity: "CURRENT",
        verificationStatus: "VERIFIED",
        priority: "high",
        url:
          p.urlOficial ??
          (p.claveOficial && /^[0-9A-Za-z]{4}-[0-9A-Za-z]{3}-[0-9A-Za-z]{3}/.test(p.claveOficial)
            ? `https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/${p.claveOficial.split("/")[0].trim()}.pdf`
            : null),
        mirror: p.urlOficial ? null : "https://www.imss.gob.mx/conoce-al-imss/marco-normativo",
        landingPage: "https://www.imss.gob.mx/conoce-al-imss/marco-normativo",
        effectiveFrom: null,
        effectiveUntil: null,
        lastReformDate: null,
        warning: null,
        topics: p.temasClave.map((t: { tema: string }) => t.tema),
        versionLabel: p.vigenciaTexto ?? "Vigente Oficial",
        sha256: null,
        pages: null,
        chunks: p.temasClave.length,
        sections: p.temasClave.length,
        versionStatus: "VERIFIED",
      }
    }

    // Búsqueda aproximada
    const byTitle = PREAMBULOS_NORMATIVOS.find((item: PreambuloNormativo) =>
      cleanId.split(/[-_\s]+/).some((part) => part.length >= 4 && item.tituloComun.toLowerCase().includes(part))
    )
    if (byTitle) {
      return resolveDocEntry(byTitle.documentId)
    }

    return null
  }

  const handleOpenDocById = (docId: string) => {
    const entry = resolveDocEntry(docId)
    if (entry) onOpenDoc(entry)
  }

  const handlePreviewDocById = (docId: string) => {
    const entry = resolveDocEntry(docId)
    if (entry) {
      if (onPreviewDoc) {
        onPreviewDoc(entry)
      } else {
        onOpenDoc(entry)
      }
    }
  }

  const getCategoryIcon = (cat: string): string => {
    switch (cat) {
      case "cct":
        return "📜"
      case "sntss":
        return "⚖️"
      case "flujos-clinicos":
        return "🏥"
      case "administrativos":
        return "📋"
      case "procedimientos":
        return "📑"
      case "reglamentos":
        return "🛡️"
      case "seguridad":
        return "🦺"
      case "leyes":
        return "⚖️"
      case "integridad":
        return "🤝"
      default:
        return "📄"
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      {/* BUSCADOR COMPACTO */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0.45rem 0.75rem",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <Search size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por tema, derecho o categoría (ej. vacaciones, aguinaldo, enfermería, AUO)..."
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "0.85rem",
            color: "var(--fg)",
            width: "100%",
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "0.75rem",
              padding: "0.2rem",
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* TEMAS FRECUENTES EN RIEL HORIZONTAL DESLIZABLE COMPACTO (1 SOLA FILA) */}
      {!searchTerm && selectedCategoria === "todas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg)" }}>
              Temas y consultas frecuentes:
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              padding: "0.1rem 0",
              width: "100%",
            }}
          >
            {TEMAS_COTIDIANOS_TRABAJADOR.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onPreviewDoc) {
                    handlePreviewDocById(item.documentoId)
                  } else {
                    handleOpenDocById(item.documentoId)
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.3rem 0.6rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: "var(--fg)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <span>{item.icono}</span>
                <span>{item.titulo}</span>
                <span style={{ color: "var(--primary)", fontSize: "0.68rem" }}>({item.referencia})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTROS DE CATEGORÍA - RIEL HORIZONTAL DESLIZABLE */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          overflowX: "auto",
          flexWrap: "nowrap",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          padding: "0.15rem 0",
          width: "100%",
        }}
      >
        {[
          { id: "todas", label: "Todos los documentos" },
          { id: "cct", label: "📜 CCT y Tabulador" },
          { id: "sntss", label: "⚖️ Estatutos SNTSS" },
          { id: "flujos-clinicos", label: "🏥 Personal Clínico" },
          { id: "administrativos", label: "📋 Personal Administrativo" },
          { id: "procedimientos", label: "📑 Procedimientos IMSS" },
          { id: "reglamentos", label: "🛡️ Reglamentos" },
          { id: "seguridad", label: "🦺 Seguridad y Salud (NOM)" },
          { id: "leyes", label: "⚖️ Leyes Federales" },
          { id: "integridad", label: "🤝 Integridad y Conducta" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoria(cat.id)}
            style={{
              ...(selectedCategoria === cat.id ? activeChip : chipBtn),
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ENCABEZADO DEL GRID Y CONTEO */}
      <div
        id="normativa-grid-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.1rem 0",
        }}
      >
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--fg)" }}>
          Normas y Procedimientos ({filteredPreambulos.length})
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          Pág. {currentPage} de {totalPages}
        </span>
      </div>

      {/* GRID CUADRICULAR: EXACTAMENTE 2 ELEMENTOS POR FILA HORIZONTAL EN MÓVIL */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(240px, 1fr))" : "repeat(2, minmax(0, 1fr))",
          gap: "0.6rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {paginatedPreambulos.map((norma) => {
          const catIcon = getCategoryIcon(norma.categoria)
          return (
            <div
              key={norma.documentId}
              onClick={() => handlePreviewDocById(norma.documentId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handlePreviewDocById(norma.documentId)
                }
              }}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.65rem 0.65rem 0.55rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 165,
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                boxSizing: "border-box",
                position: "relative",
                cursor: "pointer",
              }}
            >
              {/* Parte Superior: Badge y Estado */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.25rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.4rem",
                      borderRadius: 4,
                      background: "rgba(37, 99, 235, 0.08)",
                      color: "var(--primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "75%",
                    }}
                  >
                    {catIcon} {norma.claveOficial || norma.organizacion}
                  </span>

                  <span
                    title="Documento Vigente"
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#10b981",
                      flexShrink: 0,
                    }}
                  />
                </div>

                {/* Título: Máximo 2 líneas */}
                <h3
                  style={{
                    margin: "0 0 0.25rem",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "var(--fg)",
                    lineHeight: 1.25,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={norma.tituloComun}
                >
                  {norma.tituloComun}
                </h3>

                {/* Frase clave: Máximo 2 líneas */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {norma.enUnaFrase}
                </p>
              </div>

              {/* Botón de acción al fondo */}
              <div
                style={{
                  marginTop: "0.55rem",
                  paddingTop: "0.45rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePreviewDocById(norma.documentId)
                  }}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    padding: "0.38rem 0.5rem",
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: 6,
                    border: "none",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Ver qué contiene este documento y para quién aplica"
                >
                  <BookOpen size={13} />
                  <span>Leer</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* CONTROLES DE PAGINACIÓN LIMPIA (ADIÓS AL SCROLL INFINITO) */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "0.5rem",
            padding: "0.6rem 0",
          }}
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            style={{
              ...paginationBtn,
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={15} />
            <span>Anterior</span>
          </button>

          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--fg)", padding: "0 0.35rem" }}>
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            style={{
              ...paginationBtn,
              opacity: currentPage >= totalPages ? 0.4 : 1,
              cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            <span>Siguiente</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

const chipBtn: CSSProperties = {
  padding: "0.3rem 0.65rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
}

const activeChip: CSSProperties = {
  ...chipBtn,
  background: "var(--primary)",
  borderColor: "var(--primary)",
  color: "#fff",
}

const paginationBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.35rem 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
  fontSize: "0.76rem",
  fontWeight: 600,
}
