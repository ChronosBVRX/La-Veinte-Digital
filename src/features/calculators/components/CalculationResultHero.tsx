"use client"

import { formatCurrency } from "../lib/money"
import type { CSSProperties } from "react"
import { Sparkles } from "lucide-react"

interface CalculationResultHeroProps {
  badge?: string
  label?: string
  amount: number
  format?: "currency" | "number"
  explanation?: string
  secondaryHighlight?: {
    label: string
    value: string
  }
  style?: CSSProperties
}

export function CalculationResultHero({
  badge = "TU RESULTADO ESTIMADO",
  label = "Aproximadamente recibirías",
  amount,
  format = "currency",
  explanation,
  secondaryHighlight,
  style,
}: CalculationResultHeroProps) {
  const formattedAmount =
    format === "number"
      ? amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })
      : formatCurrency(amount)

  return (
    <div
      style={{
        background: "var(--card)",
        border: "2px solid rgba(37, 99, 235, 0.25)",
        borderRadius: "var(--radius-xl, 1rem)",
        padding: "1.5rem",
        boxShadow: "var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, var(--primary), #6366f1)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--primary)",
            background: "rgba(37, 99, 235, 0.08)",
            padding: "0.25rem 0.625rem",
            borderRadius: "var(--radius-full, 9999px)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <Sparkles size={13} />
          {badge}
        </span>
      </div>

      <p
        style={{
          fontSize: "0.9375rem",
          color: "var(--muted)",
          margin: 0,
          lineHeight: 1.3,
          fontWeight: 500,
        }}
      >
        {label}
      </p>

      <div
        style={{
          fontSize: "clamp(2rem, 6vw, 2.75rem)",
          fontWeight: 800,
          color: "var(--fg)",
          lineHeight: 1.15,
          margin: "0.375rem 0 0.875rem",
          fontVariantNumeric: "tabular-nums",
          wordBreak: "break-word",
        }}
      >
        {formattedAmount}
      </div>

      {explanation && (
        <div
          style={{
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
            padding: "0.875rem 1rem",
            marginTop: "0.75rem",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <p
            style={{
              fontSize: "0.78125rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--primary)",
              margin: "0 0 0.25rem",
            }}
          >
            ¿Qué significa esto para ti?
          </p>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--fg)",
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            {explanation}
          </p>
        </div>
      )}

      {secondaryHighlight && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.75rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ color: "var(--muted)" }}>{secondaryHighlight.label}</span>
          <strong style={{ color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
            {secondaryHighlight.value}
          </strong>
        </div>
      )}
    </div>
  )
}
