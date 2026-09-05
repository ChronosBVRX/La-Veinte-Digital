"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, FileCode, ShieldCheck } from "lucide-react"

interface TechnicalDetailsProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  initiallyOpen?: boolean
}

export function TechnicalDetails({
  title = "Ver cálculo detallado y fundamento legal",
  subtitle = "Para revisión de nómina, desglose de claves y normativa aplicable.",
  children,
  initiallyOpen = false,
}: TechnicalDetailsProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--card)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          padding: "1rem 1.25rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          textAlign: "left",
          minHeight: "48px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <FileCode size={18} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--fg)",
              }}
            >
              {title}
            </span>
            {subtitle && (
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: "0.125rem",
                }}
              >
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--primary)",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <span>{isOpen ? "Ocultar" : "Mostrar"}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            padding: "0 1.25rem 1.25rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            background: "rgba(248, 250, 252, 0.5)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              paddingTop: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--muted)",
            }}
          >
            <ShieldCheck size={14} style={{ color: "var(--primary)" }} />
            <span>Datos técnicos verificables conforme al CCT IMSS-SNTSS y tabuladores oficiales.</span>
          </div>

          {children}
        </div>
      )}
    </div>
  )
}
