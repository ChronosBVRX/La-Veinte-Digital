"use client"

import { useState } from "react"
import Link from "next/link"
import { MagnifyingGlass, ArrowRight, X } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { searchGuide } from "@/features/tarjeton-guia/lib/search"
import { catalogCounts, getGuideConcept } from "@/features/tarjeton-guia/lib/catalog"
import { guideConcepts } from "@/data/guia-tarjeton/concepts"
import type { GuideConceptCategory, GuideSearchResult } from "@/features/tarjeton-guia/lib/types"

const FREQUENT_CONCEPTS = ["002", "011", "022", "029", "032", "033", "037"]
const FREQUENT_DEDUCTIONS = ["151", "152", "154", "107"]

export function ConceptHub({ initialTab }: { initialTab?: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GuideSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState<"percepciones" | "deducciones">(initialTab === "deducciones" ? "deducciones" : "percepciones")

  const counts = catalogCounts()

  const handleSearch = (value: string) => {
    setQuery(value)
    setSearched(true)
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setResults([])
      return
    }
    // Código exacto → abre directo la ficha (mantiene resultados si se cancela).
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

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía"
        title="¿Qué significa este concepto?"
        description="Busca por número o nombre: ej. 033, puntualidad, renta, vacaciones…"
        backHref="/guia"
      />

      <Card padding="1rem 1.25rem" style={{ marginBottom: "1rem" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex" }}>
            <MagnifyingGlass size={18} />
          </span>
          <input
            aria-label="Buscar por número o nombre"
            placeholder="Ej. 033, puntualidad, renta, vacaciones…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 2.25rem",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: "1rem",
              color: "var(--fg)",
            }}
          />
          {query && (
            <button
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
              style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: "0.25rem" }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: "1.875rem" }}>Frecuentes:</span>
          {frequent.map((code) => {
            const c = getGuideConcept(code)
            return (
              <Link
                key={code}
                href={`/guia/conceptos/${code}`}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  background: "var(--accent)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--fg)",
                  textDecoration: "none",
                }}
              >
                {code} {c?.name?.split(" ").slice(0, 3).join(" ").toLocaleLowerCase()}
              </Link>
            )
          })}
        </div>
      </Card>

      {showCatalog && (
        <>
          {/* Tabs perc/desc */}
          <div style={{ display: "flex", gap: "0.125rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
            {(["percepciones", "deducciones"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "var(--primary)" : "var(--muted)",
                  borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                  marginBottom: "-1px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                {tab === "percepciones" ? "Percepciones" : "Deducciones"}
                <Badge variant="neutral">
                  {tab === "percepciones" ? counts.perceptions : counts.deductions}
                </Badge>
              </button>
            ))}
          </div>

          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted)", margin: "0 0 0.625rem" }}>
            {activeTab === "percepciones" ? "Pagos: lo que recibes" : "Descuentos: lo que se retiene"} · Pagos y descuentos
          </h2>
          <CatalogList tab={activeTab} />
        </>
      )}

      {searched && query.trim().length > 0 && (
        <>
          {results.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {results.map((r) => (
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
              ))}
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
  const kinds = tab === "percepciones" ? ("perception" as const) : ("deduction" as const)
  const list = guideConcepts.filter((c) => c.kind === kinds)

  return (
    <div className="guia-catalog-list" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {list.slice(0, 60).map((c) => (
        <Link
          key={c.code}
          href={`/guia/conceptos/${c.code}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.625rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--primary)", width: "2.75rem", flexShrink: 0 }}>{c.code}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>{c.name}</span>
          <ArrowRight size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
        </Link>
      ))}
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
