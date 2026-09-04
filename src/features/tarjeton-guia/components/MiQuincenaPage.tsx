"use client"

import { useState, useEffect } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { CaretLeft, CaretRight, Receipt, ShieldCheck, ArrowsClockwise, ArrowRight } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { PageContainer } from "@/shared/components/layout/PageContainer"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { BotonReintentarAnalisis } from "./BotonReintentarAnalisis"
import { Tabs } from "@/shared/components/ui/Tabs"
import { useLatestPayslip } from "@/features/tarjeton-guia/hooks/useLatestPayslip"
import { buildExplainer, buildQuincenaSummary, type ExplainerStep } from "@/features/tarjeton-guia/lib/explainer"
import { buildReviewChecklist, type ReviewItem } from "@/features/tarjeton-guia/lib/review"
import { compareQuincenas, describeChange } from "@/features/tarjeton-guia/lib/compare"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"

export function MiQuincenaPage({ serverPayslip, initialTab }: { serverPayslip: GuidePayslip | null; initialTab?: string }) {
  const { payslip, previous } = useLatestPayslip(serverPayslip)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el carrusel al cambiar de quincena
    setStepIndex(0)
  }, [payslip?.id])

  if (!payslip) {
    return (
      <PageContainer maxWidth={720}>
        <PageHeader
          eyebrow="Guía de mi Tarjetón"
          title="Mi quincena explicada"
          description="Explicamos cada pago y descuento de tu tarjetón, paso a paso y en un lenguaje sencillo."
        />
        <Card padding="clamp(1rem, 3vw, 1.5rem)" style={{ textAlign: "center", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <Receipt size={32} color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.25rem", wordBreak: "break-word" }}>Todavía no tenemos tu tarjetón</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 auto 1rem", lineHeight: 1.5, maxWidth: "30rem", wordBreak: "break-word" }}>
            Para explicarte tu pago necesitamos tu tarjetón actual. También puedes empezar con la guía desde cero mientras tanto.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", width: "100%" }}>
            <ActionLink href="/profile/mi-informacion-laboral">Obtener mi tarjetón</ActionLink>
            <ActionLink href="/guia/aprender" variant="secondary">Aprende desde cero</ActionLink>
          </div>
        </Card>
      </PageContainer>
    )
  }

  const steps = buildExplainer(payslip)
  const review = buildReviewChecklist(payslip)
  const summary = buildQuincenaSummary(payslip)
  const comparison = previous ? compareQuincenas(payslip, previous) : null

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const startTab = initialTab === "revisar" ? "revisar" : "explicar"

  return (
    <PageContainer maxWidth={720}>
      <PageHeader
        eyebrow="Guía de mi Tarjetón"
        title="Mi quincena explicada"
        description={payslip.periodLabel ? `Periodo: ${payslip.periodLabel}` : "Explicamos tu quincena paso a paso."}
        backHref="/guia"
      />

      <Tabs
        defaultTab={startTab}
        tabs={[
          { id: "explicar", label: "Tu pago en pocas palabras", icon: <ArrowsClockwise size={16} /> },
          { id: "revisar", label: "Revisa tu quincena", icon: <ShieldCheck size={16} /> },
        ]}
      >
        {(active) =>
          active === "revisar" ? (
            <ReviewTab items={review} comparison={comparison} />
          ) : (
            <ExplainTab
              steps={steps}
              step={step}
              stepIndex={stepIndex}
              setStepIndex={setStepIndex}
              summary={summary}
              total={steps.length}
              periodRaw={payslip?.periodLabel || payslip?.periodRaw}
              documentId={payslip?.id}
            />
          )
        }
      </Tabs>
    </PageContainer>
  )
}

