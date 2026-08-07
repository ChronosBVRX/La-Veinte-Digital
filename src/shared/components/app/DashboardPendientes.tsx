"use client"


import Link from "next/link"
import { WarningCircle, ArrowRight } from "@phosphor-icons/react"

interface AlertItem {
  key: string
  message: string
  actionLabel: string
  actionHref: string
}

interface DashboardPendientesProps {
  hasAntiguedad: boolean
  hasTarjeton: boolean
  hasCategoria: boolean
}

export function DashboardPendientes({ hasAntiguedad, hasTarjeton, hasCategoria }: DashboardPendientesProps) {
  const alerts: AlertItem[] = []

  if (!hasCategoria) {
    alerts.push({
      key: "categoria",
      message: "Completa tu categoría para que las herramientas sepan cómo calcular tus prestaciones.",
      actionLabel: "Completar perfil",
      actionHref: "/profile",
    })
  }

  if (!hasAntiguedad) {
    alerts.push({
      key: "antiguedad",
      message: "Completa tu antigüedad para calcular correctamente tus prestaciones y vacaciones.",
      actionLabel: "Completar perfil",
      actionHref: "/profile",
    })
  }

  if (!hasTarjeton) {
    alerts.push({
      key: "tarjeton",
      message: "Importa tu tarjetón del IMSS para que tus datos laborales estén siempre actualizados.",
      actionLabel: "Importar tarjetón",
      actionHref: "/tarjeton",
    })
  }

  const visibleAlerts = alerts.slice(0, 2)

  if (visibleAlerts.length === 0) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "var(--space-5)" }}>
      {visibleAlerts.map((alert) => (
        <div
          key={alert.key}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "var(--state-warning-bg)",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-md)",
          }}
        >
          <WarningCircle size={18} weight="fill" color="var(--state-warning-fg)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--state-warning-fg)", lineHeight: 1.5 }}>
              {alert.message}
            </span>
          </div>
          <Link
            href={alert.actionHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--state-warning-fg)",
              textDecoration: "underline",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {alert.actionLabel}
            <ArrowRight size={12} />
          </Link>
        </div>
      ))}
    </div>
  )
}
