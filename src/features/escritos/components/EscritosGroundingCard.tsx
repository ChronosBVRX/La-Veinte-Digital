"use client"

import { useState } from "react"
import { Card } from "@/shared/components/ui/Card"
import type { FuenteNormativaVerificada, GenerationMode } from "@/shared/contracts/escrito-draft"

export interface EscritosGroundingCardProps {
  fuentes: FuenteNormativaVerificada[]
  advertencias?: string[]
  generationMode: GenerationMode
}

export function EscritosGroundingCard({
  fuentes,
  advertencias,
  generationMode,
}: EscritosGroundingCardProps) {
  const [expanded, setExpanded] = useState(false)

  const hasFuentes = Array.isArray(fuentes) && fuentes.length > 0
  const hasAdvertencias = Array.isArray(advertencias) && advertencias.length > 0

  if (!hasFuentes && !hasAdvertencias && generationMode === "manual") {
    return null
  }

  const defaultWarning =
    "Los datos, fechas, cláusulas, artículos y reglamentos citados deben corroborarse antes de darlos por hecho o presentar el escrito."

  const warningList = hasAdvertencias
    ? advertencias
    : generationMode !== "manual"
    ? [defaultWarning]
    : []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", width: "100%", boxSizing: "border-box" }}>
      {warningList.length > 0 && (
        <div
          role="note"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "0.625rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.8rem",
            lineHeight: 1.45,
            color: "var(--fg)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: warningList.length > 1 ? "0.25rem" : 0 }}>
            ⚠️ Corrobora antes de dar por hecho
          </div>
          {warningList.map((adv, idx) => (
            <div key={idx} style={{ color: "var(--fg)" }}>
              {adv}
            </div>
          ))}
        </div>
      )}

      {hasFuentes && (
        <Card padding="0.75rem 0.875rem" style={{ background: "var(--card)", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
              📚 Sustento normativo recuperado ({fuentes.length}{" "}
              {fuentes.length === 1 ? "referencia" : "referencias"})
            </div>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              style={{
                background: "var(--accent)",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                padding: "0.25rem 0.625rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--fg)",
                cursor: "pointer",
              }}
            >
              {expanded ? "Ocultar contexto" : "Ver contexto"}
            </button>
          </div>

          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.625rem" }}>
              {fuentes.map((f, idx) => (
                <div
                  key={`${f.documento}_${f.numero || idx}_${idx}`}
                  style={{
                    background: "var(--accent)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    padding: "0.625rem 0.75rem",
                    fontSize: "0.78rem",
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
                    {f.documento}
                    {f.numero ? ` • ${f.numero}` : ""}
                    {f.paginaInicio ? ` (Pág. ${f.paginaInicio})` : ""}
                    {f.version ? ` • v.${f.version}` : ""}
                  </div>
                  <div style={{ color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                    {f.fragmento}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
