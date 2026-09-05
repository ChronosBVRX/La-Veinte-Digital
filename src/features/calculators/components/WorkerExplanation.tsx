"use client"

import { HelpCircle, CheckCircle2 } from "lucide-react"

export interface ExplanationPoint {
  title?: string
  text: string
}

interface WorkerExplanationProps {
  title?: string
  points: ExplanationPoint[]
}

export function WorkerExplanation({
  title = "¿Qué debes tomar en cuenta?",
  points,
}: WorkerExplanationProps) {
  return (
    <div
      style={{
        background: "var(--accent)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.875rem",
        }}
      >
        <HelpCircle size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            margin: 0,
            color: "var(--fg)",
          }}
        >
          {title}
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {points.map((p, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              fontSize: "0.84375rem",
              lineHeight: 1.45,
              color: "var(--fg)",
            }}
          >
            <CheckCircle2
              size={15}
              style={{
                color: "var(--primary)",
                flexShrink: 0,
                marginTop: "0.2rem",
                opacity: 0.8,
              }}
            />
            <div>
              {p.title && (
                <strong style={{ display: "inline", color: "var(--fg)", marginRight: "0.35rem" }}>
                  {p.title}:
                </strong>
              )}
              <span style={{ color: "var(--fg)", opacity: 0.9 }}>{p.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
