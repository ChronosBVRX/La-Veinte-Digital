import { formatCurrency } from "../lib/money"
import type { CSSProperties } from "react"

export type ResultRowFormat = "currency" | "number" | "percent"

interface ResultRow {
  label: string
  value: number
  format?: ResultRowFormat
  highlight?: boolean
}

interface ResultCardProps {
  title: string
  rows: ResultRow[]
  style?: CSSProperties
}

function formatRow(value: number, format: ResultRowFormat): string {
  if (format === "percent") return `${(value * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
  if (format === "number") return value.toLocaleString("es-MX", { maximumFractionDigits: 2 })
  return formatCurrency(value)
}

export function ResultCard({ title, rows, style }: ResultCardProps) {
  return (
    <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", ...style }}>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {rows.map((row) => (
          <div key={row.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: row.highlight ? "1rem" : "0.875rem",
            fontWeight: row.highlight ? 700 : 400,
            padding: "0.25rem 0", borderBottom: "1px solid var(--border)",
          }}>
            <span>{row.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatRow(row.value, row.format ?? "currency")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
