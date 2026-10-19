"use client"

import { useState, useMemo, useEffect, type CSSProperties } from "react"
import {
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  X,
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
}

const ITEMS_PER_PAGE = 8 // 4 filas de 2 tarjetas en móvil

export function PreambulosNormativaView({ documents, onOpenDoc }: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [prevSearch, setPrevSearch] = useState(searchTerm)
  const [prevCat, setPrevCat] = useState(selectedCategoria)
  const [detailModalDoc, setDetailModalDoc] = useState<PreambuloNormativo | null>(null)
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

  const handleOpenDocById = (docId: string) => {
    const cleanId = docId.trim().toLowerCase()
    const found = documents.find(
      (d) =>
        d.id.toLowerCase() === cleanId ||
        (d.key && d.key.toLowerCase() === cleanId) ||
        (d.key && d.key.toLowerCase().includes(cleanId)) ||
        (cleanId.length > 5 && d.id.toLowerCase().includes(cleanId))
    )
    if (found) {
      onOpenDoc(found)
      return
    }

    const p = PREAMBULOS_NORMATIVOS.find(
      (item: PreambuloNormativo) =>
        item.documentId.toLowerCase() === cleanId ||
        (item.claveOficial && item.claveOficial.toLowerCase() === cleanId) ||
        item.aliasIds?.some((a: string) => a.toLowerCase() === cleanId)
    )
    if (p) {
      const entry: LibraryDocumentEntry = {
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
      onOpenDoc(entry)
      return
    }

    // Búsqueda aproximada
    const byTitle = PREAMBULOS_NORMATIVOS.find((item: PreambuloNormativo) =>
      cleanId.split(/[-_\s]+/).some((part) => part.length >= 4 && item.tituloComun.toLowerCase().includes(part))
    )
    if (byTitle) {
      handleOpenDocById(byTitle.documentId)
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
          placeholder="¿Qué buscas? ej. vacaciones, aguinaldo, AUO, enfermería..."
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

      {/* TEMAS COTIDIANOS EN RIEL HORIZONTAL DESLIZABLE COMPACTO (1 SOLA FILA) */}
      {!searchTerm && selectedCategoria === "todas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg)" }}>
              Atajos cotidianos:
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
                onClick={() => handleOpenDocById(item.documentoId)}
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
          { id: "todas", label: "✨ Todas" },
          { id: "cct", label: "📜 CCT y Salarios" },
          { id: "sntss", label: "⚖️ SNTSS y Estatutos" },
          { id: "flujos-clinicos", label: "🏥 Puestos Clínicos" },
          { id: "administrativos", label: "📋 Administrativos" },
          { id: "procedimientos", label: "📑 Procedimientos IMSS" },
          { id: "reglamentos", label: "🛡️ Reglamentos" },
          { id: "seguridad", label: "🦺 Seguridad y NOMs" },
          { id: "leyes", label: "⚖️ Leyes Federales" },
          { id: "integridad", label: "🤝 Código de Conducta" },
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

              {/* Botones de acción alineados al fondo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  marginTop: "0.55rem",
                  paddingTop: "0.45rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {/* Botón principal: Leer */}
                <button
                  type="button"
                  onClick={() => handleOpenDocById(norma.documentId)}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    padding: "0.35rem 0.4rem",
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: 6,
                    border: "none",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Leer documento oficial completo en la app"
                >
                  <BookOpen size={13} />
                  <span>Leer</span>
                </button>

                {/* Botón secundario: Info pedagógica bajo demanda */}
                <button
                  type="button"
                  onClick={() => setDetailModalDoc(norma)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.35rem 0.45rem",
                    background: "var(--accent)",
                    color: "var(--fg)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: "0.74rem",
                    cursor: "pointer",
                  }}
                  title="Ver explicación y temas clave"
                  aria-label="Ver explicación"
                >
                  <Info size={13} />
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

      {/* MODAL DE INFORMACIÓN PEDAGÓGICA BAJO DEMANDA (NO SATURA LA PÁGINA) */}
      {detailModalDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setDetailModalDoc(null)}
        >
          <div
            style={{
              background: "var(--card)",
              width: "100%",
              maxWidth: 600,
              maxHeight: "88vh",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflowY: "auto",
              padding: "1.25rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              boxShadow: "0 -8px 30px rgba(0,0,0,0.3)",
              animation: "slideUp 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                    padding: "0.15rem 0.45rem",
                    background: "rgba(37, 99, 235, 0.08)",
                    borderRadius: 4,
                    width: "fit-content",
                  }}
                >
                  {detailModalDoc.claveOficial || detailModalDoc.organizacion}
                </span>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.3 }}>
                  {detailModalDoc.tituloComun}
                </h2>
                {detailModalDoc.vigenciaTexto && (
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    📅 {detailModalDoc.vigenciaTexto}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalDoc(null)}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 999,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--muted)",
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* En una frase */}
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--primary)",
                background: "rgba(37, 99, 235, 0.06)",
                borderLeft: "3px solid var(--primary)",
                padding: "0.5rem 0.65rem",
                borderRadius: "0 6px 6px 0",
              }}
            >
              💡 {detailModalDoc.enUnaFrase}
            </div>

            {/* De qué trata y por qué te protege */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <strong style={{ fontSize: "0.82rem", color: "var(--fg)" }}>
                ¿De qué trata y por qué te protege?
              </strong>
              <div style={{ fontSize: "0.78rem", color: "var(--fg)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                {detailModalDoc.preambulo}
              </div>
            </div>

            {/* A quién aplica */}
            {detailModalDoc.aQuienAplica && detailModalDoc.aQuienAplica.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <strong style={{ fontSize: "0.82rem", color: "var(--fg)" }}>
                  ¿A quién le aplica?
                </strong>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.4 }}>
                  {detailModalDoc.aQuienAplica.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Temas clave más consultados */}
            {detailModalDoc.temasClave && detailModalDoc.temasClave.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <strong style={{ fontSize: "0.82rem", color: "var(--fg)" }}>
                  Temas clave más consultados:
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {detailModalDoc.temasClave.map((tema, tIdx) => (
                    <div
                      key={tIdx}
                      style={{
                        padding: "0.45rem 0.6rem",
                        background: "var(--accent)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--fg)" }}>{tema.tema}</span>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)" }}>{tema.referencia}</span>
                      </div>
                      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.35 }}>{tema.queEncontraras}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de acción: Abrir en visor */}
            <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => {
                  const docId = detailModalDoc.documentId
                  setDetailModalDoc(null)
                  handleOpenDocById(docId)
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  padding: "0.65rem",
                  background: "var(--primary)",
                  color: "#fff",
                  borderRadius: "var(--radius)",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                <BookOpen size={16} />
                <span>Abrir documento oficial en el visor</span>
              </button>
            </div>
          </div>
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
