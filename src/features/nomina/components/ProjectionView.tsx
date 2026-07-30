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

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado",
    probable: "Probable",
    requires_answer: "C/R",
    not_eligible: "No elegible",
    insufficient_data: "Sin datos",
    confirmed_from_payslip: "En tarjetón",
    user_reported: "Reportado",
    unknown: "No confirmado",
    not_authorized: "No autorizado",
    calculated: "Calculado",
    missing_base: "Sin base",
    formula_pending_validation: "Pendiente",
  }

  const evalStatus = concept.evaluationStatus

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
        {evalStatus && (
          <Badge
            variant={
              evalStatus.administrativeStatus === "confirmed" || evalStatus.administrativeStatus === "confirmed_from_payslip"
                ? "success"
                : evalStatus.eligibilityStatus === "probable"
                ? "warning"
                : evalStatus.eligibilityStatus === "requires_answer"
                ? "info"
                : "default"
            }
            size="sm"
          >
            {statusLabels[evalStatus.administrativeStatus === "confirmed" || evalStatus.administrativeStatus === "confirmed_from_payslip"
              ? evalStatus.administrativeStatus
              : evalStatus.eligibilityStatus
            ] ?? concept.confidence}
          </Badge>
        )}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div style={{
          marginTop: "0.5rem", padding: "0.75rem",
          background: "var(--accent)", borderRadius: "var(--radius)",
          fontSize: "0.75rem", lineHeight: 1.6,
        }}>
          {evalStatus && (
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Evaluación:</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1rem" }}>
                <li>Matemático: {statusLabels[evalStatus.mathematicalStatus]}</li>
                <li>Elegibilidad: {statusLabels[evalStatus.eligibilityStatus]}</li>
                <li>Administrativo: {statusLabels[evalStatus.administrativeStatus]}</li>
              </ul>
            </div>
          )}
          {concept.calculationSteps.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Cómo se calculó:</strong>
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
  const handlePrint = () => { window.print() }

  const confLabel: Record<string, string> = {
    high: "Alta", medium: "Media", low: "Baja",
  }

  const showEarnings = projection.earnings.length > 0
  const showProbable = projection.probableConcepts.length > 0
  const showConditional = projection.conditionalConcepts.length > 0
  const showExcluded = projection.excludedConcepts.length > 0
  const t = projection.totals

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
          <div><strong>Antigüedad:</strong> {projection.seniorityAtPeriodEnd.years}a {projection.seniorityAtPeriodEnd.months}m</div>
          <div><strong>Confianza:</strong> {confLabel[projection.confidence] ?? projection.confidence}</div>
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
          Percepciones Confirmadas
        </h3>
        <div style={{ marginBottom: "1.25rem" }}>
          {showEarnings ? projection.earnings.map((c) => (
            <ConceptRow key={c.code} concept={c} />
          )) : (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
              Sin percepciones confirmadas
            </p>
          )}
        </div>

        {showProbable && (
          <>
            <h3 style={{
              fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
              color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Percepciones Probables
            </h3>
            <div style={{ marginBottom: "1.25rem" }}>
              {projection.probableConcepts.map((c) => (
                <ConceptRow key={`prob-${c.code}`} concept={c} />
              ))}
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>
                Requieren confirmar la asociaci&oacute;n administrativa o su aparici&oacute;n en un tarjet&oacute;n anterior.
              </p>
            </div>
          </>
        )}

        {showConditional && (
          <>
            <h3 style={{
              fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
              color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Conceptos Condicionados
            </h3>
            <div style={{ marginBottom: "1.25rem" }}>
              {projection.conditionalConcepts.map((c) => (
                <ConceptRow key={`cond-${c.code}`} concept={c} />
              ))}
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>
                Podr&iacute;an aplicar, pero falta informaci&oacute;n para confirmarlos.
              </p>
            </div>
          </>
        )}

        {showExcluded && (
          <>
            <h3 style={{
              fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
              color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Conceptos No Incluidos
            </h3>
            <div style={{ marginBottom: "1.25rem" }}>
              {projection.excludedConcepts.map((c) => (
                <div key={`excl-${c.code}`} style={{ fontSize: "0.8125rem", padding: "0.375rem 0", color: "var(--muted)" }}>
                  <strong>{c.code}</strong> {c.name}
                  {c.warnings.length > 0 && (
                    <span style={{ fontSize: "0.75rem", display: "block", color: "var(--warning)" }}>
                      {c.warnings[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <h3 style={{
          fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem",
          color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Deducciones
        </h3>
        <div style={{ marginBottom: "1.25rem" }}>
          {projection.deductions.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
              Sin deducciones calculadas
            </p>
          ) : (
            projection.deductions.map((c) => (
              <ConceptRow key={c.code} concept={c} />
            ))
          )}
        </div>

        <div style={{
          borderTop: "2px solid var(--fg)", paddingTop: "0.75rem",
          display: "flex", flexDirection: "column", gap: "0.375rem",
          fontSize: "0.875rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Percepciones confirmadas</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(t.confirmedEarnings)}</span>
          </div>
          {t.probableEarnings > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--warning)" }}>
              <span>Percepciones probables adicionales</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(t.probableEarnings)}</span>
            </div>
          )}
          {t.conditionalPotentialEarnings > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--info)" }}>
              <span>M&aacute;ximo potencial identificado</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(t.conditionalPotentialEarnings)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Deducciones confirmadas</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(t.confirmedDeductions)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: "1rem", borderTop: "1px solid var(--border)",
            paddingTop: "0.5rem", marginTop: "0.25rem",
          }}>
            <span style={{ fontWeight: 700 }}>Percepciones estimadas</span>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>
              {formatCurrency(t.confirmedEarnings + t.probableEarnings)}
            </span>
          </div>
          {t.confirmedNet !== undefined && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: "1rem",
            }}>
              <span style={{ fontWeight: 700 }}>Líquido estimado</span>
              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                {formatCurrency(t.confirmedNet)}
              </span>
            </div>
          )}
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
