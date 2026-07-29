import { formatCurrency } from "../lib/money"
import type { CSSProperties } from "react"

interface ResultRow {
  label: string
  value: number
  highlight?: boolean
}

interface ResultCardProps {
  title: string
  rows: ResultRow[]
  style?: CSSProperties
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
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
