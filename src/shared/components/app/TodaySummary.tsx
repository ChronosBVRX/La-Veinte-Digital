"use client"

import { useState, useEffect } from "react"
import { Wallet, Clock } from "@phosphor-icons/react"
import { getNextPaymentDay, SHIFT_LABELS } from "@/shared/lib/calendario-helpers"

interface NominaProfileLight {
  shift?: string
  workdayHours?: number
}

export function TodaySummary() {
  const [nominaProfile, setNominaProfile] = useState<NominaProfileLight | null>(null)

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("nomina_profile") : null
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNominaProfile({ shift: parsed.shift, workdayHours: parsed.workdayHours })
    } catch {
      // ignore
    }
  }, [])

  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()

  const santander = getNextPaymentDay(year, monthIndex, day, ["santander"])
  const otros = getNextPaymentDay(year, monthIndex, day, ["otros", "cheque"])
  const nearest = [santander, otros].filter(Boolean).sort((a, b) => a!.date.getTime() - b!.date.getTime())[0] ?? null
  const diffDays = nearest
    ? Math.ceil((nearest.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const shift = nominaProfile?.shift
  const jornada = nominaProfile?.workdayHours
  const hasNext = Boolean(nearest)
  const hasShift = Boolean(shift)

  if (!hasNext && !hasShift) return null

  const paymentLabel = nearest
    ? `${nearest.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}${
        diffDays !== null ? ` · faltan ${diffDays} día${diffDays !== 1 ? "s" : ""}` : ""
      }`
    : "Sin información"

  const shiftLabel = shift
    ? `${SHIFT_LABELS[shift] ?? SHIFT_LABELS[shift.toLowerCase()] ?? shift}${jornada ? ` · ${jornada} horas` : ""}`
    : ""

  return (
    <section style={{ marginBottom: "var(--space-6)" }}>
      <h2
        style={{
          margin: "0 0 0.625rem",
          fontSize: "var(--text-md)",
          fontWeight: 600,
          color: "var(--fg)",
          letterSpacing: "-0.01em",
        }}
      >
        Hoy
      </h2>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {hasNext && (
          <Row icon={<Wallet size={20} weight="duotone" color="var(--area-tools)" />} label="Próximo pago">
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)" }}>
              {paymentLabel}
            </span>
          </Row>
        )}
        {hasShift && hasNext && <Divider />}
        {hasShift && (
          <Row icon={<Clock size={20} weight="duotone" color="var(--area-assistance)" />} label="Tu turno">
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)" }}>
              {shiftLabel}
            </span>
          </Row>
        )}
      </div>
    </section>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem" }}>
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontWeight: 500 }}>{label}</span>
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "0 1rem" }} />
}