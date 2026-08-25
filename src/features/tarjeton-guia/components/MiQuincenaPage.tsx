"use client"

import { useState, useEffect } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { CaretLeft, CaretRight, Receipt, ShieldCheck, ArrowsClockwise, ArrowRight } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
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
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Guía de mi Tarjetón"
          title="Mi quincena explicada"
          description="Explicamos cada pago y descuento de tu tarjetón, paso a paso y en un lenguaje sencillo."
        />
        <Card padding="1.5rem" style={{ textAlign: "center" }}>
          <Receipt size={32} color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Todavía no tenemos tu tarjetón</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 auto 1rem", lineHeight: 1.5, maxWidth: "30rem" }}>
            Para explicarte tu pago necesitamos tu tarjetón actual. También puedes empezar con la guía desde cero mientras tanto.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <ActionLink href="/profile/mi-informacion-laboral">Obtener mi tarjetón</ActionLink>
            <ActionLink href="/guia/aprender" variant="secondary">Aprende desde cero</ActionLink>
          </div>
        </Card>
      </div>
    )
  }

  const steps = buildExplainer(payslip)
  const review = buildReviewChecklist(payslip)
  const summary = buildQuincenaSummary(payslip)
  const comparison = previous ? compareQuincenas(payslip, previous) : null

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const startTab = initialTab === "revisar" ? "revisar" : "explicar"

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
            <ExplainTab steps={steps} step={step} stepIndex={stepIndex} setStepIndex={setStepIndex} summary={summary} total={steps.length} />
          )
        }
      </Tabs>
    </div>
  )
}

function ExplainTab({
  steps,
  step,
  stepIndex,
  setStepIndex,
  summary,
  total,
}: {
  steps: ExplainerStep[]
  step: ExplainerStep
  stepIndex: number
  setStepIndex: (i: number) => void
  summary: ReturnType<typeof buildQuincenaSummary>
  total: number
}) {
  const isLast = stepIndex >= total - 1
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Progreso */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
          {stepIndex + 1} de {total}
        </span>
        <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${((stepIndex + 1) / total) * 100}%`,
              background: "var(--primary)",
              borderRadius: 9999,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Paso */}
      <Card padding="1.25rem 1.5rem" variant="highlighted">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{step.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.125rem" }}>{step.title}</h3>
            {step.subtitle && (
              <p style={{ fontSize: "0.78125rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>{step.subtitle}</p>
            )}
            <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0, color: "var(--fg)" }}>{step.explanation}</p>
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
                  gap: "0.5rem",
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
                }}
              >
                En Observaciones: {step.observationText}
              </p>
            )}
            {step.cta && (
              <div style={{ marginTop: "0.875rem" }}>
                <ActionLink href={step.cta.href} variant="outline" size="sm">
                  {step.cta.label} <ArrowRight size={13} />
                </ActionLink>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Resumen de la quincena al final */}
      {isLast && (
        <Card padding="1rem 1.25rem">
          <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.625rem" }}>Resumen de tu quincena</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <SummaryStat label="Percepciones" value={summary.totalEarnings != null ? formatMoney(summary.totalEarnings) : "—"} />
            <SummaryStat label="Deducciones" value={summary.totalDeductions != null ? formatMoney(summary.totalDeductions) : "—"} />
            <SummaryStat label="Neto / Líquido" value={summary.netPay != null ? formatMoney(summary.netPay) : "—"} />
            <SummaryStat label="Conceptos detectados" value={`${summary.perceptions} perc. · ${summary.deductions} ded.`} />
          </div>
        </Card>
      )}

      {/* Navegación del carrusel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <button
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          style={navButtonStyle(stepIndex === 0)}
        >
          <CaretLeft size={14} /> Anterior
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {(steps[stepIndex - 1]?.title ?? "").slice(0, 26) || `Paso ${stepIndex + 1}`}
        </span>
        <button
          onClick={() => setStepIndex(Math.min(total - 1, stepIndex + 1))}
          disabled={isLast}
          style={navButtonStyle(isLast)}
        >
          Siguiente <CaretRight size={14} />
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
      }}
    >
      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.125rem" }}>{value}</div>
    </div>
  )
}

function navButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.4375rem 0.75rem",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: disabled ? "var(--muted)" : "var(--fg)",
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.8125rem",
    fontWeight: 600,
  }
}

function ReviewTab({ items, comparison }: { items: ReviewItem[]; comparison: ReturnType<typeof compareQuincenas> | null }) {
  const byState = (s: string) => items.filter((i) => i.state === s)
  const flagged = byState("review")
  const ok = byState("ok")
  const info = byState("info")
  const notEval = byState("not-evaluable")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card padding="1.25rem 1.5rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <ShieldCheck size={18} color="var(--primary)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Revisa tu quincena</h3>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
          Comparamos tu tarjetón contra reglas con fundamento documentado. Es una guía para que revises, no una acusación.
        </p>
      </Card>

      {flagged.length > 0 && <Group title="Conviene revisar" tone="review" items={flagged} />}
      {ok.length > 0 && <Group title="Se ve bien" tone="ok" items={ok} />}
      {info.length > 0 && <Group title="Para tu información" tone="info" items={info} />}
      {notEval.length > 0 && <Group title="Sin evaluar" tone="neutral" items={notEval} />}

      {comparison && comparison.changes.length > 0 && (
        <Card padding="1rem 1.25rem">
          <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.625rem" }}>
            ¿Qué cambió vs. {comparison.periodPrevious}?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {comparison.changes.map((c, i) => (
              <div key={`${c.code}-${i}`} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Badge variant={changeVariant(c.type)}>{changeTag(c.type)}</Badge>
                <span style={{ fontSize: "0.8125rem", color: "var(--fg)", flex: 1 }}>{describeChange(c)}</span>
                <Link href={`/guia/conceptos/${c.code}`} style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{title}</span>
        <Badge variant={badgeVariant}>{items.length}</Badge>
      </div>
      {items.map((item) => {
        return (
          <Card key={item.rule.code + item.rule.label} padding="0.875rem 1rem">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.78125rem", fontWeight: 700, color: "var(--muted)" }}>{item.rule.code}</span>
              <span style={{ fontSize: "0.78125rem", color: "var(--muted)", textAlign: "right" }}>{item.rule.label}</span>
            </div>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: "0.25rem 0 0", color: "var(--fg)" }}>{item.message}</p>
            {item.caveat && (
              <p style={{ fontSize: "0.75rem", lineHeight: 1.5, margin: "0.375rem 0 0", color: "var(--muted)" }}>{item.caveat}</p>
            )}
            {item.helpHref && (
              <Link
                href={item.helpHref}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.78125rem", fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}
              >
                {item.helpLabel ?? "Entender este concepto"} <ArrowRight size={12} />
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
