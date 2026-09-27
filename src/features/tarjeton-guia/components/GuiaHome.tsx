"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
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
import { getLatestPayslipAnalysis } from "@/features/tarjeton/services/payslip-analysis-store"
import { syncLatestSavedPayslip } from "@/features/tarjeton/services/sync-latest-payslip"
import { analyzeAndPersistPayslip } from "@/features/tarjeton/services/analyze-and-persist-payslip"

export interface GuiaHomeServerData {
  hasPayslip: boolean
  documentId?: string
  periodRaw?: string
  netPay?: number
  totalEarnings?: number
  totalDeductions?: number
  earningsCount?: number
  deductionsCount?: number
  serverError?: string
}

export function GuiaHome({ data, userId }: { data: GuiaHomeServerData; userId: string }) {
  const [tipIndex, setTipIndex] = useState(0)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [hasLocalPayslip, setHasLocalPayslip] = useState(data.hasPayslip)
  const [overrideStats, setOverrideStats] = useState<{
    earningsCount?: number
    deductionsCount?: number
    netPay?: number
    totalEarnings?: number
    totalDeductions?: number
    periodRaw?: string
  } | null>(null)

  const stats = {
    earningsCount: overrideStats?.earningsCount ?? data.earningsCount ?? 0,
    deductionsCount: overrideStats?.deductionsCount ?? data.deductionsCount ?? 0,
    netPay: overrideStats?.netPay ?? data.netPay,
    totalEarnings: overrideStats?.totalEarnings ?? data.totalEarnings,
    totalDeductions: overrideStats?.totalDeductions ?? data.totalDeductions,
    periodRaw: overrideStats?.periodRaw ?? data.periodRaw,
  }

  const hasPayslip = data.hasPayslip || hasLocalPayslip || (stats.earningsCount > 0 || stats.deductionsCount > 0)

  useEffect(() => {
    // Sincronizar conceptos desde análisis canónico o localStorage
    const syncLocal = () => {
      const canonical = getLatestPayslipAnalysis(userId)
      if (canonical && canonical.status === "ready" && canonical.concepts.length > 0) {
        setHasLocalPayslip(true)
        const eCount = canonical.concepts.filter((c) => c.kind === "perception").length
        const dCount = canonical.concepts.filter((c) => c.kind === "deduction").length
        setOverrideStats({
          earningsCount: eCount,
          deductionsCount: dCount,
          netPay: canonical.netAmount,
          totalEarnings: canonical.perceptionsTotal,
          totalDeductions: canonical.deductionsTotal,
          periodRaw: canonical.period,
        })
        return
      }

      const slips = getPayslips(userId)
      const target =
        slips.find((s) => {
          if (data.documentId && s.id === data.documentId) return true
          if (data.periodRaw && s.periodRaw === data.periodRaw) return true
          const pLabel =
            typeof s.period === "string"
              ? s.period
              : s.period?.label || s.period?.id || s.periodRaw || ""
          return data.periodRaw ? pLabel.includes(data.periodRaw) || data.periodRaw.includes(pLabel) : false
        }) || slips.find((s) => (s.earnings?.length ?? 0) + (s.deductions?.length ?? 0) > 0) || slips[0]
      if (target) {
        setHasLocalPayslip(true)
        const eCount = ((target.earnings ?? target.perceptions)?.length) ?? 0
        const dCount = target.deductions?.length ?? 0
        if (eCount > 0 || dCount > 0) {
          setOverrideStats({
            earningsCount: eCount,
            deductionsCount: dCount,
            netPay: target.netPay ?? target.netAmount,
            totalEarnings: target.totalEarnings,
            totalDeductions: target.totalDeductions,
            periodRaw: target.periodRaw,
          })
        }
      }
    }

    syncLocal()
    window.addEventListener("nomina_payslip_updated", syncLocal)
    window.addEventListener("tarjeton_analysis_completed", syncLocal)
    window.addEventListener("tarjeton_analysis_state_changed", syncLocal)
    return () => {
      window.removeEventListener("nomina_payslip_updated", syncLocal)
      window.removeEventListener("tarjeton_analysis_completed", syncLocal)
      window.removeEventListener("tarjeton_analysis_state_changed", syncLocal)
    }
  }, [data.documentId, data.periodRaw, userId])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (active) setAutoAnalyzing(true)
    }, 0)

    void syncLatestSavedPayslip(userId)
      .then((analysis) => {
        if (!active) return
        if (analysis && analysis.status === "ready" && analysis.concepts.length > 0) {
          setHasLocalPayslip(true)
          const eCount = analysis.concepts.filter((c) => c.kind === "perception").length
          const dCount = analysis.concepts.filter((c) => c.kind === "deduction").length
          setOverrideStats({
            earningsCount: eCount,
            deductionsCount: dCount,
            netPay: analysis.netAmount,
            totalEarnings: analysis.perceptionsTotal,
            totalDeductions: analysis.deductionsTotal,
            periodRaw: analysis.period,
          })
        } else if (data.hasPayslip && (stats.earningsCount === 0 && stats.deductionsCount === 0)) {
          return analyzeAndPersistPayslip(data.documentId, { userId, periodRaw: data.periodRaw }).then((res) => {
            if (!active) return
            if (res.ok && (res.earningsCount > 0 || res.deductionsCount > 0)) {
              setHasLocalPayslip(true)
              setOverrideStats({
                earningsCount: res.earningsCount,
                deductionsCount: res.deductionsCount,
                netPay: res.netPay,
                totalEarnings: res.totalEarnings,
                totalDeductions: res.totalDeductions,
                periodRaw: res.periodRaw,
              })
            }
          })
        }
      })
      .finally(() => {
        if (active) setAutoAnalyzing(false)
      })

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [data.documentId, data.hasPayslip, data.periodRaw, stats.earningsCount, stats.deductionsCount, userId])

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rotación diaria determinista (evita hydration mismatch)
    setTipIndex(dayOfYear % guideTips.length)
  }, [])

  const tip = guideTips[tipIndex]
  const gridItems = [
    {
      href: "/guia/conceptos",
      image: "/brand/guia/tile-buscar.jpg",
      badge: "Claves 001–199",
      accent: "#2563eb",
      title: "Buscar concepto",
      description: "¿Qué significa 032, 033, 154, 190…?",
    },
    {
      href: "/guia/tarjeton",
      image: "/brand/guia/tile-anatomia.jpg",
      badge: "Mapa 77 campos",
      accent: "#1b5e20",
      title: "Conoce tu tarjetón",
      description: "Explora cada columna y sección del recibo.",
    },
    {
      href: "/guia/conceptos?tab=deducciones",
      image: "/brand/guia/tile-pagos.jpg",
      badge: "+ Pagos / − Descuentos",
      accent: "#047857",
      title: "Pagos y descuentos",
      description: "Distingue lo que suma de lo que te retienen.",
    },
    {
      href: "/guia/aprender",
      image: "/brand/guia/tile-aprender.jpg",
      badge: "8 micro-lecciones",
      accent: "#6d28d9",
      title: "Aprende desde cero",
      description: "Una guía sencilla paso a paso y a tu ritmo.",
    },
  ]

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía"
        title="Guía de mi Tarjetón"
        description="Aprende a leer cada concepto, ubicar las columnas de tu recibo y verificar tus descuentos quincenales."
      />

      {data.serverError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 0.875rem",
            marginTop: "1rem",
            fontSize: "0.8125rem",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️ {data.serverError}</span>
        </div>
      )}

      {/* Quincena Hero */}
      <Card
        padding="1.25rem"
        style={{
          marginTop: "1rem",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%, #eff6ff 100%)",
          borderColor: "#bbf7d0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <Image
            src="/brand/guia/hero-emblem.jpg"
            alt="Guía de mi Tarjetón IMSS"
            width={64}
            height={64}
            style={{
              borderRadius: 14,
              objectFit: "cover",
              border: "1.5px solid #86efac",
              boxShadow: "0 4px 12px rgba(27, 94, 32, 0.12)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: "0.6875rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#1b5e20",
                background: "#dcfce7",
                padding: "0.125rem 0.5rem",
                borderRadius: 9999,
                marginBottom: "0.25rem",
              }}
            >
              {hasPayslip ? "Recibo sincronizado" : "Análisis interactivo"}
            </span>
            <h2 style={{ fontSize: "1.1875rem", fontWeight: 800, margin: "0 0 0.2rem", color: "var(--fg)" }}>
              {hasPayslip ? "Tu quincena, explicada" : "✨ Entiende tu última quincena"}
            </h2>
            <p style={{ fontSize: "0.84375rem", color: "var(--muted)", margin: 0, lineHeight: 1.45 }}>
              Te explicamos cada pago (+), descuento (−) y observación utilizando tu tarjetón.
            </p>
          </div>
        </div>

        {hasPayslip ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="guia-hero-stats-grid">
              <SummaryStat
                label="Periodo (Campo 40)"
                value={stats.periodRaw ?? data.periodRaw ?? "—"}
                tone="neutral"
              />
              <SummaryStat
                label="Líquido Neto (Campo 70)"
                value={stats.netPay != null ? formatMoney(stats.netPay) : "—"}
                tone="net"
              />
              <SummaryStat
                label="+ Percepciones"
                value={`${stats.earningsCount ?? 0} conceptos`}
                tone="perception"
              />
              <SummaryStat
                label="− Deducciones"
                value={`${stats.deductionsCount ?? 0} conceptos`}
                tone="deduction"
              />
            </div>

            {autoAnalyzing && (
              <div
                style={{
                  background: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.625rem 0.875rem",
                  marginTop: "0.75rem",
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

            {!autoAnalyzing &&
              ((stats.totalEarnings ?? 0) > 0 || (stats.totalDeductions ?? 0) > 0 || (stats.netPay ?? 0) > 0) &&
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
                    userId={userId}
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

      {/* Grid 2×2 / 4×1 con ilustraciones */}
      <h2 className="guia-section-title" style={{ marginTop: "1.75rem" }}>¿Qué quieres entender hoy?</h2>
      <div className="guia-grid">
        {gridItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="guia-grid-card"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderTop: `3px solid ${item.accent}`,
              borderRadius: "var(--radius-lg)",
              padding: "1rem",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minHeight: "11rem",
              transition: "transform var(--transition), box-shadow var(--transition), border-color var(--transition)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <Image
                src={item.image}
                alt={item.title}
                width={48}
                height={48}
                style={{
                  borderRadius: 10,
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                }}
              />
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.45rem",
                  borderRadius: 9999,
                  background: `color-mix(in srgb, ${item.accent} 10%, #ffffff)`,
                  color: item.accent,
                }}
              >
                {item.badge}
              </span>
            </div>
            <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--fg)", marginTop: "0.25rem" }}>
              {item.title}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.45 }}>
              {item.description}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: item.accent,
                fontSize: "0.8125rem",
                fontWeight: 700,
                marginTop: "auto",
              }}
            >
              Explorar <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>

      {/* Aprende algo en 1 minuto */}
      <h2 className="guia-section-title" style={{ marginTop: "2rem" }}>Aprende algo en 1 minuto</h2>
      <div className="guia-quick-lessons-grid">
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
                padding: "0.75rem 0.875rem",
                borderRadius: "var(--radius-md)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--primary)",
                textDecoration: "none",
                transition: "border-color var(--transition)",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                  flexShrink: 0,
                }}
              >
                {item.emoji}
              </span>
              <span style={{ flex: 1, fontSize: "0.84375rem", fontWeight: 700, color: "var(--fg)" }}>{item.title}</span>
              <CaretRight size={14} color="var(--muted)" />
            </Link>
          )
        })}
      </div>

      {/* ¿Sabías que? */}
      <Card
        padding="1rem 1.25rem"
        style={{
          marginTop: "1.75rem",
          background: "#fffbeb",
          borderColor: "#fde68a",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
          <Lightbulb size={22} weight="fill" color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "0.875rem", margin: "0 0 0.25rem", color: "#92400e" }}>
              ¿Sabías que?
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#78350f", margin: 0, lineHeight: 1.55 }}>{tip.text}</p>
            {tip.href && (
              <Link
                href={tip.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  marginTop: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#b45309",
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
          font-weight: 800;
          margin: 0 0 0.75rem;
        }
        .guia-hero-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }
        @media (min-width: 680px) {
          .guia-hero-stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .guia-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (min-width: 760px) {
          .guia-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .guia-quick-lessons-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }
        @media (min-width: 680px) {
          .guia-quick-lessons-grid {
            grid-template-columns: 1fr 1fr;
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

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "net" | "perception" | "deduction"
}) {
  const palette = {
    neutral: { bg: "#ffffff", border: "1px solid var(--border)", labelColor: "var(--muted)", valColor: "var(--fg)" },
    net: { bg: "#1b5e20", border: "1px solid #14532d", labelColor: "#bbf7d0", valColor: "#ffffff" },
    perception: { bg: "#ecfdf5", border: "1px solid #a7f3d0", labelColor: "#047857", valColor: "#065f46" },
    deduction: { bg: "#fff1f2", border: "1px solid #fecdd3", labelColor: "#be123c", valColor: "#881337" },
  }[tone]

  return (
    <div
      style={{
        padding: "0.625rem 0.75rem",
        borderRadius: "var(--radius-sm)",
        background: palette.bg,
        border: palette.border,
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          color: palette.labelColor,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 800,
          color: palette.valColor,
          marginTop: "0.125rem",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
