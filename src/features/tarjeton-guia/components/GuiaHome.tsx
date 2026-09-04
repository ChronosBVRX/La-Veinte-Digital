"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Sparkle,
  ArrowRight,
  Lightbulb,
  CaretRight,
} from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { BotonReintentarAnalisis } from "./BotonReintentarAnalisis"
import { guideTips } from "@/features/tarjeton-guia/data/tips"
import { guideQuickLessons } from "@/features/tarjeton-guia/data/lessons"
import { resolveRefHref } from "@/features/tarjeton-guia/lib/catalog"

import { getPayslips } from "@/shared/services/local-storage"

export interface GuiaHomeServerData {
  hasPayslip: boolean
  documentId?: string
  periodRaw?: string
  netPay?: number
  totalEarnings?: number
  totalDeductions?: number
  earningsCount?: number
  deductionsCount?: number
}

export function GuiaHome({ data }: { data: GuiaHomeServerData }) {
  const [tipIndex, setTipIndex] = useState(0)
  const [overrideStats, setOverrideStats] = useState<{
    earningsCount?: number
    deductionsCount?: number
    netPay?: number
  } | null>(null)

  const stats = {
    earningsCount: overrideStats?.earningsCount ?? data.earningsCount ?? 0,
    deductionsCount: overrideStats?.deductionsCount ?? data.deductionsCount ?? 0,
    netPay: overrideStats?.netPay ?? data.netPay,
    totalEarnings: data.totalEarnings,
    totalDeductions: data.totalDeductions,
  }

  useEffect(() => {
    // Sincronizar conceptos desde localStorage si ya existen para este periodo o el más reciente
    const syncLocal = () => {
      const slips = getPayslips()
      const target =
        slips.find((s) => {
          if (data.documentId && s.id === data.documentId) return true
          const pLabel =
            typeof s.period === "string"
              ? s.period
              : s.period?.label || s.period?.id || s.periodRaw || ""
          return data.periodRaw ? pLabel.includes(data.periodRaw) : true
        }) || slips[0]
      if (target) {
        const eCount = ((target.earnings ?? target.perceptions)?.length) ?? 0
        const dCount = target.deductions?.length ?? 0
        if (eCount > 0 || dCount > 0) {
          setOverrideStats({
            earningsCount: eCount,
            deductionsCount: dCount,
            netPay: target.netPay ?? target.netAmount,
          })
        }
      }
    }

    syncLocal()
    window.addEventListener("nomina_payslip_updated", syncLocal)
    return () => {
      window.removeEventListener("nomina_payslip_updated", syncLocal)
    }
  }, [data.documentId, data.periodRaw])

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rotación diaria determinista (evita hydration mismatch)
    setTipIndex(dayOfYear % guideTips.length)
  }, [])

  const tip = guideTips[tipIndex]
  const gridItems = [
    { href: "/guia/conceptos", emoji: "🔎", title: "Buscar concepto", description: "¿Qué significa 032, 033, 108…?" },
    { href: "/guia/tarjeton", emoji: "🧾", title: "Conoce tu tarjetón", description: "Aprende para qué sirve cada sección." },
    { href: "/guia/conceptos?tab=deducciones", emoji: "💰", title: "Pagos y descuentos", description: "Descubre de dónde viene cada cantidad." },
    { href: "/guia/aprender", emoji: "🎓", title: "Aprende desde cero", description: "Una guía sencilla paso a paso." },
  ]

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía"
        title="Guía de mi Tarjetón"
        description="Aprende a leer cada concepto, verificar tus descuentos y proteger tu salario quincenal."
      />

      {/* Quincena Hero */}
      <Card padding="1.25rem" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "var(--radius-md)",
              background: "var(--accent)",
              flexShrink: 0,
            }}
          >
            <Sparkle size={22} weight="duotone" color="var(--primary)" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
              {data.hasPayslip ? "Tu quincena, explicada" : "✨ Entiende tu última quincena"}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              {data.hasPayslip
                ? "Te explicamos cada pago y descuento utilizando tu tarjetón."
                : "Te explicamos cada pago y descuento utilizando tu tarjetón."}
            </p>
          </div>
        </div>

        {data.hasPayslip ? (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.5rem",
              }}
            >
              <SummaryStat label="Periodo" value={data.periodRaw ?? "—"} />
              <SummaryStat label="Líquido" value={stats.netPay != null ? formatMoney(stats.netPay) : "—"} />
              <SummaryStat label="Percepciones" value={String(stats.earningsCount ?? 0)} />
              <SummaryStat label="Deducciones" value={String(stats.deductionsCount ?? 0)} />
            </div>

            {((stats.totalEarnings ?? 0) > 0 || (stats.totalDeductions ?? 0) > 0 || (stats.netPay ?? 0) > 0) &&
              (stats.earningsCount ?? 0) === 0 &&
              (stats.deductionsCount ?? 0) === 0 && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 0.875rem",
                  marginTop: "0.75rem",
                  fontSize: "0.8125rem",
                  color: "#92400e",
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  ⚠️ Detectamos los totales de tu tarjetón, pero no pudimos leer el detalle de los conceptos.
                </div>
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <BotonReintentarAnalisis
                    periodRaw={data.periodRaw}
                    documentId={data.documentId}
                    size="sm"
                    variant="secondary"
                    onCompleted={(res) => {
                      setOverrideStats({
                        earningsCount: res.earnings,
                        deductionsCount: res.deductions,
                        netPay: res.netPay,
                      })
                    }}
                  />
                  <ActionLink href="/profile/mi-informacion-laboral" size="sm" variant="outline">
                    Revisar documento
                  </ActionLink>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginTop: "0.875rem",
              }}
            >
              <ActionLink href="/guia/mi-quincena" size="md">
                Explícame mi pago <CaretRight size={14} />
              </ActionLink>
              <ActionLink href="/guia/mi-quincena?vista=revisar" variant="secondary" size="md">
                Revisar mi quincena
              </ActionLink>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.875rem", lineHeight: 1.5 }}>
              Sube o consulta tu primer tarjetón para recibir una explicación personalizada.
            </p>
            <ActionLink href="/profile/mi-informacion-laboral" size="md">
              Obtener mi tarjetón <CaretRight size={14} />
            </ActionLink>
          </div>
        )}
      </Card>

      {/* Grid 2×2 */}
      <h2 className="guia-section-title">¿Qué quieres entender hoy?</h2>
      <div className="guia-grid">
        {gridItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="guia-grid-card"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minHeight: "9.5rem",
              transition: "transform var(--transition), box-shadow var(--transition), border-color var(--transition)",
            }}
          >
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>{item.title}</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.45 }}>{item.description}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginTop: "auto" }}>
              Explorar <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>

      {/* Aprende algo en 1 minuto */}
      <h2 className="guia-section-title" style={{ marginTop: "2rem" }}>Aprende algo en 1 minuto</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {guideQuickLessons.map((item) => {
          const href =
            item.ref.startsWith("lesson:")
              ? `/guia/aprender/primeros-pasos?leccion=${item.ref.slice(7)}`
              : (resolveRefHref(item.ref) ?? "/guia/tarjeton")
          return (
            <Link
              key={item.id}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                transition: "border-color var(--transition)",
              }}
            >
              <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>{item.emoji}</span>
              <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>{item.title}</span>
              <CaretRight size={14} color="var(--muted)" />
            </Link>
          )
        })}
      </div>

      {/* ¿Sabías que? */}
      <Card padding="1rem 1.25rem" style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
          <Lightbulb size={22} weight="fill" color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.25rem" }}>¿Sabías que?</div>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>{tip.text}</p>
            {tip.href && (
              <Link
                href={tip.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  marginTop: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--primary)",
                  textDecoration: "none",
                }}
              >
                {tip.cta ?? "Muéstrame dónde está"} <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>
      </Card>

      <style>{`
        .guia-section-title {
          font-size: 1.0625rem;
          font-weight: 700;
          margin: 0 0 0.75rem;
        }
        .guia-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (min-width: 720px) {
          .guia-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .guia-grid-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--primary);
        }
      `}</style>
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
      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  )
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
