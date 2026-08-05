"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { CaretLeft } from "@phosphor-icons/react"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  icon?: ReactNode
  actions?: ReactNode
  backHref?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  backHref,
}: PageHeaderProps) {
  const backButton = backHref ? (
    <Link
      href={backHref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "var(--text-sm)",
        color: "var(--muted)",
        textDecoration: "none",
        marginBottom: "var(--space-2)",
        transition: "color var(--transition)",
      }}
    >
      <CaretLeft size={16} weight="regular" />
      Volver
    </Link>
  ) : null

  const headingNode = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
      {icon && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "0.125rem",
            color: "var(--primary)",
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <span
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.125rem",
            }}
          >
            {eyebrow}
          </span>
        )}
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--fg)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              margin: "0.25rem 0 0 0",
              lineHeight: 1.5,
              maxWidth: "38rem",
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div
      style={{
        marginBottom: "var(--space-6)",
      }}
    >
      {/* Mobile: back button on top */}
      {backButton && (
        <div className="mobile-only">{backButton}</div>
      )}

      {/* Mobile layout: stacked */}
      <div className="mobile-only">
        {headingNode}
        {actions && (
          <div style={{ marginTop: "var(--space-3)" }}>{actions}</div>
        )}
      </div>

      {/* Desktop layout: title left, actions right */}
      <div
        className="desktop-only"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {backButton}
          {headingNode}
        </div>
        {actions && (
          <div style={{ flexShrink: 0, paddingTop: backHref ? "1.75rem" : 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
