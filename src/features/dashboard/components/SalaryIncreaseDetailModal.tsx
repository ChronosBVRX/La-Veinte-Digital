"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { X, TrendUp, Info } from "@phosphor-icons/react"
import type { SalaryEstimateResult } from "@/features/salary-estimate/lib/calculate-salary-increase"
import { formatCurrency } from "@/features/calculators/lib/money"

interface SalaryIncreaseDetailModalProps {
  open: boolean
  onClose: () => void
  result: SalaryEstimateResult
  activePeriod?: string | null
}

export function SalaryIncreaseDetailModal({
  open,
  onClose,
  result,
  activePeriod,
}: SalaryIncreaseDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const formattedIncrease = formatCurrency(result.estimatedFortnightlyIncrease)
  const isSubstitute = result.salaryType === "substitute"

  const substituteDescription =
    result.substituteCoverage === "partial_confirmed" && result.daysPaid
      ? `Estimación calculada sobre tu sueldo sustituto (concepto 008, cobertura comprobada de ${result.daysPaid} días pagados) y ayuda de renta (concepto 011). Corresponde únicamente a la cobertura quincenal trabajada; el concepto 008 no acredita días futuros ni tipo permanente de contratación.`
      : "Estimación calculada sobre la percepción por sustitución (concepto 008) y ayuda de renta (concepto 011) de este recibo específico. Al no contar con desglose comprobado de días trabajados, este cálculo refleja únicamente la cobertura quincenal registrada; el concepto 008 no acredita días futuros ni tipo permanente de contratación."

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        boxSizing: "border-box",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        style={{
          backgroundColor: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 1rem)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.5rem",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(37, 99, 235, 0.12)",
                color: "var(--primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <TrendUp size={20} weight="bold" />
            </span>
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--primary, #2563eb)",
                }}
              >
                {isSubstitute ? "Tu aumento estimado (Sustitución)" : "Tu aumento estimado"}
              </span>
              <h3 id="salary-detail-title" style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.15rem 0 0", color: "var(--fg, #0f172a)" }}>
                Detalle del aumento estimado
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              color: "var(--muted, #64748b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cifra destacada */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
            border: "1px solid rgba(37, 99, 235, 0.2)",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted, #64748b)" }}>
            Incremento quincenal bruto estimado
          </span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--primary, #2563eb)" }}>
            +{formattedIncrease}{" "}
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted, #64748b)" }}>
              por quincena
            </span>
          </div>
          {activePeriod && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              Basado en el periodo: <strong>{activePeriod}</strong>
            </span>
          )}
        </div>

        {/* Desglose explicativo */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg, #0f172a)" }}>
          <p style={{ margin: 0 }}>
            {isSubstitute
              ? substituteDescription
              : "Estimación calculada sobre tu sueldo tabular (concepto 002) y ayuda de renta (concepto 011) de tu tarjetón más reciente, sujeta al convenio salarial definitivo."}
          </p>

          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--accent, #f1f5f9)",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              lineHeight: 1.45,
              color: "var(--fg, #0f172a)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", fontWeight: 700, color: "var(--primary, #2563eb)" }}>
              <Info size={16} weight="bold" />
              <span>Hipótesis de estimación preliminar:</span>
            </div>
            Sueldo base +2.9% y factor Concepto 11 del 86.05% (hipótesis de cálculo frente al 82.15% contractual vigente según Cláusula 63 Bis, hasta contar con el documento oficial definitivo del Convenio Salarial 2026).
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <Link
            href="/profile/mi-informacion-laboral"
            onClick={onClose}
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--primary, #2563eb)",
              textDecoration: "underline",
            }}
          >
            Revisar mi información laboral →
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "var(--radius, 0.5rem)",
              background: "var(--accent, #f1f5f9)",
              border: "1px solid var(--border, #e2e8f0)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--fg, #0f172a)",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
