"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { CopySimple, ArrowRight, FileText, IdentificationCard } from "@phosphor-icons/react"

export function CopyServiceHeroCard() {
  const containerStyle: CSSProperties = {
    background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)",
    border: "1px solid rgba(37, 99, 235, 0.22)",
    borderRadius: "var(--radius-lg, 1rem)",
    padding: "1.25rem 1.5rem",
    marginBottom: "var(--space-4, 1rem)",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    boxSizing: "border-box",
    width: "100%",
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  }

  const iconBoxStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: "0.75rem",
    background: "linear-gradient(135deg, var(--primary, #2563eb), #4f46e5)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
  }

  const pillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.25rem 0.625rem",
    borderRadius: "9999px",
    background: "var(--card, #ffffff)",
    border: "1px solid var(--border, #e2e8f0)",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--fg, #0f172a)",
  }

  const ctaStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.625rem 1.25rem",
    background: "var(--primary, #2563eb)",
    color: "var(--primary-fg, #ffffff)",
    borderRadius: "var(--radius, 0.5rem)",
    fontWeight: 600,
    fontSize: "0.875rem",
    textDecoration: "none",
    transition: "opacity var(--transition, 0.15s ease)",
    flexShrink: 0,
  }

  return (
    <section aria-label="Servicio de copias" data-testid="copy-service-hero-card" style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", flex: 1, minWidth: 260 }}>
          <div style={iconBoxStyle}>
            <CopySimple size={24} weight="bold" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg, #0f172a)", lineHeight: 1.25 }}>
                Sacar copias
              </h2>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  background: "rgba(37, 99, 235, 0.12)",
                  color: "var(--primary, #2563eb)",
                }}
              >
                Servicio sindical
              </span>
            </div>
            <p style={{ fontSize: "0.84375rem", color: "var(--muted, #64748b)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
              Escanea un documento con tu celular y envíalo a imprimir en la oficina sindical.
            </p>
          </div>
        </div>

        <Link href="/copias" style={ctaStyle}>
          <span>Sacar una copia</span>
          <ArrowRight size={16} weight="bold" />
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={pillStyle}>
          <FileText size={14} weight="bold" style={{ color: "var(--primary, #2563eb)" }} />
          Documento
        </span>
        <span style={pillStyle}>
          <IdentificationCard size={14} weight="bold" style={{ color: "#b45309" }} />
          INE (ambas caras)
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginLeft: "0.25rem" }}>
          Transferencia instantánea por código QR
        </span>
      </div>
    </section>
  )
}
