"use client"

import { useState } from "react"
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react"

interface CalculatorNoticeProps {
  title?: string
  text?: string
  additionalInfo?: string
}

export function CalculatorNotice({
  title = "Toma en cuenta",
  text = "Esta es una estimación basada en tus datos actuales. La cantidad final puede cambiar si en tu nómina existen descuentos, incidencias u otros movimientos que esta calculadora no conoce.",
  additionalInfo,
}: CalculatorNoticeProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div
      style={{
        background: "rgba(245, 158, 11, 0.05)",
        border: "1px solid rgba(245, 158, 11, 0.25)",
        borderRadius: "var(--radius-lg)",
        padding: "0.875rem 1.125rem",
        fontSize: "0.8125rem",
        color: "var(--fg)",
        lineHeight: 1.45,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
        <AlertCircle
          size={18}
          style={{ color: "var(--warning)", flexShrink: 0, marginTop: "0.125rem" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: "0 0 0.25rem",
              fontWeight: 700,
              color: "var(--warning)",
              fontSize: "0.8125rem",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {title}
          </p>
          <p style={{ margin: 0, color: "var(--fg)", opacity: 0.9 }}>{text}</p>

          {additionalInfo && (
            <>
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "0.25rem 0 0",
                  marginTop: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--primary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                {showDetails ? "Ocultar detalles normativos" : "Ver detalles normativos"}
                {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showDetails && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(245, 158, 11, 0.2)",
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {additionalInfo}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
