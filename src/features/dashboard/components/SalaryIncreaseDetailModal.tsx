"use client"

import Link from "next/link"
import { TrendUp, Info } from "@phosphor-icons/react"
import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog"
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
  if (!open) return null

  const formattedIncrease = formatCurrency(result.estimatedFortnightlyIncrease)
  const isSubstitute = result.salaryType === "substitute"

  const substituteDescription =
    result.substituteCoverage === "partial_confirmed" && result.daysPaid
      ? `Estimación calculada sobre tu sueldo sustituto (concepto 008, cobertura comprobada de ${result.daysPaid} días pagados) y ayuda de renta (concepto 011). Corresponde únicamente a la cobertura quincenal trabajada; el concepto 008 no acredita días futuros ni tipo permanente de contratación.`
      : "Estimación calculada sobre la percepción por sustitución (concepto 008) y ayuda de renta (concepto 011) de este recibo específico. Al no contar con desglose comprobado de días trabajados, este cálculo refleja únicamente la cobertura quincenal registrada; el concepto 008 no acredita días futuros ni tipo permanente de contratación."

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      size="md"
      sheetHeight="large"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(37, 99, 235, 0.12)",
              color: "var(--primary, #2563eb)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendUp size={18} weight="bold" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--primary, #2563eb)",
              }}
            >
              {isSubstitute ? "Tu aumento estimado (Sustitución)" : "Tu aumento estimado"}
            </span>
            <span
              id="salary-detail-title"
              style={{
                fontSize: "1.125rem",
                fontWeight: 800,
                color: "var(--fg, #0f172a)",
                lineHeight: 1.25,
                margin: "0.1rem 0 0",
              }}
            >
              Detalle del aumento estimado
            </span>
          </div>
        </div>
      }
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
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
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            color: "var(--fg, #0f172a)",
          }}
        >
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                marginBottom: "0.25rem",
                fontWeight: 700,
                color: "var(--primary, #2563eb)",
              }}
            >
              <Info size={16} weight="bold" />
              <span>Hipótesis de estimación preliminar:</span>
            </div>
            Sueldo base +2.9% y factor Concepto 11 del 86.05% (hipótesis de cálculo frente al 82.15% contractual vigente según Cláusula 63 Bis, hasta contar con el documento oficial definitivo del Convenio Salarial 2026).
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
