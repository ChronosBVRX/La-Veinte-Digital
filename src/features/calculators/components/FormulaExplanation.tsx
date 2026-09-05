"use client"

import { BookOpen } from "lucide-react"

interface FormulaExplanationProps {
  title?: string
  steps: string[]
  fundamento?: string
}

export function FormulaExplanation({
  title = "Cómo hicimos el cálculo",
  steps,
  fundamento,
}: FormulaExplanationProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "1rem 1.125rem",
        fontSize: "0.8125rem",
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          fontWeight: 700,
          margin: "0 0 0.625rem",
          fontSize: "0.8125rem",
          color: "var(--fg)",
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        <BookOpen size={15} style={{ color: "var(--primary)" }} />
        {title}
      </p>

      <ol
        style={{
          margin: 0,
          paddingLeft: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          color: "var(--fg)",
          opacity: 0.9,
        }}
      >
        {steps.map((step, i) => (
          <li key={i} style={{ lineHeight: 1.5 }}>
            {step}
          </li>
        ))}
      </ol>

      {fundamento && (
        <div
          style={{
            marginTop: "0.75rem",
            paddingTop: "0.625rem",
            borderTop: "1px solid var(--border)",
            fontSize: "0.75rem",
            color: "var(--muted)",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: "var(--fg)", opacity: 0.9 }}>Fundamento normativo:</strong>{" "}
          {fundamento}
        </div>
      )}
    </div>
  )
}
