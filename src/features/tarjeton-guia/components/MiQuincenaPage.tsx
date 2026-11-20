"use client"

import { useState, useEffect } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  CaretLeft,
  CaretRight,
  ArrowRight,
  ListDashes,
  Steps as StepsIcon,
  CalendarCheck,
  WarningCircle,
} from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { PageContainer } from "@/shared/components/layout/PageContainer"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { BotonReintentarAnalisis } from "./BotonReintentarAnalisis"
import { useLatestPayslip } from "@/features/tarjeton-guia/hooks/useLatestPayslip"
import { buildExplainer, buildQuincenaSummary, type ExplainerStep, type IncidenceDateInfo } from "@/features/tarjeton-guia/lib/explainer"
import { buildReviewChecklist } from "@/features/tarjeton-guia/lib/review"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import type { ServerPayslipSummary } from "@/features/tarjeton-guia/services/fetch-latest-payslip"
import { syncLatestSavedPayslip } from "@/features/tarjeton/services/sync-latest-payslip"
import { analyzeAndPersistPayslip } from "@/features/tarjeton/services/analyze-and-persist-payslip"

export function MiQuincenaPage({
  serverPayslip,
  allServerPayslips,
  serverError,
  userId,
  selectedPayslipId,
}: {
  serverPayslip: GuidePayslip | null
  allServerPayslips?: ServerPayslipSummary[]
  serverError?: string | null
  userId: string
  initialTab?: string
  selectedPayslipId?: string | null
}) {
  const router = useRouter()
  const { payslip, allPayslips, selectedId, setSelectedId } = useLatestPayslip(
    serverPayslip,
    userId,
    allServerPayslips,
    selectedPayslipId
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [viewMode, setViewMode] = useState<"completa" | "carrusel">("completa")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el carrusel al cambiar de quincena
    setStepIndex(0)
  }, [payslip?.id])

  const steps = payslip ? buildExplainer(payslip) : []
  const review = payslip ? buildReviewChecklist(payslip) : []
  const summary = payslip ? buildQuincenaSummary(payslip) : null

  // Filtramos solo hallazgos que realmente ameritan revisión preventiva (anomalías, faltas, no cobrados)
  const flaggedItems = review.filter((i) => i.state === "review")

  useEffect(() => {
    const hasConceptWithObservation =
      payslip?.earnings.some((e) => e.code === "035" || e.code === "037" || e.code === "076" || e.code === "029" || e.code === "048") ||
      payslip?.deductions.some((d) => d.code === "172" || d.code === "171" || d.code === "174" || d.code === "176")
    const missingObservations = Boolean(hasConceptWithObservation && (!payslip?.observations || payslip.observations.length === 0))

    if (payslip && (summary?.incompleteExtraction || missingObservations) && !autoAnalyzing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-reanudación deliberada
      setAutoAnalyzing(true)
      void syncLatestSavedPayslip(userId, { force: missingObservations })
        .then((res) => {
          if (!res || res.concepts.length === 0 || (missingObservations && (!res.observations || res.observations.length === 0))) {
            return analyzeAndPersistPayslip(payslip.id, {
              userId,
              periodRaw: payslip.periodRaw || payslip.periodLabel,
              force: missingObservations,
            })
          }
        })
        .finally(() => setAutoAnalyzing(false))
    }
  }, [payslip, summary?.incompleteExtraction, autoAnalyzing, userId])

  const handleSelectPayslip = (newId: string) => {
    setSelectedId(newId)
    setStepIndex(0)

    const target = allPayslips.find((p) => p.id === newId)
    const hasDetail = (target?.earnings?.length ?? 0) > 0 || (target?.deductions?.length ?? 0) > 0

    if (!hasDetail) {
      router.push(`/guia/mi-quincena?id=${encodeURIComponent(newId)}`)
    }
  }

  if (!payslip) {
    return (
      <PageContainer maxWidth={720}>
        <PageHeader
          eyebrow="Guía de mi Tarjetón"
          title="Mi quincena explicada"
          description="Explicamos cada pago y descuento de tu tarjetón, paso a paso y en un lenguaje sencillo."
        />
        <Card
          padding="clamp(1rem, 3vw, 1.5rem)"
          style={{
            textAlign: "center",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 70%)",
            borderColor: "#bbf7d0",
          }}
        >
          <Image
            src="/brand/guia/hero-emblem.jpg"
            alt="Mi quincena explicada"
            width={72}
            height={72}
            style={{ borderRadius: "50%", margin: "0 auto 1rem", border: "3px solid #16a34a" }}
          />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Aún no has subido tu tarjetón
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", maxWidth: 440, margin: "0 auto 1.25rem", lineHeight: 1.6 }}>
            Sube tu PDF para que analicemos tus percepciones, deducciones, fechas de guardias, vacaciones e incidencias automáticamente.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ActionLink href="/profile/mi-informacion-laboral" size="md">
              Subir mi tarjetón IMSS
            </ActionLink>
          </div>
        </Card>
      </PageContainer>
    )
  }

  const step = steps[stepIndex] ?? steps[0]
  const totalPerceptions = payslip.totalEarnings ?? payslip.earnings.reduce((s, e) => s + e.amount, 0)
  const totalDeductions = payslip.totalDeductions ?? payslip.deductions.reduce((s, d) => s + d.amount, 0)
  const netAmount = payslip.netPay ?? (totalPerceptions - Math.abs(totalDeductions))

  return (
    <PageContainer maxWidth={720}>
      <PageHeader
        eyebrow="Guía de mi Tarjetón"
        title="Mi quincena explicada"
        description="Analizador de pagos e incidencias: conoce qué te pagaron, qué te descontaron y las fechas exactas de devengo y cobro."
      />

      {serverError && (
        <Card
          padding="clamp(0.75rem, 2.5vw, 1rem)"
          style={{
            marginBottom: "1rem",
            background: "#fef2f2",
            borderColor: "#fecaca",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0, wordBreak: "break-word" }}>
            {serverError}
          </p>
        </Card>
      )}

      {/* Selector de Tarjetón / Quincena Siempre Visible */}
      <div
        style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", flex: 1, minWidth: 260 }}>
          <CalendarCheck size={20} color="var(--primary)" weight="bold" />
          <label
            htmlFor="tarjeton-selector"
            style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)", whiteSpace: "nowrap" }}
          >
            Tarjetón a analizar:
          </label>

          {allPayslips.length > 1 ? (
            <select
              id="tarjeton-selector"
              value={selectedId || payslip.id}
              onChange={(e) => handleSelectPayslip(e.target.value)}
              style={{
                flex: "1 1 200px",
                padding: "0.375rem 0.625rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--fg)",
                cursor: "pointer",
                maxWidth: "100%",
              }}
            >
              {allPayslips.map((p) => {
                const label = p.periodLabel || p.periodRaw || "Quincena"
                const netText = p.netPay != null ? ` · Neto: ${formatMoney(p.netPay)}` : ""
                return (
                  <option key={p.id} value={p.id}>
                    {label} {netText}
                  </option>
                )
              })}
            </select>
          ) : (
            <Badge variant="info">
              {payslip.periodLabel || payslip.periodRaw || "Quincena activa"}
            </Badge>
          )}
        </div>

        <Link
          href="/profile/mi-informacion-laboral"
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap",
          }}
        >
          + Subir otro / Mis documentos <ArrowRight size={12} />
        </Link>
      </div>

      {/* Resumen Financiero Ejecutivo (Percepciones | Deducciones | Neto) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
          gap: "0.5rem",
          marginBottom: "1.25rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <SummaryStat
          label="+ Percepciones"
          value={formatMoney(totalPerceptions)}
          tone="perception"
        />
        <SummaryStat
          label="− Deducciones"
          value={formatMoney(totalDeductions)}
          tone="deduction"
        />
        <SummaryStat
          label="= Neto a Cobrar"
          value={formatMoney(netAmount)}
          tone="net"
        />
      </div>

      {/* Alertas preventivas destacadas (si existen) sin tarjetas duplicadas */}
      {flaggedItems.length > 0 && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.875rem 1rem",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <WarningCircle size={20} color="#e11d48" weight="bold" />
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#9f1239" }}>
              Hallazgos a verificar en tu tarjetón ({flaggedItems.length})
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {flaggedItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "rgba(255, 255, 255, 0.7)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid #fda4af",
                  fontSize: "0.8125rem",
                  color: "#881337",
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.125rem" }}>
                  {item.rule.code} · {item.rule.label}
                </div>
                <div>{item.message}</div>
                {item.caveat && (
                  <div style={{ fontSize: "0.75rem", color: "#be123c", marginTop: "0.25rem" }}>
                    {item.caveat}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista Unificada de Explicación y Fechas */}
      <ExplainView
        steps={steps}
        step={step}
        stepIndex={stepIndex}
        setStepIndex={setStepIndex}
        summary={summary!}
        total={steps.length}
        periodRaw={payslip?.periodLabel || payslip?.periodRaw}
        documentId={payslip?.id}
        userId={userId}
        autoAnalyzing={autoAnalyzing}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
    </PageContainer>
  )
}

function ExplainView({
  steps,
  step,
  stepIndex,
  setStepIndex,
  summary,
  total,
  periodRaw,
  documentId,
  userId,
  autoAnalyzing = false,
  viewMode,
  setViewMode,
}: {
  steps: ExplainerStep[]
  step: ExplainerStep
  stepIndex: number
  setStepIndex: (i: number) => void
  summary: ReturnType<typeof buildQuincenaSummary>
  total: number
  periodRaw?: string
  documentId?: string
  userId: string
  autoAnalyzing?: boolean
  viewMode: "completa" | "carrusel"
  setViewMode: (m: "completa" | "carrusel") => void
}) {
  const isLast = stepIndex >= total - 1

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Selector de modo de vista (Completa vs Carrusel) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0.375rem 0.5rem",
          background: "var(--accent)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Modo de lectura:
        </span>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button
            type="button"
            onClick={() => setViewMode("completa")}
            style={{
              padding: "0.25rem 0.625rem",
              borderRadius: "var(--radius-sm)",
              border: viewMode === "completa" ? "1px solid var(--primary)" : "1px solid transparent",
              background: viewMode === "completa" ? "var(--card)" : "transparent",
              color: viewMode === "completa" ? "var(--primary)" : "var(--muted)",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <ListDashes size={14} weight="bold" /> Todo de un vistazo
          </button>
          <button
            type="button"
            onClick={() => setViewMode("carrusel")}
            style={{
              padding: "0.25rem 0.625rem",
              borderRadius: "var(--radius-sm)",
              border: viewMode === "carrusel" ? "1px solid var(--primary)" : "1px solid transparent",
              background: viewMode === "carrusel" ? "var(--card)" : "transparent",
              color: viewMode === "carrusel" ? "var(--primary)" : "var(--muted)",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <StepsIcon size={14} weight="bold" /> Paso a paso
          </button>
        </div>
      </div>

      {/* Auto-analizando banner */}
      {autoAnalyzing && (
        <div
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 0.875rem",
            fontSize: "0.8125rem",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              border: "2px solid var(--primary)",
              borderRightColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <span>Estamos preparando la explicación de tu tarjetón más reciente.</span>
        </div>
      )}

      {/* Fallback banner si no se leyeron conceptos pero sí totales */}
      {!autoAnalyzing && summary.incompleteExtraction && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.125rem" }}>⚠️</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#92400e" }}>
              Detectamos los totales de tu tarjetón, pero no pudimos leer el detalle de los conceptos.
            </span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#b45309", margin: 0, lineHeight: 1.4 }}>
            Puedes reintentar el análisis en el dispositivo para extraer los conceptos individuales o volver a subir tu archivo.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <BotonReintentarAnalisis
              userId={userId}
              periodRaw={periodRaw}
              documentId={documentId}
              size="sm"
              variant="secondary"
            />
            <ActionLink href="/profile/mi-informacion-laboral" size="sm" variant="outline">
              Volver a subir o revisar tarjetón
            </ActionLink>
          </div>
        </div>
      )}

      {/* Vista Completa: todos los bloques organizados de un vistazo */}
      {viewMode === "completa" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
          {steps.map((st, idx) => (
            <ExplainerCard key={`${st.title}-${idx}`} step={st} />
          ))}
        </div>
      ) : (
        /* Vista Carrusel Paso a Paso */
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", width: "100%", minWidth: 0 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
              {stepIndex + 1} de {total}
            </span>
            <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "var(--border)", overflow: "hidden", minWidth: 0 }}>
              <div
                style={{
                  height: "100%",
                  width: `${((stepIndex + 1) / total) * 100}%`,
                  background: "var(--primary)",
                  borderRadius: 9999,
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>

          <ExplainerCard step={step} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <button
              onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
              disabled={stepIndex === 0}
              style={navButtonStyle(stepIndex === 0)}
              aria-label="Paso anterior"
            >
              <CaretLeft size={16} /> Anterior
            </button>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, padding: "0 0.25rem" }}>
              {(steps[stepIndex]?.title ?? "").slice(0, 28) || `Paso ${stepIndex + 1}`}
            </span>
            <button
              onClick={() => setStepIndex(Math.min(total - 1, stepIndex + 1))}
              disabled={isLast}
              style={navButtonStyle(isLast)}
              aria-label="Paso siguiente"
            >
              Siguiente <CaretRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ExplainerCard({ step }: { step: ExplainerStep }) {
  if (!step) return null

  return (
    <Card
      padding="clamp(0.875rem, 3vw, 1.25rem)"
      variant="highlighted"
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        borderLeft: step.line
          ? `4px solid ${step.line.kind === "deduction" ? "#e11d48" : "#059669"}`
          : "4px solid #1b5e20",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", width: "100%", minWidth: 0 }}>
        <span style={{ fontSize: "1.75rem", lineHeight: 1, flexShrink: 0 }}>{step.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.125rem", wordBreak: "break-word" }}>{step.title}</h3>
          {step.subtitle && (
            <p style={{ fontSize: "0.78125rem", color: "var(--muted)", margin: "0 0 0.5rem", wordBreak: "break-word" }}>{step.subtitle}</p>
          )}
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0, color: "var(--fg)", wordBreak: "break-word" }}>{step.explanation}</p>
          {step.line && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                background: step.line.kind === "deduction" ? "#fff1f2" : "#ecfdf5",
                border: `1px solid ${step.line.kind === "deduction" ? "#fecdd3" : "#a7f3d0"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  fontSize: "0.78125rem",
                  fontWeight: 700,
                  color: step.line.kind === "deduction" ? "#be123c" : "#047857",
                }}
              >
                {step.line.kind === "deduction" ? `− Descuento (${step.line.code})` : `+ Percepción (${step.line.code})`}
              </span>
              <span
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  color: step.line.kind === "deduction" ? "#881337" : "#065f46",
                }}
              >
                {formatMoney(Math.abs(step.line.amount))}
              </span>
            </div>
          )}

          {/* Bloque Destacado de Fechas (Incidencia y Cobro) */}
          {step.dateInfo && <IncidenceDateBlock dateInfo={step.dateInfo} />}

          {step.observationText && (
            <p
              style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                fontSize: "0.78125rem",
                color: "#92400e",
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              <strong>En Observaciones de tu tarjetón:</strong> {step.observationText}
            </p>
          )}
          {step.cta && (
            <div style={{ marginTop: "0.875rem", width: "100%", minWidth: 0 }}>
              <ActionLink href={step.cta.href} variant="outline" size="sm">
                {step.cta.label} <ArrowRight size={13} style={{ flexShrink: 0 }} />
              </ActionLink>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function IncidenceDateBlock({ dateInfo }: { dateInfo?: IncidenceDateInfo }) {
  if (!dateInfo) return null

  const isGuardia = dateInfo.type === "guardia"
  const isVacaciones = dateInfo.type === "vacaciones"
  const isFalta = dateInfo.type === "falta"
  const isEstimulo = dateInfo.type === "estimulo"

  const borderColor = isFalta ? "#fca5a5" : isGuardia ? "#93c5fd" : isVacaciones ? "#86efac" : isEstimulo ? "#fde68a" : "var(--border)"
  const bgColor = isFalta ? "#fff1f2" : isGuardia ? "#eff6ff" : isVacaciones ? "#f0fdf4" : isEstimulo ? "#fffbeb" : "var(--accent)"

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.625rem 0.75rem",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <CalendarCheck size={15} color="var(--primary)" weight="bold" />
          <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--fg)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Fechas de este concepto
          </span>
        </div>
        {dateInfo.sourceBadge && (
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "0.125rem 0.375rem",
              borderRadius: "var(--radius-sm)",
              background: "rgba(0,0,0,0.06)",
              color: "var(--fg)",
            }}
          >
            {dateInfo.sourceBadge}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "0.5rem", marginTop: "0.125rem" }}>
        <div>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", display: "block" }}>
            📅 ¿Qué día laboraste o correspondió?:
          </span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.35, display: "block" }}>
            {dateInfo.incidenceText}
          </span>
        </div>

        <div>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", display: "block" }}>
            💳 ¿En qué quincena te llegó?:
          </span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.35, display: "block" }}>
            {dateInfo.paymentText}
          </span>
        </div>
      </div>

      {dateInfo.details && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", paddingTop: "0.25rem", borderTop: "1px dashed rgba(0,0,0,0.08)" }}>
          {dateInfo.details}
        </div>
      )}

      {dateInfo.actionAdvice && (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.5rem 0.625rem",
            borderRadius: "var(--radius-sm)",
            background: isFalta
              ? "#fee2e2"
              : dateInfo.timingStatus === "past"
              ? "#dcfce7"
              : dateInfo.timingStatus === "future"
              ? "#fef3c7"
              : "rgba(255,255,255,0.85)",
            border: `1px solid ${
              isFalta
                ? "#fca5a5"
                : dateInfo.timingStatus === "past"
                ? "#86efac"
                : dateInfo.timingStatus === "future"
                ? "#fde68a"
                : "rgba(0,0,0,0.08)"
            }`,
            fontSize: "0.78125rem",
            color: isFalta
              ? "#991b1b"
              : dateInfo.timingStatus === "past"
              ? "#166534"
              : dateInfo.timingStatus === "future"
              ? "#92400e"
              : "var(--fg)",
            lineHeight: 1.45,
          }}
        >
          <strong>
            {isFalta
              ? "🚨 Acción recomendada:"
              : dateInfo.timingStatus === "past"
              ? "✅ Estado del pago:"
              : dateInfo.timingStatus === "future"
              ? "⏰ Guardia programada:"
              : "💡 Información útil:"}
          </strong>{" "}
          {dateInfo.actionAdvice}
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "perception" | "deduction" | "net"
}) {
  const palette = {
    neutral: { bg: "var(--accent)", border: "1px solid var(--border)", labelColor: "var(--muted)", valColor: "var(--fg)" },
    perception: { bg: "#ecfdf5", border: "1px solid #a7f3d0", labelColor: "#047857", valColor: "#065f46" },
    deduction: { bg: "#fff1f2", border: "1px solid #fecdd3", labelColor: "#be123c", valColor: "#881337" },
    net: { bg: "#1b5e20", border: "1px solid #14532d", labelColor: "#bbf7d0", valColor: "#ffffff" },
  }[tone]

  return (
    <div
      style={{
        padding: "0.625rem 0.75rem",
        borderRadius: "var(--radius-sm)",
        background: palette.bg,
        border: palette.border,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: "0.6875rem", color: palette.labelColor, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, wordBreak: "break-word" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 800, color: palette.valColor, marginTop: "0.125rem", wordBreak: "break-word", overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  )
}

function navButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.25rem",
    padding: "0.5rem 0.75rem",
    minHeight: 44,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: disabled ? "var(--muted)" : "var(--fg)",
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.8125rem",
    fontWeight: 600,
    flexShrink: 0,
    boxSizing: "border-box",
  }
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
