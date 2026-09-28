"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MagnifyingGlass, ArrowRight, X, PlusCircle, MinusCircle } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { searchGuide } from "@/features/tarjeton-guia/lib/search"
import { catalogCounts, getGuideConcept } from "@/features/tarjeton-guia/lib/catalog"
import { guideConcepts } from "@/data/guia-tarjeton/concepts"
import { conceptDetails } from "@/features/tarjeton-guia/data/concept-details"
import type { GuideConceptCategory, GuideSearchResult } from "@/features/tarjeton-guia/lib/types"

const FREQUENT_CONCEPTS = ["002", "011", "022", "029", "032", "033", "037"]
const FREQUENT_DEDUCTIONS = ["151", "152", "154", "107", "180", "190", "192"]

export function ConceptHub({ initialTab }: { initialTab?: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GuideSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState<"percepciones" | "deducciones">(
    initialTab === "deducciones" ? "deducciones" : "percepciones"
  )

  const counts = catalogCounts()

  const handleSearch = (value: string) => {
    setQuery(value)
    setSearched(true)
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setResults([])
      return
    }
    setResults(searchGuide(trimmed, 8))
  }

  const clearSearch = () => {
    setQuery("")
    setResults([])
    setSearched(false)
  }

  const showCatalog = !searched || query.trim().length === 0

  const frequent =
    activeTab === "percepciones"
      ? FREQUENT_CONCEPTS
      : FREQUENT_DEDUCTIONS

  const isPercTab = activeTab === "percepciones"

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía"
        title="¿Qué significa este concepto?"
        description="Busca por clave de 3 dígitos o por nombre: distingue de un vistazo entre percepciones (+) que suman y deducciones (−) que descuentan."
        backHref="/guia"
      />

      <Card
        padding="1rem 1.25rem"
        style={{
          marginBottom: "1rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <Image
            src="/brand/guia/tile-buscar.jpg"
            alt="Buscador de conceptos"
            width={46}
            height={46}
            style={{
              borderRadius: 10,
              objectFit: "cover",
              border: "1px solid var(--border)",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--fg)" }}>
              Buscador rápido de claves y campos
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Percepciones del <strong>001 al 084</strong> · Deducciones del <strong>104 al 199</strong> · Campos del <strong>1 al 77</strong>
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              display: "flex",
            }}
          >
            <MagnifyingGlass size={18} />
          </span>
          <input
            aria-label="Buscar por número o nombre"
            placeholder="Ej. 033, puntualidad, renta, vacaciones, 154, infonavit…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 2.25rem",
              borderRadius: "var(--radius)",
              border: "1.5px solid var(--border)",
              background: "var(--card)",
              fontSize: "1rem",
              color: "var(--fg)",
              boxSizing: "border-box",
            }}
          />
          {query && (
            <button
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                display: "flex",
                padding: "0.25rem",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.75rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Frecuentes:</span>
          {frequent.map((code) => {
            const c = getGuideConcept(code)
            return (
              <Link
                key={code}
                href={`/guia/conceptos/${code}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  background: isPercTab ? "#ecfdf5" : "#fff1f2",
                  border: `1px solid ${isPercTab ? "#a7f3d0" : "#fecdd3"}`,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: isPercTab ? "#065f46" : "#9f1239",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 800 }}>
                  {isPercTab ? `+${code}` : `−${code}`}
                </span>
                <span>{c?.name?.split(" ").slice(0, 3).join(" ").toLocaleLowerCase()}</span>
              </Link>
            )
          })}
        </div>
      </Card>

      {showCatalog && (
        <>
          {/* Selector visual Percepciones (+) vs Deducciones (−) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("percepciones")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                border: activeTab === "percepciones" ? "2px solid #059669" : "1px solid var(--border)",
                background: activeTab === "percepciones" ? "#ecfdf5" : "var(--card)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <PlusCircle size={20} weight="fill" color="#059669" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: activeTab === "percepciones" ? "#065f46" : "var(--fg)" }}>
                    Percepciones
                  </div>
                  <div style={{ fontSize: "0.71875rem", color: "#047857" }}>+ Pagos que recibes</div>
                </div>
              </div>
              <Badge variant="success">{counts.perceptions}</Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deducciones")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                border: activeTab === "deducciones" ? "2px solid #e11d48" : "1px solid var(--border)",
                background: activeTab === "deducciones" ? "#fff1f2" : "var(--card)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <MinusCircle size={20} weight="fill" color="#e11d48" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: activeTab === "deducciones" ? "#9f1239" : "var(--fg)" }}>
                    Deducciones
                  </div>
                  <div style={{ fontSize: "0.71875rem", color: "#be123c" }}>− Descuentos y retenciones</div>
                </div>
              </div>
              <Badge variant="warning">{counts.deductions}</Badge>
            </button>
          </div>

          <h2 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--muted)", margin: "0 0 0.625rem" }}>
            {activeTab === "percepciones"
              ? "🟢 Columna izquierda del tarjetón · Percepciones (Claves 001 a 084)"
              : "🔴 Columna derecha del tarjetón · Deducciones (Claves 104 a 199)"}
          </h2>
          <CatalogList tab={activeTab} />
        </>
      )}

      {searched && query.trim().length > 0 && (
        <>
          {results.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {results.map((r) => {
                const isPerc = r.category === "perception"
                const isDed = r.category === "deduction"
                const borderColor = isPerc ? "#10b981" : isDed ? "#f43f5e" : "#1b5e20"
                return (
                  <Link
                    key={r.key}
                    href={r.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem 0.875rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderLeft: `4px solid ${borderColor}`,
                      textDecoration: "none",
                      transition: "border-color var(--transition)",
                    }}
                  >
                    <Badge variant={categoryVariant(r.category)}>{categoryLabel(r.category)}</Badge>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                        {r.code} · {r.name}
                      </div>
                      {r.shortDescription && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", lineHeight: 1.4 }}>
                          {r.shortDescription}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                  </Link>
                )
              })}
            </div>
          ) : (
            <Card padding="1.25rem" variant="subtle" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>No encontramos ese concepto</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.875rem", lineHeight: 1.5 }}>
                Prueba con otro término o explora el catálogo de pagos y descuentos.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/guia/conceptos?tab=percepciones" style={linkChip}>Explorar percepciones</Link>
                <Link href="/guia/conceptos?tab=deducciones" style={linkChip}>Explorar deducciones</Link>
              </div>
            </Card>
          )}
        </>
      )}

      <style>{`
        @media (min-width: 720px) {
          .guia-catalog-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}

/** Lista del catálogo (cargada por tab; navega a la ficha). */
function CatalogList({ tab }: { tab: "percepciones" | "deducciones" }) {
  const isPerc = tab === "percepciones"
  const kinds = isPerc ? ("perception" as const) : ("deduction" as const)
  const list = guideConcepts.filter((c) => c.kind === kinds)

  return (
    <div className="guia-catalog-list" style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      {list.map((c) => {
        const curated = conceptDetails[c.code]
        return (
          <Link
            key={c.code}
            href={`/guia/conceptos/${c.code}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderLeft: `4px solid ${isPerc ? "#10b981" : "#f43f5e"}`,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 800,
                fontFamily: "monospace",
                color: isPerc ? "#047857" : "#be123c",
                background: isPerc ? "#ecfdf5" : "#fff1f2",
                border: `1px solid ${isPerc ? "#a7f3d0" : "#fecdd3"}`,
                borderRadius: 6,
                padding: "0.2rem 0.45rem",
                minWidth: "3.1rem",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {isPerc ? `+${c.code}` : `−${c.code}`}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>{c.name}</div>
              {curated?.descriptor && (
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                  {curated.descriptor}
                </div>
              )}
            </div>
            <ArrowRight size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
          </Link>
        )
      })}
    </div>
  )
}

function categoryVariant(cat: GuideConceptCategory) {
  switch (cat) {
    case "perception":
      return "info" as const
    case "deduction":
      return "warning" as const
    case "field":
      return "neutral" as const
    default:
      return "default" as const
  }
}

function categoryLabel(cat: GuideConceptCategory): string {
  switch (cat) {
    case "perception":
      return "Percepción"
    case "deduction":
      return "Deducción"
    case "field":
      return "Receptor"
    default:
      return "Sección"
  }
}

const linkChip: React.CSSProperties = {
  padding: "0.375rem 0.875rem",
  borderRadius: "9999px",
  background: "var(--accent)",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--fg)",
  textDecoration: "none",
}
