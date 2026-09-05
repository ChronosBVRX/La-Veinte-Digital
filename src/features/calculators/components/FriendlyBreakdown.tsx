"use client"

import { formatCurrency } from "../lib/money"

export type BreakdownFormat = "currency" | "number" | "percent"

export interface BreakdownItem {
  label: string
  value: number
  format?: BreakdownFormat
  technicalConcept?: string
  highlight?: boolean
  description?: string
}

interface FriendlyBreakdownProps {
  title?: string
  items: BreakdownItem[]
}

function formatValue(value: number, format: BreakdownFormat): string {
  if (format === "percent") {
    return `${(value * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
  }
  if (format === "number") {
    return value.toLocaleString("es-MX", { maximumFractionDigits: 2 })
  }
  return formatCurrency(value)
}

export function FriendlyBreakdown({
  title = "Así se distribuye tu pago",
  items,
}: FriendlyBreakdownProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        boxSizing: "border-box",
      }}
    >
      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 700,
          margin: "0 0 1rem",
          color: "var(--fg)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {title}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              padding: item.highlight ? "0.875rem 1rem" : "0.625rem 0",
              background: item.highlight ? "rgba(37, 99, 235, 0.05)" : "transparent",
              border: item.highlight ? "1px solid rgba(37, 99, 235, 0.2)" : "none",
              borderBottom: !item.highlight && idx < items.length - 1 ? "1px solid var(--border)" : undefined,
              borderRadius: item.highlight ? "var(--radius-md)" : "0",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: item.highlight ? "0.9375rem" : "0.875rem",
                    fontWeight: item.highlight ? 700 : 500,
                    color: "var(--fg)",
                  }}
                >
                  {item.label}
                </span>
                {item.technicalConcept && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--muted)",
                      background: "var(--accent)",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {item.technicalConcept}
                  </span>
                )}
              </div>
              {item.description && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    margin: "0.2rem 0 0",
                    lineHeight: 1.3,
                  }}
                >
                  {item.description}
                </p>
              )}
            </div>

            <div
              style={{
                fontSize: item.highlight ? "1.25rem" : "1rem",
                fontWeight: item.highlight ? 800 : 600,
                color: item.highlight ? "var(--primary)" : "var(--fg)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {formatValue(item.value, item.format ?? "currency")}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
