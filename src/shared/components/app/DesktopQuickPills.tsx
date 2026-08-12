"use client"

import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react"

const PILLS = [
  { href: "/bitacora", label: "Registrar eventos en mi agenda" },
  { href: "/asistente", label: "Preguntas del CCT IA-Assistant" },
]

export function DesktopQuickPills() {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Acciones frecuentes
        </span>
        <Link
          href="/herramientas"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--primary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          Ver todas las herramientas
          <ArrowRight size={12} />
        </Link>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {PILLS.map((pill) => (
          <Link
            key={pill.href}
            href={pill.href}
            className="hover-lift pressable"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 0.875rem",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--fg)",
              transition: "box-shadow var(--transition)",
            }}
          >
            {pill.label}
            <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          </Link>
        ))}
      </div>
    </div>
  )
}