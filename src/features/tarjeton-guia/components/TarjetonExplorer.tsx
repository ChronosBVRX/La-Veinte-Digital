"use client"

import { useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { CaretRight, Receipt, User, ArrowsClockwise, ChatDots, Info, MagnifyingGlass, X, ArrowUp } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { guideSections } from "@/data/guia-tarjeton/sections"
import { guideFields } from "@/data/guia-tarjeton/fields"
import {
  GUIDE_SECTION_FIELD_RANGES,
  GUIDE_FIELD_CONTENT_BY_ID,
} from "@/data/guia-tarjeton/guide-fields-content"
import { fieldDetails } from "@/features/tarjeton-guia/data/field-details"
import {
  TarjetonMiniMap,
  TarjetonInteractiveSectionView,
  RECEPTOR_COLUMNS,
  getFieldVisualLocation,
  type TarjetonSectionId,
  type ReceptorColumnId,
} from "./TarjetonAnatomyDiagram"

const SECTION_ICONS: Record<string, ReactNode> = {
  emisor: <Receipt size={15} />,
  receptor: <User size={15} />,
  "percepciones-deducciones": <ArrowsClockwise size={15} />,
  mensajes: <ChatDots size={15} />,
  observaciones: <Info size={15} />,
}

export function TarjetonExplorer() {
  const [active, setActive] = useState<TarjetonSectionId>("receptor")
  const [receptorCol, setReceptorCol] = useState<ReceptorColumnId>("all")
  const [fieldQuery, setFieldQuery] = useState("")
  const [highlightPulse, setHighlightPulse] = useState(false)

  const mapTopRef = useRef<HTMLDivElement | null>(null)
  const detailSectionRef = useRef<HTMLDivElement | null>(null)

  const section = guideSections.find((s) => s.id === active) ?? guideSections[0]

  const triggerScrollToDetail = () => {
    setHighlightPulse(false)
    window.setTimeout(() => {
      setHighlightPulse(true)
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 30)
  }

  const handleSelectSection = (id: TarjetonSectionId, shouldScroll = true) => {
    setActive(id)
    setFieldQuery("")
    if (shouldScroll) {
      triggerScrollToDetail()
    }
  }

  const handleSelectColumnFromMap = (col: ReceptorColumnId) => {
    setReceptorCol(col)
    triggerScrollToDetail()
  }

  const scrollToTopMap = () => {
    mapTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de mi Tarjetón"
        title="Conoce tu tarjetón"
        description="Tu recibo IMSS se divide en 5 regiones y 77 campos numerados. Toca cualquier sección o columna para abrir su explicación."
        backHref="/guia"
      />

      {/* Contenedor compacto de Navegación + Mapa Interactivo */}
      <div ref={mapTopRef} style={{ scrollMarginTop: "4.5rem" }}>
        <Card
          padding="0.75rem"
          style={{
            marginBottom: "0.875rem",
            background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 65%, #f8fafc 100%)",
            borderColor: "#bbf7d0",
          }}
        >
          <div className="tarjeton-explorer-hero">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <Image
                  src="/brand/guia/tile-anatomia.jpg"
                  alt="Anatomía del tarjetón IMSS"
                  width={44}
                  height={44}
                  style={{
                    borderRadius: 10,
                    objectFit: "cover",
                    border: "1px solid #bbf7d0",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#14532d", lineHeight: 1.25 }}>
                    Selecciona una región del recibo
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#475569", margin: "0.1rem 0 0", lineHeight: 1.35 }}>
                    Al tocar un botón o zona del mapa te llevamos directo a su desglose.
                  </p>
                </div>
              </div>

              {/* Pestañas compactas de las 5 secciones del recibo */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.3rem",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.3rem",
                  background: "#e2ece2",
                }}
              >
                {guideSections.map((s) => {
                  const count = GUIDE_SECTION_FIELD_RANGES[s.id]?.length ?? 0
                  const isActive = s.id === active
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSection(s.id as TarjetonSectionId, true)}
                      style={{
                        flex: "1 1 auto",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.3rem",
                        padding: "0.4rem 0.6rem",
                        borderRadius: "var(--radius-sm)",
                        border: isActive ? "1px solid #1b5e20" : "1px solid transparent",
                        cursor: "pointer",
                        background: isActive ? "#1b5e20" : "#ffffff",
                        color: isActive ? "#ffffff" : "#334155",
                        fontWeight: isActive ? 700 : 600,
                        fontSize: "0.75rem",
                        boxShadow: isActive ? "0 2px 6px rgba(27,94,32,0.2)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {SECTION_ICONS[s.id]}
                      <span>{s.name}</span>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            background: isActive ? "#dcfce7" : "#f1f5f9",
                            color: isActive ? "#14532d" : "#475569",
                            borderRadius: "9999px",
                            padding: "0.05rem 0.375rem",
                            fontWeight: 800,
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <TarjetonMiniMap
              activeSection={active}
              activeColumn={receptorCol}
              onSelectSection={(id) => handleSelectSection(id, true)}
              onSelectColumn={handleSelectColumnFromMap}
              onJumpToDetail={triggerScrollToDetail}
              compact
            />
          </div>
        </Card>
      </div>

      {/* Ancla de Auto-Scroll: Explicación y Maqueta de la región activa */}
      <div
        ref={detailSectionRef}
        className={highlightPulse ? "tarjeton-detail-pulse" : undefined}
        style={{ scrollMarginTop: "4.25rem", borderRadius: "var(--radius-md)" }}
      >
        <Card
          padding="0.875rem 1rem"
          style={{
            marginBottom: "0.875rem",
            borderLeft: "4px solid #1b5e20",
            background: highlightPulse ? "#f0fdf4" : "var(--card)",
            transition: "background 0.4s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: "#dcfce7",
                  color: "#1b5e20",
                }}
              >
                {SECTION_ICONS[section.id]}
              </span>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>{section.name}</h2>
              <Badge variant="success">Explicación activa</Badge>
            </div>
            <button
              type="button"
              onClick={scrollToTopMap}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.55rem",
                borderRadius: 9999,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#1b5e20",
                fontSize: "0.6875rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <ArrowUp size={12} weight="bold" /> Subir al mapa
            </button>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5, margin: "0.35rem 0 0" }}>
            {section.simple}
          </p>
        </Card>

        {/* Maqueta interactiva estilo recibo real (adaptativa PC 3 cols / Móvil) */}
        <div style={{ marginBottom: "1.25rem" }}>
          <TarjetonInteractiveSectionView
            sectionId={active}
            receptorColumn={receptorCol}
            onChangeReceptorColumn={setReceptorCol}
          />
        </div>
      </div>

      {/* Catálogo detallado de campos de la sección */}
      <FieldList
        sectionId={section.id}
        receptorColumn={receptorCol}
        onChangeReceptorColumn={setReceptorCol}
        query={fieldQuery}
        onChangeQuery={setFieldQuery}
      />

      <style>{`
        .tarjeton-explorer-hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          align-items: start;
        }
        @media (min-width: 820px) {
          .tarjeton-explorer-hero {
            grid-template-columns: 1.05fr 1.1fr;
            align-items: center;
          }
        }
        @keyframes tarjetonPulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.45); }
          70% { box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); }
          100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
        }
        .tarjeton-detail-pulse {
          animation: tarjetonPulseGlow 0.9s ease-out;
        }
      `}</style>
    </div>
  )
}

const SENSITIVE_FIELD_IDS = new Set([3, 4, 5, 19])

function FieldList({
  sectionId,
  receptorColumn,
  onChangeReceptorColumn,
  query,
  onChangeQuery,
}: {
  sectionId: string
  receptorColumn: ReceptorColumnId
  onChangeReceptorColumn: (col: ReceptorColumnId) => void
  query: string
  onChangeQuery: (q: string) => void
}) {
  const allIds = GUIDE_SECTION_FIELD_RANGES[sectionId] ?? []
  if (allIds.length === 0) {
    return (
      <Card padding="1.25rem" variant="subtle">
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
          En esta región el tarjetón muestra información general del comprobante. Las claves y campos numerados se explican en <strong>Receptor (1–59)</strong>, <strong>Percepciones y Deducciones (60–70)</strong> y <strong>Observaciones (71–77)</strong>.
        </p>
      </Card>
    )
  }

  const columnFilteredIds =
    sectionId === "receptor" && receptorColumn !== "all"
      ? (RECEPTOR_COLUMNS.find((c) => c.id === receptorColumn)?.fieldIds ?? allIds)
      : allIds

  const normalizedQuery = query.trim().toLowerCase()
  const filteredIds = normalizedQuery
    ? allIds.filter((id) => {
        const f = guideFields.find((item) => item.id === id)
        const curated = fieldDetails[String(id)]
        const kp = GUIDE_FIELD_CONTENT_BY_ID.get(id)
        const text = `${id} ${f?.name ?? ""} ${curated?.simple ?? ""} ${kp?.easy ?? ""}`.toLowerCase()
        return text.includes(normalizedQuery)
      })
    : columnFilteredIds

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--fg)" }}>
            Diccionario de campos de esta sección ({filteredIds.length})
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Toca cualquier campo para abrir su ficha detallada.
          </div>
        </div>

        {/* Buscador rápido de campo dentro de la sección */}
        <div style={{ position: "relative", minWidth: "min(100%, 240px)", flex: "1 1 240px", maxWidth: 340 }}>
          <span
            style={{
              position: "absolute",
              left: "0.625rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              display: "flex",
            }}
          >
            <MagnifyingGlass size={15} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Filtrar por número o nombre (ej. 13, plaza)…"
            aria-label="Filtrar campo en esta sección"
            style={{
              width: "100%",
              padding: "0.45rem 1.75rem 0.45rem 2rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: "0.8125rem",
              color: "var(--fg)",
              boxSizing: "border-box",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => onChangeQuery("")}
              aria-label="Limpiar filtro"
              style={{
                position: "absolute",
                right: "0.375rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                display: "flex",
                padding: "0.2rem",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Sub-filtros rápidos por columna cuando estamos en Receptor */}
      {sectionId === "receptor" && !normalizedQuery && (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {[
            { id: "all" as const, label: "Todos (1–59)", color: "#1b5e20" },
            { id: "col1" as const, label: "Col. 1: Datos y Plaza (1–19)", color: "#1b5e20" },
            { id: "col2" as const, label: "Col. 2: Incidencias y 033 (20–39)", color: "#0369a1" },
            { id: "col3" as const, label: "Col. 3: Vacaciones y SMI (40–59)", color: "#6d28d9" },
          ].map((tab) => {
            const isSel = receptorColumn === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeReceptorColumn(tab.id)}
                style={{
                  padding: "0.32rem 0.6rem",
                  borderRadius: 9999,
                  border: isSel ? `1.5px solid ${tab.color}` : "1px solid var(--border)",
                  background: isSel ? tab.color : "var(--card)",
                  color: isSel ? "#fff" : "var(--fg)",
                  fontSize: "0.71875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="tarjeton-field-cards-grid">
        {filteredIds.map((id) => {
          const field = guideFields.find((f) => f.id === id)
          if (!field) return null
          const curated = fieldDetails[String(id)]
          const kp = GUIDE_FIELD_CONTENT_BY_ID.get(id)
          const desc = curated?.simple ?? kp?.easy
          const sensitive = SENSITIVE_FIELD_IDS.has(id)
          const loc = getFieldVisualLocation(id)

          return (
            <Link
              key={id}
              href={`/guia/campos/${id}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.65rem",
                padding: "0.65rem 0.8rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                borderLeft: `4px solid ${loc.accentColor}`,
                background: "var(--card)",
                textDecoration: "none",
                transition: "transform var(--transition), border-color var(--transition), box-shadow var(--transition)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "2.1rem",
                  height: "1.75rem",
                  padding: "0 0.375rem",
                  borderRadius: "var(--radius-sm)",
                  background: `color-mix(in srgb, ${loc.accentColor} 12%, #ffffff)`,
                  border: `1px solid color-mix(in srgb, ${loc.accentColor} 30%, transparent)`,
                  color: loc.accentColor,
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                #{id}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.84375rem", fontWeight: 700, color: "var(--fg)" }}>
                    {field.name}
                  </span>
                  {sensitive && <Badge variant="neutral">sensible</Badge>}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: loc.accentColor,
                    marginTop: "0.1rem",
                  }}
                >
                  {loc.columnTitle}
                </span>
                {desc && (
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.45, marginTop: "0.2rem" }}>
                    {condense(desc).slice(0, 125)}
                  </span>
                )}
              </span>
              <CaretRight size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: "0.25rem" }} />
            </Link>
          )
        })}
      </div>

      <style>{`
        .tarjeton-field-cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }
        @media (min-width: 720px) {
          .tarjeton-field-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}

function condense(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