function ExplainTab({
  steps,
  step,
  stepIndex,
  setStepIndex,
  summary,
  total,
  periodRaw,
  documentId,
}: {
  steps: ExplainerStep[]
  step: ExplainerStep
  stepIndex: number
  setStepIndex: (i: number) => void
  summary: ReturnType<typeof buildQuincenaSummary>
  total: number
  periodRaw?: string
  documentId?: string
}) {
  const isLast = stepIndex >= total - 1
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Progreso */}
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

      {/* Fallback banner si no se leyeron conceptos pero sí totales */}
      {summary.incompleteExtraction && (
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

      {/* Paso */}
      <Card padding="clamp(0.875rem, 3vw, 1.25rem)" variant="highlighted" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
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
                  background: "var(--accent)",
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
                <span style={{ fontSize: "0.78125rem", color: "var(--muted)" }}>Importe</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                  {formatMoney(Math.abs(step.line.amount))}
                </span>
              </div>
            )}
            {step.observationText && (
              <p
                style={{
                  marginTop: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "#fffbeb",
                  fontSize: "0.78125rem",
                  color: "var(--warning)",
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                En Observaciones: {step.observationText}
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

      {/* Resumen de la quincena al final */}
      {isLast && (
        <Card padding="clamp(0.875rem, 3vw, 1.25rem)" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.625rem", wordBreak: "break-word" }}>Resumen de tu quincena</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
            gap: "0.5rem",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}>
            <SummaryStat label="Percepciones" value={summary.totalEarnings != null ? formatMoney(summary.totalEarnings) : "—"} />
            <SummaryStat label="Deducciones" value={summary.totalDeductions != null ? formatMoney(summary.totalDeductions) : "—"} />
            <SummaryStat label="Neto / Líquido" value={summary.netPay != null ? formatMoney(summary.netPay) : "—"} />
            <SummaryStat label="Conceptos detectados" value={`${summary.perceptions} perc. · ${summary.deductions} ded.`} />
          </div>
        </Card>
      )}

      {/* Navegación del carrusel */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: "0.5rem",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}>
        <button
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          style={navButtonStyle(stepIndex === 0)}
          aria-label="Paso anterior"
        >
          <CaretLeft size={16} /> Anterior
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, padding: "0 0.25rem" }}>
          {(steps[stepIndex]?.title ?? "").slice(0, 24) || `Paso ${stepIndex + 1}`}
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
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "0.625rem 0.75rem",
        borderRadius: "var(--radius-sm)",
        background: "var(--accent)",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, wordBreak: "break-word" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.125rem", wordBreak: "break-word", overflowWrap: "anywhere" }}>
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

function ReviewTab({ items, comparison }: { items: ReviewItem[]; comparison: ReturnType<typeof compareQuincenas> | null }) {
  const byState = (s: string) => items.filter((i) => i.state === s)
  const flagged = byState("review")
  const ok = byState("ok")
  const info = byState("info")
  const notEval = byState("not-evaluable")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Card padding="clamp(0.875rem, 3vw, 1.25rem)" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <ShieldCheck size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, wordBreak: "break-word" }}>Revisa tu quincena</h3>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: 0, wordBreak: "break-word" }}>
          Comparamos tu tarjetón contra reglas con fundamento documentado. Es una guía para que revises, no una acusación.
        </p>
      </Card>

      {flagged.length > 0 && <Group title="Conviene revisar" tone="review" items={flagged} />}
      {ok.length > 0 && <Group title="Se ve bien" tone="ok" items={ok} />}
      {info.length > 0 && <Group title="Para tu información" tone="info" items={info} />}
      {notEval.length > 0 && <Group title="Sin evaluar" tone="neutral" items={notEval} />}

      {comparison && comparison.changes.length > 0 && (
        <Card padding="clamp(0.875rem, 3vw, 1.25rem)" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.625rem", wordBreak: "break-word" }}>
            ¿Qué cambió vs. {comparison.periodPrevious}?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%", minWidth: 0 }}>
            {comparison.changes.map((c, i) => (
              <div key={`${c.code}-${i}`} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", width: "100%", minWidth: 0 }}>
                <Badge variant={changeVariant(c.type)}>{changeTag(c.type)}</Badge>
                <span style={{ fontSize: "0.8125rem", color: "var(--fg)", flex: "1 1 140px", minWidth: 0, wordBreak: "break-word" }}>{describeChange(c)}</span>
                <Link href={`/guia/conceptos/${c.code}`} style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none", flexShrink: 0, minHeight: 32, display: "inline-flex", alignItems: "center" }}>
                  Ver
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Group({ title, tone, items }: { title: string; tone: "review" | "ok" | "info" | "neutral"; items: ReviewItem[] }) {
  const badgeVariant = tone === "review" ? "error" : tone === "ok" ? "success" : tone === "info" ? "info" : "neutral"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", width: "100%", minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", wordBreak: "break-word" }}>{title}</span>
        <Badge variant={badgeVariant}>{items.length}</Badge>
      </div>
      {items.map((item) => {
        return (
          <Card key={item.rule.code + item.rule.label} padding="0.875rem 1rem" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", width: "100%", minWidth: 0 }}>
              <span style={{ fontSize: "0.78125rem", fontWeight: 700, color: "var(--muted)" }}>{item.rule.code}</span>
              <span style={{ fontSize: "0.78125rem", color: "var(--muted)", textAlign: "right", wordBreak: "break-word", flex: "1 1 120px", minWidth: 0 }}>{item.rule.label}</span>
            </div>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: "0.25rem 0 0", color: "var(--fg)", wordBreak: "break-word" }}>{item.message}</p>
            {item.caveat && (
              <p style={{ fontSize: "0.75rem", lineHeight: 1.5, margin: "0.375rem 0 0", color: "var(--muted)", wordBreak: "break-word" }}>{item.caveat}</p>
            )}
            {item.helpHref && (
              <Link
                href={item.helpHref}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.78125rem", fontWeight: 600, color: "var(--primary)", textDecoration: "none", minHeight: 32 }}
              >
                {item.helpLabel ?? "Entender este concepto"} <ArrowRight size={12} style={{ flexShrink: 0 }} />
              </Link>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function changeTag(t: "nuevo" | "desaparecio" | "subio" | "bajo"): string {
  switch (t) {
    case "nuevo": return "Nuevo"
    case "desaparecio": return "Salió"
    case "subio": return "↑ Subió"
    case "bajo": return "↓ Bajó"
  }
}

function changeVariant(t: "nuevo" | "desaparecio" | "subio" | "bajo"): "info" | "neutral" | "success" | "warning" {
  switch (t) {
    case "nuevo": return "info"
    case "desaparecio": return "neutral"
    case "subio": return "success"
    case "bajo": return "warning"
  }
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
