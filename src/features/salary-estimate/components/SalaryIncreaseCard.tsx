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
const PROFILE_HREF = "/profile/mi-informacion-laboral"
const IMPORT_MESSAGE = "Importa tu tarjetón más reciente para conocer tu aumento salarial estimado."
const LOADING_MESSAGE = "Estamos revisando tu tarjetón más reciente."
const UNKNOWN_MESSAGE = "No pudimos consultar tu información laboral en este momento."

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
  const { context, status, error, retry } = useWorkerContextSync(null)

  const selection = useMemo(() => {
    return selectSalaryEstimateInputs(context)
  }, [context])

  const result = useMemo(() => {
    return calculateSalaryIncrease(selection)
  }, [selection])

  // 1. Estado "cargando"
  if (status === "loading") {
    return (
      <NoticeCapsule testId="salary-estimate-loading">
        {LOADING_MESSAGE}
      </NoticeCapsule>
    )
  }

  // 2. Estado "no se pudo consultar; reintentar" (error de red o servidor)
  if (status === "error") {
    if (error?.status === 401 || error?.code === "unauthorized") {
      return (
        <NoticeCapsule testId="salary-estimate-error">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span>Tu sesión ha expirado o no pudimos autenticarte.</span>
            <Link href="/login" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
              Inicia sesión para consultar tu aumento estimado
            </Link>
          </div>
        </NoticeCapsule>
      )
    }

    return (
      <NoticeCapsule testId="salary-estimate-error">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span>{UNKNOWN_MESSAGE}</span>
          <div>
            <button
              type="button"
              onClick={retry}
              style={{
                background: "rgba(37,99,235,0.12)",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                borderRadius: "var(--radius-md, 0.375rem)",
                padding: "0.25rem 0.625rem",
                fontSize: "var(--text-xs, 0.75rem)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </NoticeCapsule>
    )
  }

  // 3. Estado "no hay tarjetón guardado" (solo cuando NO existe tarjetón en la base)
  if (!selection.hasPayslip || result.calculationStatus === "missing-payslip") {
    return (
      <NoticeCapsule testId="salary-estimate-empty">
        <Link href={IMPORT_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
          {IMPORT_MESSAGE}
        </Link>
      </NoticeCapsule>
    )
  }

  // 4. Estado "tarjetón guardado, pero faltan conceptos confirmados"
  // NUNCA invitar a importar cuando ya existe un tarjetón guardado; dirigir a revisar
  if (result.calculationStatus === "missing-concept11") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[salary-estimate] Concepto 11 no detectado en el tarjetón activo.")
    }
    return (
      <NoticeCapsule testId="salary-estimate-missing-concepts">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Tu tarjetón guardado no incluye ayuda para renta (concepto 011) confirmada para la estimación.</span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  if (result.calculationStatus === "missing-tabular") {
    return (
      <NoticeCapsule testId="salary-estimate-missing-concepts">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Tu tarjetón guardado no incluye sueldo tabular (concepto 002) ni sueldo sustituto (concepto 008) confirmados.</span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  // 5. Estado "cobertura insuficiente para estimar / faltan datos para estimar"
  if (result.calculationStatus === "insufficient-data") {
    return (
      <NoticeCapsule testId="salary-estimate-insufficient-data">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Faltan datos para estimar el aumento. Tu tarjetón registra sueldo tabular y sueldo sustituto simultáneos sin desglose de tramos acreditado.</span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  // 6. Tarjetón posterior al 16 de octubre de 2026 (quincena 20 / nuevo tabulador)
  // No se devuelve un incremento de $0.00 como si fuera calculado ni se afirma que el tabulador ya se aplicó sin comprobar
  if (result.calculationStatus === "new-schedule-unverified") {
    return (
      <NoticeCapsule testId="salary-estimate-new-schedule">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <strong style={{ color: "#1d4ed8" }}>Vigencia nueva: requiere comprobar importes</strong>
          <span>
            Tu tarjetón activo {selection.activePeriod ? `(${selection.activePeriod}) ` : ""}corresponde a la segunda quincena de octubre de 2026 o posterior. Es necesario comprobar si tus percepciones ya incorporan el tabulador 2026 o el anterior antes de calcular un incremento estimado.
          </span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline", marginTop: "0.25rem" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  // 7. Concepto 011 en $0.00: estimación pendiente de comprobar al no existir base comparable acreditada
  if (result.calculationStatus === "unverified-comparable-base") {
    return (
      <NoticeCapsule testId="salary-estimate-unverified-base">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <strong style={{ color: "#1d4ed8" }}>Estimación pendiente de comprobar</strong>
          <span>
            Tu tarjetón registra ayuda para renta (concepto 011) en $0.00. Al no existir una base comparable acreditada de este concepto en el recibo, la estimación queda reservada hasta verificar tus percepciones habituales.
          </span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline", marginTop: "0.25rem" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  if (result.calculationStatus !== "ok") {
    return (
      <NoticeCapsule testId="salary-estimate-missing-concepts">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>No pudimos calcular la estimación con los datos de tu tarjetón guardado.</span>
          <Link href={PROFILE_HREF} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
            Revisar mi información laboral
          </Link>
        </div>
      </NoticeCapsule>
    )
  }

  const aumentoFormateado = formatCurrency(result.estimatedFortnightlyIncrease)

  const substituteDescription =
    result.substituteCoverage === "partial_confirmed" && result.daysPaid
      ? `Estimación calculada sobre tu sueldo sustituto (concepto 008, cobertura comprobada de ${result.daysPaid} días pagados) y ayuda de renta (concepto 011). Corresponde únicamente a la cobertura quincenal trabajada; el concepto 008 no acredita días futuros ni tipo permanente de contratación.`
      : "Estimación calculada sobre la percepción por sustitución (concepto 008) y ayuda de renta (concepto 011) de este recibo específico. Al no contar con desglose comprobado de días trabajados, este cálculo refleja únicamente la cobertura quincenal registrada; el concepto 008 no acredita días futuros ni tipo permanente de contratación."

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
          <span style={{ ...label, color: "#bfdbfe" }}>
            {result.salaryType === "substitute" ? "Tu aumento estimado (Sustitución)" : "Tu aumento estimado"}
          </span>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-md)", lineHeight: 1.55, color: "#ffffff" }}>
          Con esta actualización salarial ganarías aproximadamente{" "}
          <span style={{ fontSize: "var(--text-xl)", fontWeight: 800, whiteSpace: "nowrap" }}>
            {aumentoFormateado}
          </span>{" "}
          más brutos por quincena.
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-xs)", lineHeight: 1.5, color: "#c7d2fe" }}>
          {result.salaryType === "substitute"
            ? substituteDescription
            : "Estimación calculada sobre tu sueldo tabular (concepto 002) y ayuda de renta (concepto 011) de tu tarjetón más reciente, sujeta al convenio salarial definitivo."}
        </p>
        <div
          style={{
            marginTop: "0.625rem",
            padding: "0.45rem 0.6rem",
            background: "rgba(255, 255, 255, 0.12)",
            borderRadius: "var(--radius-sm, 0.25rem)",
            fontSize: "var(--text-xs, 0.75rem)",
            lineHeight: 1.45,
            color: "#e0e7ff",
          }}
        >
          <strong>Hipótesis de estimación preliminar:</strong> sueldo base +2.9% y factor Concepto 11 del 86.05% (hipótesis de cálculo frente al 82.15% contractual vigente según Cláusula 63 Bis, hasta contar con el documento oficial definitivo del Convenio Salarial 2026).
        </div>
        {error && (
          <div
            role="status"
            style={{
              marginTop: "0.5rem",
              padding: "0.35rem 0.5rem",
              borderRadius: "var(--radius-sm, 0.25rem)",
              background: "rgba(254, 243, 199, 0.18)",
              border: "1px solid rgba(253, 230, 138, 0.35)",
              color: "#fef3c7",
              fontSize: "var(--text-xs, 0.75rem)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Mostrando el último cálculo disponible. No pudimos verificar actualizaciones recientes.</span>
            <button
              type="button"
              onClick={retry}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              Reintentar
            </button>
          </div>
        )}
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
        <div style={{ margin: "0.5rem 0 0", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>{children}</div>
      </div>
    </section>
  )
}
