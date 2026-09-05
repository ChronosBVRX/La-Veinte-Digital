"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface FriendlyCalculatorIntroProps {
  title: string
  description: string
  badge?: string
  backHref?: string
  backLabel?: string
}

export function FriendlyCalculatorIntro({
  title,
  description,
  badge,
  backHref = "/calculadoras",
  backLabel = "Volver a calculadoras",
}: FriendlyCalculatorIntroProps) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <Link
        href={backHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--primary)",
          textDecoration: "none",
          marginBottom: "1rem",
          fontWeight: 500,
          minHeight: "44px",
        }}
      >
        <ArrowLeft size={16} /> {backLabel}
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
        <h1
          style={{
            fontSize: "clamp(1.35rem, 4vw, 1.75rem)",
            fontWeight: 700,
            margin: 0,
            color: "var(--fg)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {badge && (
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.9375rem",
          margin: 0,
          lineHeight: 1.5,
          maxWidth: "60ch",
        }}
      >
        {description}
      </p>
    </div>
  )
}
