"use client"

import { formatCurrency } from "../lib/money"
import type { CSSProperties } from "react"

export type ResultRowFormat = "currency" | "number" | "percent"

export interface ResultRow {
  label: string
  value: number
  format?: ResultRowFormat
  highlight?: boolean
  technicalConcept?: string
}

export interface ResultCardProps {
  title: string
  rows: ResultRow[]
  style?: CSSProperties
  heroAmount?: number
  heroLabel?: string
  explanation?: string
  notes?: string
}

function formatRow(value: number, format: ResultRowFormat): string {
  if (format === "percent") {
    return `${(value * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
  }
  if (format === "number") {
    return value.toLocaleString("es-MX", { maximumFractionDigits: 2 })
  }
  return formatCurrency(value)
}

export function ResultCard({
  title,
  rows,
  style,
  heroAmount,
  heroLabel,
  explanation,
  notes,
}: ResultCardProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          margin: "0 0 0.875rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </p>

      {heroAmount !== undefined && (
        <div style={{ marginBottom: "1rem" }}>
          {heroLabel && (
            <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{heroLabel}</span>
          )}
          <div
            style={{
              fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
              fontWeight: 800,
              color: "var(--primary)",
              lineHeight: 1.2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(heroAmount)}
          </div>
          {explanation && (
            <p style={{ fontSize: "0.84375rem", color: "var(--fg)", margin: "0.375rem 0 0", lineHeight: 1.4 }}>
              {explanation}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {rows.map((row, idx) => (
          <div
            key={`${row.label}-${idx}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: row.highlight ? "0.9375rem" : "0.84375rem",
              fontWeight: row.highlight ? 700 : 400,
              padding: row.highlight ? "0.5rem 0.625rem" : "0.375rem 0",
              background: row.highlight ? "rgba(37, 99, 235, 0.05)" : "transparent",
              borderRadius: row.highlight ? "var(--radius-sm)" : undefined,
              borderBottom: !row.highlight ? "1px solid var(--border)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", minWidth: 0 }}>
              <span style={{ color: "var(--fg)" }}>{row.label}</span>
              {row.technicalConcept && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--muted)",
                    background: "var(--accent)",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {row.technicalConcept}
                </span>
              )}
            </div>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                color: row.highlight ? "var(--primary)" : "var(--fg)",
                flexShrink: 0,
              }}
            >
              {formatRow(row.value, row.format ?? "currency")}
            </span>
          </div>
        ))}
      </div>

      {notes && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            margin: "0.75rem 0 0",
            lineHeight: 1.4,
            borderTop: "1px solid var(--border)",
            paddingTop: "0.5rem",
          }}
        >
          {notes}
        </p>
      )}
    </div>
  )
}
