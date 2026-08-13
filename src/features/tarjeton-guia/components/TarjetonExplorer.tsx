"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { CaretRight, Receipt, User, ArrowsClockwise, ChatDots, Info } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { guideSections } from "@/data/guia-tarjeton/sections"
import { guideFields } from "@/data/guia-tarjeton/fields"
import {
  GUIDE_SECTION_FIELD_RANGES,
  GUIDE_SECTION_SAMPLE,
  GUIDE_FIELD_CONTENT_BY_ID,
} from "@/data/guia-tarjeton/guide-fields-content"
import { fieldDetails } from "@/features/tarjeton-guia/data/field-details"

const SECTION_ICONS: Record<string, ReactNode> = {
  emisor: <Receipt size={16} />,
  receptor: <User size={16} />,
  "percepciones-deducciones": <ArrowsClockwise size={16} />,
  mensajes: <ChatDots size={16} />,
  observaciones: <Info size={16} />,
}

export function TarjetonExplorer() {
  const [active, setActive] = useState<string>("receptor")
  const section = guideSections.find((s) => s.id === active) ?? guideSections[0]

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de mi Tarjetón"
        title="Conoce tu tarjetón"
        description="Tu recibo de pago IMSS se divide en cinco regiones. Conoce qué significa cada campo y dónde se encuentra la información más importante que conviene revisar cada quincena."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            borderRadius: "var(--radius)",
            padding: "0.5rem",
            background: "var(--accent)",
          }}
        >
          {guideSections.map((s) => {
            const count = GUIDE_SECTION_FIELD_RANGES[s.id]?.length ?? 0
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  flex: "1 1 auto",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--card)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--muted)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.8125rem",
                  boxShadow: isActive ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
                }}
              >
                {SECTION_ICONS[s.id]}
                <span>{s.name}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      background: isActive ? "var(--primary)" : "var(--border)",
                      color: isActive ? "#fff" : "var(--muted)",
                      borderRadius: "9999px",
                      padding: "0.0625rem 0.4375rem",
                      fontWeight: 700,
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

      <Card padding="1.25rem 1.5rem" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          {SECTION_ICONS[section.id]}
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{section.name}</h2>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: "0.25rem 0 0" }}>
          {section.simple}
        </p>
        {(GUIDE_SECTION_SAMPLE[section.id]?.length ?? 0) > 0 && (
          <div
            style={{
              marginTop: "0.875rem",
              padding: "0.75rem 0.875rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {GUIDE_SECTION_SAMPLE[section.id].map((row) => (
              <div key={row.label} style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", lineHeight: 1.5 }}>
                <span style={{ color: "var(--muted)", flexShrink: 0, width: "7.5rem" }}>{row.label}</span>
                <span
                  style={{
                    color: row.blurred ? "var(--muted)" : "var(--fg)",
                    fontStyle: row.blurred ? "italic" : "normal",
                  }}
                >
                  {row.blurred ? `▪ ${row.value}` : row.value}
                </span>
              </div>
            ))}
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.6875rem", color: "var(--muted)" }}>
              Datos ficticios de ejemplo: tu tarjetón real muestra tu información personal.
            </p>
          </div>
        )}
      </Card>

      <FieldList sectionId={section.id} />
    </div>
  )
}

const SENSITIVE_FIELD_IDS = new Set([3, 4, 5, 19])

function FieldList({ sectionId }: { sectionId: string }) {
  const ids = GUIDE_SECTION_FIELD_RANGES[sectionId] ?? []
  if (ids.length === 0) {
    return (
      <Card padding="1.25rem" variant="subtle">
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
          En esta región el tarjetón muestra información general del comprobante. Las claves y campos que la detallan se explican en las demás regiones.
        </p>
      </Card>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", margin: "0.25rem 0 0.25rem" }}>Campos de esta sección</div>
      {ids.map((id) => {
        const field = guideFields.find((f) => f.id === id)
        if (!field) return null
        const curated = fieldDetails[String(id)]
        const kp = GUIDE_FIELD_CONTENT_BY_ID.get(id)
        const desc = curated?.simple ?? kp?.easy ?? field.sourceText?.slice(0, 100)
        const sensitive = SENSITIVE_FIELD_IDS.has(id)
        return (
          <Link
            key={id}
            href={`/guia/campos/${id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.625rem 0.75rem",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              textDecoration: "none",
              transition: "border-color var(--transition)",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "2rem",
                padding: "0.125rem 0.375rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "var(--primary)",
                fontWeight: 700,
                fontSize: "0.75rem",
              }}
            >
              {id}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                {field.name}
                {sensitive && <Badge variant="neutral" style={{ marginLeft: "0.375rem" }}>sensible</Badge>}
              </span>
              {desc && (
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  {condense(desc).slice(0, 110)}
                </span>
              )}
            </span>
            <CaretRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
          </Link>
        )
      })}
    </div>
  )
}

function condense(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
