"use client"

import { formatCurrency } from "../lib/money"
import type { ProjectionTotals } from "../lib/types"
import { Info } from "lucide-react"

interface ProjectionSummaryProps {
  totals: ProjectionTotals
}

export function ProjectionSummary({ totals }: ProjectionSummaryProps) {
  return (
    <div style={{ padding: "0.75rem 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Percepciones confirmadas</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(totals.confirmedEarnings)}</span>
        </div>

        {totals.probableEarnings > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
            <span>Percepciones probables adicionales</span>
            <span>+{formatCurrency(totals.probableEarnings)}</span>
          </div>
        )}

        {totals.conditionalPotentialEarnings > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
            <span>Potencial condicionado</span>
            <span>+{formatCurrency(totals.conditionalPotentialEarnings)}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "0.375rem" }}>
          <span style={{ fontWeight: 700 }}>Percepciones estimadas</span>
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>
            {formatCurrency(totals.confirmedGross)}
          </span>
        </div>

        {totals.confirmedDeductions > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Deducciones confirmadas</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(totals.confirmedDeductions)}</span>
            </div>
            {totals.confirmedNet !== undefined && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "1rem", borderTop: "2px solid var(--fg)",
                paddingTop: "0.5rem", marginTop: "0.25rem",
              }}>
                <span style={{ fontWeight: 700 }}>Líquido estimado</span>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                  {formatCurrency(totals.confirmedNet)}
                </span>
              </div>
            )}
          </>
        )}

        {totals.estimatedNetRange && (
          <div style={{
            marginTop: "0.5rem",
            background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)",
            borderRadius: "var(--radius)", padding: "0.5rem 0.75rem",
            display: "flex", gap: "0.5rem", fontSize: "0.75rem",
          }}>
            <Info size={14} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.125rem" }} />
            <div style={{ color: "var(--muted)" }}>
              Rango estimado: {formatCurrency(totals.estimatedNetRange.minimum)} – {formatCurrency(totals.estimatedNetRange.maximum)}
              <br />
              <strong>Nota:</strong> No todas las deducciones están calculadas. Este rango es informativo.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
