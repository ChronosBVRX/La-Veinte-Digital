"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { formatCurrency } from "../lib/money"
import type { PayrollProjection, CalculatedPayrollConcept } from "../lib/types"
import { ChevronDown, ChevronUp, AlertTriangle, Info, Printer } from "lucide-react"

interface ProjectionViewProps {
  projection: PayrollProjection
  onBack?: () => void
}

function ConceptRow({ concept }: { concept: CalculatedPayrollConcept }) {
  const [expanded, setExpanded] = useState(false)

  const confidenceColor: Record<string, "success" | "warning" | "error" | "info"> = {
    high: "success",
    medium: "warning",
    low: "error",
    requires_confirmation: "info",
  }

  return (
    <div style={{
      borderBottom: "1px solid var(--border)",
      padding: "0.625rem 0",
    }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.8125rem", minWidth: "3rem" }}>
            {concept.code}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            {concept.name}
          </span>
        </div>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(concept.amount)}
        </span>
        <Badge variant={confidenceColor[concept.confidence] ?? "default"} size="sm">
          {concept.confidence === "high" ? "Alta" :
           concept.confidence === "medium" ? "Media" :
           concept.confidence === "low" ? "Baja" : "C/R"}
        </Badge>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div style={{
          marginTop: "0.5rem", padding: "0.75rem",
          background: "var(--accent)", borderRadius: "var(--radius)",
          fontSize: "0.75rem", lineHeight: 1.6,
        }}>
          {concept.calculationSteps.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Pasos:</strong>
              <ol style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                {concept.calculationSteps.map((s, i) => (
                  <li key={i}>{s.label}: {s.expression} = {formatCurrency(s.value)}</li>
                ))}
              </ol>
            </div>
          )}
          {concept.dependencies.length > 0 && (
            <div style={{ marginBottom: "0.375rem" }}>
              <strong>Dependencias:</strong>{" "}
              {concept.dependencies.map((d) => `${d.code} (${formatCurrency(d.amount)})`).join(", ")}
            </div>
          )}
          {concept.legalBasis.length > 0 && (
            <div style={{ marginBottom: "0.375rem" }}>
              <strong>Fundamento:</strong>{" "}
              {concept.legalBasis.map((b) => `${b.title} (${b.reference})`).join(", ")}
            </div>
          )}
          {concept.warnings.length > 0 && (
            <div style={{ color: "var(--warning)" }}>
              <strong>Advertencias:</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1rem" }}>
                {concept.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ProjectionView({ projection, onBack }: ProjectionViewProps) {
  const handlePrint = () => {
    window.print()
  }

  const confidenceLabel =
    projection.confidence === "high" ? "Alta" :
    projection.confidence === "medium" ? "Media" : "Baja"

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      {onBack && (
        <Button variant="ghost" onClick={onBack} style={{ marginBottom: "1rem" }}>
          &larr; Volver
        </Button>
      )}

      <Card padding="1.5rem">
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
            PROYECCIÓN DE TARJETÓN
          </h2>
          <p style={{
            fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase",
            letterSpacing: "0.08em", margin: 0,
          }}>
            Proyección informativa de nómina — No oficial
          </p>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem",
          fontSize: "0.8125rem", marginBottom: "1.25rem",
          padding: "0.75rem", background: "var(--accent)", borderRadius: "var(--radius)",
        }}>
          <div><strong>Periodo:</strong> {projection.period.label}</div>
          <div><strong>Categoría:</strong> {projection.category.categoryName}</div>
          <div><strong>Antigüedad:</strong> {projection.seniorityAtPeriodEnd.years} a&ntilde;os, {projection.seniorityAtPeriodEnd.months} meses</div>
          <div><strong>Confianza:</strong> {confidenceLabel}</div>
          <div><strong>Modo:</strong> {projection.mode}</div>
        </div>

        {projection.warnings.length > 0 && (
          <div style={{
            background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)",
            borderRadius: "var(--radius)", padding: "0.75rem", marginBottom: "1rem",
            display: "flex", gap: "0.5rem", fontSize: "0.75rem",
          }}>
            <AlertTriangle size={16} style={{ color: "var(--warning)", flexShrink: 0, marginTop: "0.125rem" }} />
            <div style={{ color: "var(--muted)" }}>
              {projection.warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          </div>
        )}

        <h3 style={{
          fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
          color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Percepciones
        </h3>
        <div style={{ marginBottom: "1.25rem" }}>
          {projection.earnings.length === 0 && (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
              Sin percepciones calculadas
            </p>
          )}
          {projection.earnings.map((c) => (
            <ConceptRow key={c.code} concept={c} />
          ))}
        </div>

        <h3 style={{
          fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
          color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Deducciones
        </h3>
        <div style={{ marginBottom: "1.25rem" }}>
          {projection.deductions.length === 0 && (
            <p style={{
              fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic",
            }}>
              Sin deducciones calculadas
            </p>
          )}
          {projection.deductions.map((c) => (
            <ConceptRow key={c.code} concept={c} />
          ))}
        </div>

        <div style={{
          borderTop: "2px solid var(--fg)", paddingTop: "0.75rem",
          display: "flex", flexDirection: "column", gap: "0.375rem",
          fontSize: "0.875rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total percepciones</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(projection.totalEarnings)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total deducciones</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(projection.totalDeductions)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: "1rem", borderTop: "1px solid var(--border)",
            paddingTop: "0.5rem", marginTop: "0.25rem",
          }}>
            <span style={{ fontWeight: 700 }}>Líquido estimado</span>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>
              {formatCurrency(projection.estimatedNet)}
            </span>
          </div>
        </div>

        {projection.requiredConfirmations.length > 0 && (
          <div style={{
            marginTop: "1rem",
            background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)",
            borderRadius: "var(--radius)", padding: "0.75rem",
            display: "flex", gap: "0.5rem", fontSize: "0.75rem",
          }}>
            <Info size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.125rem" }} />
            <div style={{ color: "var(--muted)" }}>
              <strong>Requieren confirmaci&oacute;n:</strong>{" "}
              {projection.requiredConfirmations.join(", ")}
            </div>
          </div>
        )}

        <div style={{
          marginTop: "1rem",
          background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)",
          borderRadius: "var(--radius)", padding: "0.75rem",
          fontSize: "0.6875rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5,
        }}>
          Esta herramienta genera una estimaci&oacute;n informativa basada en los datos proporcionados,
          el tabulador registrado y las reglas configuradas. El pago real puede variar por incidencias,
          impuestos, ajustes, retroactivos, cr&eacute;ditos y criterios institucionales.
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "center" }}>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir
          </Button>
        </div>
      </Card>
    </div>
  )
}
