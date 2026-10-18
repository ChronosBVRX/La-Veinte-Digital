"use client"

import { useState, useMemo, type CSSProperties } from "react"
import {
  Search,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  FileText,
} from "lucide-react"
import {
  TEMAS_COTIDIANOS_TRABAJADOR,
  searchPreambulosEnLenguajeNatural,
} from "../data/preambulos-normativos"
import type { LibraryDocumentEntry } from "../services/catalog"

interface Props {
  documents: LibraryDocumentEntry[]
  onOpenDoc: (doc: LibraryDocumentEntry) => void
}

export function PreambulosNormativaView({ documents, onOpenDoc }: Props) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas")
  const [expandedDocId, setExpandedDocId] = useState<string | null>("CCT-IMSS-SNTSS-2025-2027")

  const filteredPreambulos = useMemo(() => {
    let list = searchPreambulosEnLenguajeNatural(searchTerm)
    if (selectedCategoria !== "todas") {
      list = list.filter((p) => p.categoria === selectedCategoria)
    }
    return list
  }, [searchTerm, selectedCategoria])

  const handleSelectTemaCotidiano = (docId: string) => {
    setExpandedDocId(docId)
    setTimeout(() => {
      const el = document.getElementById(`preambulo-${docId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 50)
  }

  const handleOpenDocById = (docId: string) => {
    const found = documents.find(
      (d) =>
        d.id.toLowerCase() === docId.toLowerCase() ||
        (d.key && d.key.toLowerCase() === docId.toLowerCase())
    )
    if (found) {
      onOpenDoc(found)
    } else {
      // Si el docId es un virtual o subdocumento (ej. CCT::BOLSA), abrimos el CCT
      const cct = documents.find((d) => d.id === "CCT-IMSS-SNTSS-2025-2027")
      if (cct) onOpenDoc(cct)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
      {/* Banner introductorio para el trabajador */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "var(--radius)",
          padding: "1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "0.2rem 0.6rem",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              borderRadius: 999,
              letterSpacing: "0.04em",
            }}
          >
            CONSULTA DIRECTA Y MANUAL
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Sin intermediarios ni tener que preguntarle a una IA
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--fg)" }}>
          Normativas en lenguaje claro para las y los trabajadores
        </h2>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
          Aquí encuentras cada contrato, estatuto y reglamento explicado de manera sencilla: de qué trata, qué
          beneficios contiene, a quién aplica y en qué situaciones de tu trabajo te sirve para defender tus derechos.
        </p>
      </div>

      {/* Buscador en Lenguaje Natural */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "0.5rem 0.85rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <Search size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="¿Qué buscas? ej. AUO, administrativo, ARIMAC, almacén, enfermería, radiólogo, ambulancia..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.9rem",
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
                fontSize: "0.8rem",
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Filtros de categoría */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {[
            { id: "todas", label: "Todas las normas" },
            { id: "flujos-clinicos", label: "Puestos Clínicos (Enfermería, Asistente, Radiólogo...)" },
            { id: "administrativos", label: "Personal Administrativo (AUO, ARIMAC, Almacén...)" },
            { id: "procedimientos", label: "Procedimientos IMSS (2900, 1A74, ST-7...)" },
            { id: "cct", label: "CCT y Salarios" },
            { id: "sntss", label: "SNTSS y FAS" },
            { id: "reglamentos", label: "Reglamentos y Bolsa" },
            { id: "seguridad", label: "Seguridad y NOMs" },
            { id: "leyes", label: "Leyes Federales" },
            { id: "integridad", label: "Código de Conducta" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoria(cat.id)}
              style={selectedCategoria === cat.id ? activeChip : chipBtn}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Acceso Rápido: Temas Cotidianos más Consultados */}
      {!searchTerm && selectedCategoria === "todas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Sparkles size={16} color="var(--primary)" />
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
              Temas cotidianos más consultados (acceso rápido)
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: "0.65rem",
            }}
          >
            {TEMAS_COTIDIANOS_TRABAJADOR.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectTemaCotidiano(item.documentoId)}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "1.1rem" }}>{item.icono}</span>
                    <strong style={{ fontSize: "0.85rem" }}>{item.titulo}</strong>
                  </div>
                  <ChevronRight size={15} color="var(--muted)" />
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.35 }}>
                  {item.descripcion}
                </p>
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "0.35rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px dashed var(--border)",
                    fontSize: "0.72rem",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--primary)" }}>{item.referencia}</span>
                  <span style={{ color: "var(--muted)" }}>Consultar →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Preámbulos de Normativas */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
            Documentos oficiales explicados ({filteredPreambulos.length})
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            Toca cualquier norma para ver su preámbulo completo
          </span>
        </div>

        {filteredPreambulos.map((norma) => {
          const isExpanded = expandedDocId === norma.documentId
          return (
            <div
              key={norma.documentId}
              id={`preambulo-${norma.documentId}`}
              style={{
                background: "var(--card)",
                border: isExpanded ? "1px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                boxShadow: isExpanded ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {/* Encabezado colapsable */}
              <div
                onClick={() => setExpandedDocId(isExpanded ? null : norma.documentId)}
                style={{
                  padding: "0.875rem 1rem",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  background: isExpanded ? "rgba(37, 99, 235, 0.03)" : "transparent",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--fg)" }}>
                      {norma.tituloComun}
                    </span>
                    {norma.claveOficial && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.15rem 0.45rem",
                          background: "var(--accent)",
                          borderRadius: 999,
                          color: "var(--muted)",
                          fontWeight: 600,
                        }}
                      >
                        {norma.claveOficial}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--primary)", fontWeight: 600 }}>
                    💡 {norma.enUnaFrase}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {norma.organizacion} {norma.vigenciaTexto ? `· ${norma.vigenciaTexto}` : ""}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.6rem",
                    borderRadius: "var(--radius)",
                    background: "var(--accent)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--fg)",
                    flexShrink: 0,
                  }}
                >
                  {isExpanded ? "Ocultar preámbulo" : "Ver qué contiene"}
                </div>
              </div>

              {/* Contenido detallado del preámbulo */}
              {isExpanded && (
                <div
                  style={{
                    padding: "1rem",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    fontSize: "0.85rem",
                  }}
                >
                  {/* De qué trata */}
                  <div>
                    <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.85rem", color: "var(--fg)", fontWeight: 700 }}>
                      ¿De qué trata y por qué te protege?
                    </h4>
                    <p style={{ margin: 0, color: "var(--fg)", lineHeight: 1.55, whiteSpace: "pre-line" }}>
                      {norma.preambulo}
                    </p>
                  </div>

                  {/* A quién aplica */}
                  <div>
                    <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.85rem", color: "var(--fg)", fontWeight: 700 }}>
                      ¿A quién le aplica?
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {norma.aQuienAplica.map((quien, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.55rem",
                            background: "var(--accent)",
                            borderRadius: 999,
                            color: "var(--fg)",
                          }}
                        >
                          ✓ {quien}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Qué puedes encontrar dentro */}
                  <div
                    style={{
                      background: "rgba(37, 99, 235, 0.04)",
                      border: "1px solid rgba(37, 99, 235, 0.15)",
                      borderRadius: "var(--radius)",
                      padding: "0.875rem",
                    }}
                  >
                    <h4 style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", color: "var(--primary)", fontWeight: 700 }}>
                      Aquí puedes encontrar dentro de esta norma:
                    </h4>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.2rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {norma.aquiPuedesEncontrar.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Temas Clave */}
                  <div>
                    <h4 style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", color: "var(--fg)", fontWeight: 700 }}>
                      Temas y Cláusulas / Artículos Clave:
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                        gap: "0.5rem",
                      }}
                    >
                      {norma.temasClave.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            background: "var(--accent)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            padding: "0.6rem 0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ fontSize: "0.825rem" }}>{t.tema}</strong>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "0.15rem 0.45rem",
                                background: "var(--card)",
                                color: "var(--primary)",
                                borderRadius: 999,
                                border: "1px solid var(--border)",
                              }}
                            >
                              {t.referencia}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.35 }}>
                            {t.queEncontraras}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cuándo consultarlo */}
                  {norma.cuandoConsultarlo.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.85rem", color: "var(--fg)", fontWeight: 700 }}>
                        ¿Cuándo debes consultarlo en tu día a día?
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "1.2rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          color: "var(--muted)",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                        }}
                      >
                        {norma.cuandoConsultarlo.map((caso, i) => (
                          <li key={i}>{caso}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ojo con esto */}
                  {norma.ojoConEsto.length > 0 && (
                    <div
                      style={{
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "var(--radius)",
                        padding: "0.7rem 0.85rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#92400e", fontWeight: 700, fontSize: "0.8rem" }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                        <span>Ojo con esto para proteger tus derechos:</span>
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "1.2rem",
                          fontSize: "0.78rem",
                          color: "#92400e",
                          lineHeight: 1.4,
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                        }}
                      >
                        {norma.ojoConEsto.map((ojo, i) => (
                          <li key={i}>{ojo}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      paddingTop: "0.5rem",
                      borderTop: "1px solid var(--border)",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => handleOpenDocById(norma.documentId)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.5rem 0.9rem",
                        background: "var(--primary)",
                        color: "var(--primary-fg)",
                        border: "none",
                        borderRadius: "var(--radius)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <FileText size={15} /> Ver documento oficial y citas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredPreambulos.length === 0 && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--muted)",
            }}
          >
            No se encontraron preámbulos que coincidan con &ldquo;{searchTerm}&rdquo;. Prueba buscando palabras como
            vacaciones, aguinaldo, checador, acoso o jubilación.
          </div>
        )}
      </div>
    </div>
  )
}

const chipBtn: CSSProperties = {
  padding: "0.3rem 0.65rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
  cursor: "pointer",
  fontSize: "0.78rem",
}

const activeChip: CSSProperties = {
  ...chipBtn,
  background: "var(--primary)",
  color: "var(--primary-fg)",
  borderColor: "var(--primary)",
}
