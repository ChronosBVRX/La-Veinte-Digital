"use client"

import Link from "next/link"
import { useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { TrendUp } from "@phosphor-icons/react"
import { useWorkerContextSync } from "@/shared/hooks/useLiveWorkerContext"
import { formatCurrency } from "@/features/calculators/lib/money"
import { calculateSalaryIncrease } from "@/features/salary-estimate/lib/calculate-salary-increase"
import { selectSalaryEstimateInputs } from "@/features/salary-estimate/services/salary-estimate-selector"

const IMPORT_HREF = "/profile/mi-informacion-laboral"
const IMPORT_MESSAGE = "Importa tu tarjetón más reciente para conocer tu aumento salarial estimado."
const LOADING_MESSAGE = "Estamos revisando tu tarjetón más reciente."
const UNKNOWN_MESSAGE = "No pudimos confirmar tu aumento estimado por ahora. Intenta de nuevo más tarde."

const capsule: CSSProperties = {
  borderRadius: "var(--radius-lg)",
  padding: "1.1rem 1.25rem",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  overflowWrap: "break-word",
}

const label: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
}

/**
 * Cápsula azul en inicio con el aumento quincenal bruto estimado.
 * Mismo lenguaje visual que la tarjeta superior (WelcomeCard) para llamar la
 * atención. Lee el tarjetón activo vía `useWorkerContextSync` (misma fuente
 * que las calculadoras) y se actualiza con `nomina_payslip_updated` +
 * BroadcastChannel. Sin animaciones: respeta `prefers-reduced-motion`.
 */
export function SalaryIncreaseCard() {
  const { context, status } = useWorkerContextSync(null)

  const result = useMemo(() => {
    const selection = selectSalaryEstimateInputs(context)
    return calculateSalaryIncrease(selection)
  }, [context])

  if (status === "loading") {
    return (
      <NoticeCapsule testId="salary-estimate-loading">
        {LOADING_MESSAGE}
      </NoticeCapsule>
    )
  }

  if (status === "error") {
    return (
      <NoticeCapsule testId="salary-estimate-error">
        {UNKNOWN_MESSAGE}
      </NoticeCapsule>
    )
  }

  if (result.calculationStatus === "missing-concept11" && process.env.NODE_ENV !== "production") {
    console.info("[salary-estimate] Concepto 11 no detectado en el tarjetón activo; se muestra mensaje de revisión.")
  }

  if (result.calculationStatus !== "ok") {
    return (
      <NoticeCapsule testId="salary-estimate-empty">
        <Link href={IMPORT_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
          {IMPORT_MESSAGE}
        </Link>
      </NoticeCapsule>
    )
  }

  const aumentoFormateado = formatCurrency(result.estimatedFortnightlyIncrease)

  return (
    <section
      aria-label="Tu aumento estimado"
      data-testid="salary-estimate-card"
      style={{ marginBottom: "var(--space-4)", minWidth: 0, maxWidth: "100%" }}
    >
      <div
        style={{
          ...capsule,
          background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
          color: "#ffffff",
          boxShadow: "0 6px 20px rgba(37,99,235,0.32)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(191,219,254,0.18)",
              color: "#bfdbfe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendUp size={16} weight="bold" />
          </span>
          <span style={{ ...label, color: "#bfdbfe" }}>Tu aumento estimado</span>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-md)", lineHeight: 1.55, color: "#ffffff" }}>
          Con esta actualización salarial ganarías aproximadamente{" "}
          <span style={{ fontSize: "var(--text-xl)", fontWeight: 800, whiteSpace: "nowrap" }}>
            {aumentoFormateado}
          </span>{" "}
          más brutos por quincena.
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-xs)", lineHeight: 1.5, color: "#c7d2fe" }}>
          Estimación basada en tu tarjetón más reciente y sujeta al convenio salarial definitivo.
        </p>
      </div>
    </section>
  )
}

function NoticeCapsule({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <section
      aria-label="Tu aumento estimado"
      data-testid={testId}
      style={{ marginBottom: "var(--space-4)", minWidth: 0, maxWidth: "100%" }}
    >
      <div
        style={{
          ...capsule,
          background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
          border: "1px solid #bfdbfe",
          boxShadow: "0 4px 14px rgba(37,99,235,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(37,99,235,0.12)",
              color: "#1d4ed8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendUp size={16} weight="bold" />
          </span>
          <span style={{ ...label, color: "#1d4ed8" }}>Tu aumento estimado</span>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>{children}</p>
      </div>
    </section>
  )
}
