"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { CaretRight, Question, MapPin } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { getGuideField, resolveRefHref, resolveRefLabel } from "@/features/tarjeton-guia/lib/catalog"
import { fieldDetails } from "@/features/tarjeton-guia/data/field-details"
import { VerificationCard } from "@/features/tarjeton-guia/components/VerificationCard"
import { GUIDE_FIELD_CONTENT_BY_ID, GUIDE_SECTION_FIELD_RANGES } from "@/data/guia-tarjeton/guide-fields-content"
import { guideSections } from "@/data/guia-tarjeton/sections"
import { TarjetonMiniMap, getFieldVisualLocation } from "./TarjetonAnatomyDiagram"

export function FieldFichaPage({ id }: { id: string | number }) {
  const field = getGuideField(id)
  if (!field) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <PageHeader eyebrow="Guía" title={`Campo ${String(id)}`} backHref="/guia/tarjeton" />
        <Card padding="1.5rem" variant="subtle" style={{ textAlign: "center" }}>
          <Question size={28} color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.25rem" }}>No encontramos este campo</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            Explora <Link href="/guia/tarjeton" style={{ color: "var(--primary)", fontWeight: 600 }}>Conoce tu tarjetón</Link> para ver los campos de cada sección.
          </p>
        </Card>
      </div>
    )
  }

  const curated = fieldDetails[String(field.id)]
  const kp = GUIDE_FIELD_CONTENT_BY_ID.get(field.id)
  const sectionId = sectionForField(field.id)
  const section = guideSections.find((s) => s.id === sectionId)
  const relations = getFieldRelations(field.id)
  const hasEnough = !!curated?.simple || !!kp?.easy
  const visualLoc = getFieldVisualLocation(field.id)

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de campos"
        title={`${field.id} · ${titleCase(field.name)}`}
        backHref="/guia/tarjeton"
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.2rem 0.6rem",
            borderRadius: 9999,
            background: `color-mix(in srgb, ${visualLoc.accentColor} 12%, #ffffff)`,
            border: `1px solid color-mix(in srgb, ${visualLoc.accentColor} 30%, transparent)`,
            color: visualLoc.accentColor,
            fontSize: "0.75rem",
            fontWeight: 800,
          }}
        >
          <MapPin size={13} weight="fill" /> {visualLoc.columnTitle}
        </span>
        <Badge variant="info">Campo #{field.id}</Badge>
        <Badge variant="work">{section?.name ?? "Sección del recibo"}</Badge>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <VerificationCard state={curated?.verification ?? "pending_verification"} sources={curated?.sources} />
      </div>

      {hasEnough ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card padding="1.25rem 1.5rem" style={{ borderLeft: `4px solid ${visualLoc.accentColor}` }}>
            <SectionTitle>¿Qué es?</SectionTitle>
            <p style={para()}>{curated?.simple ?? kp?.easy}</p>
          </Card>

          {(curated?.whyItMatters || kp?.whenToCheck) && (
            <Card padding="1.25rem 1.5rem" style={{ borderLeft: "4px solid var(--primary)" }}>
              <SectionTitle>¿Para qué me sirve?</SectionTitle>
              <p style={para()}>{curated?.whyItMatters ?? kp?.whenToCheck}</p>
            </Card>
          )}

          <Card padding="1.25rem 1.5rem">
            <SectionTitle>¿Dónde aparece en tu tarjetón?</SectionTitle>
            <p style={para({ marginBottom: "0.875rem" })}>
              {renderLocation(curated?.where, section?.name)}{" "}
              <span style={{ color: "var(--muted)" }}>({visualLoc.columnTitle})</span>
            </p>
            <TarjetonMiniMap
              activeSection={visualLoc.section}
              highlightTarget={{
                section: visualLoc.section,
                subZone: visualLoc.subZone,
                badgeLabel: visualLoc.badgeLabel,
              }}
              compact
            />
          </Card>
        </div>
      ) : (
        <Card padding="1.5rem" variant="subtle">
          <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.375rem" }}>Lo que sabemos de este campo</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Tenemos identificado este campo y su explicación se está completando. La información mostrada es educativa.
          </p>
        </Card>
      )}

      {relations.length > 0 && (
        <Card padding="1rem 1.25rem" style={{ marginTop: "1rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", margin: "0 0 0.625rem" }}>Esto se relaciona con…</div>
          <div className="field-ficha-relations-grid">
            {relations.map((r) => {
              const href = resolveRefHref(r.ref)
              if (!href) return null
              const isConcept = r.ref.startsWith("concept:")
              return (
                <Link
                  key={r.ref}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    background: isConcept ? "#f0fdf4" : "var(--accent)",
                    border: isConcept ? "1px solid #bbf7d0" : "1px solid var(--border)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>{r.label}</span>
                  <CaretRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <ActionLink href="/guia/tarjeton" variant="secondary" size="md">Ver todo el tarjetón</ActionLink>
        <ActionLink href="/guia/conceptos" variant="ghost" size="md">Explorar conceptos</ActionLink>
      </div>

      <style>{`
        .field-ficha-relations-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }
        @media (min-width: 640px) {
          .field-ficha-relations-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function titleCase(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

function sectionForField(id: number): string | null {
  for (const [sectionId, ids] of Object.entries(GUIDE_SECTION_FIELD_RANGES)) {
    if (ids.includes(id)) return sectionId
  }
  return null
}

function getFieldRelations(id: number): Array<{ ref: string; label: string }> {
  const out: Array<{ ref: string; label: string }> = []
  const curated = fieldDetails[String(id)]?.related
  for (const r of curated ?? []) {
    const label = r.label ?? resolveRefLabel(r.ref)
    if (label && !out.some((o) => o.ref === r.ref)) out.push({ ref: r.ref, label })
  }
  for (const ref of GUIDE_FIELD_CONTENT_BY_ID.get(id)?.related ?? []) {
    const full = ref.startsWith("concept:") || ref.startsWith("field:") || ref.startsWith("section:")
      ? ref
      : /\d{3}/.test(ref) ? `concept:${ref}` : `field:${ref}`
    const label = resolveRefLabel(full)
    if (label && !out.some((o) => o.ref === full)) out.push({ ref: full, label })
  }
  return out
}

export function renderLocation(whereText?: string, fallbackSectionName?: string): ReactNode {
  if (whereText) {
    const clean = whereText.replace(/\.+$/, "").trim()
    if (/[\u2014\u2013-]/.test(clean)) {
      const [sec, sub] = clean.split(/[\u2014\u2013-]/, 2).map((s) => s.trim())
      if (sec && sub) {
        return (
          <>
            En la sección <strong>{sec}</strong> (bloque <strong>{sub}</strong>) de tu tarjetón.
          </>
        )
      }
    }
    return (
      <>
        En la sección <strong>{clean}</strong> de tu tarjetón.
      </>
    )
  }

  return (
    <>
      En la sección <strong>{fallbackSectionName ?? "del recibo"}</strong> de tu tarjetón.
    </>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.375rem" }}>{children}</h3>
}

const paragraphStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--fg)",
  lineHeight: 1.6,
  margin: "0.25rem 0 0",
}

function para(extra: CSSProperties = {}): CSSProperties {
  return { ...paragraphStyle, ...extra }
}
