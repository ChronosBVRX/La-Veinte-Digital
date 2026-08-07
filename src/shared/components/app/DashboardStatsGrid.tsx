"use client"

import { useSyncExternalStore } from "react"
import {
  CurrencyDollar,
  Clock,
  AirplaneTilt,
  IdentificationCard,
} from "@phosphor-icons/react"
import { DashboardStat } from "./DashboardStat"
import { CALENDARIOS } from "@/shared/data/calendario"

interface ProfileSummary {
  antiguedad: string | null
}

function getNextPaymentDay(): { date: Date } | null {
  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()
  const yearData = CALENDARIOS[year]
  if (!yearData) return null
  const candidates: Date[] = []
  for (let mi = 0; mi < yearData.length; mi++) {
    const days = yearData[mi].events.santander
    if (!days) continue
    for (const d of days) {
      const candidate = new Date(year, mi, d)
      if (candidate >= new Date(year, monthIndex, day)) candidates.push(candidate)
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { date: candidates[0] }
}

function getNextVacation(): { date: Date } | null {
  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()
  const yearData = CALENDARIOS[year]
  if (!yearData) return null
  const candidates: Date[] = []
  for (let mi = 0; mi < yearData.length; mi++) {
    const days = yearData[mi].events.vacacional
    if (!days) continue
    for (const d of days) {
      const candidate = new Date(year, mi, d)
      if (candidate >= new Date(year, monthIndex, day)) candidates.push(candidate)
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { date: candidates[0] }
}

function hasImportedPayslip(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem("nomina_profile")
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return typeof parsed.displayedSeniorityAtLastPayslip?.referenceDate === "string"
  } catch {
    return false
  }
}

interface DashboardStatsGridProps {
  profile: ProfileSummary
}

export function DashboardStatsGrid({ profile }: DashboardStatsGridProps) {
  const hasTarjeton = useSyncExternalStore(
    () => () => {},
    () => hasImportedPayslip(),
    () => false,
  )

  const nextPayment = getNextPaymentDay()
  const nextVacation = getNextVacation()

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      <DashboardStat
        icon={CurrencyDollar}
        title="Próximo pago"
        value={
          nextPayment
            ? nextPayment.date.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
              })
            : "Sin información"
        }
        subtitle={
          nextPayment
            ? "Fecha programada de pago"
            : undefined
        }
        color="var(--area-work)"
        empty={!nextPayment}
      />

      <DashboardStat
        icon={Clock}
        title="Antigüedad"
        value={profile.antiguedad ?? "No registrada"}
        subtitle="Registrada en tu perfil"
        color="var(--brand-blue)"
        actionLabel={!profile.antiguedad ? "Registrar" : undefined}
        actionHref={!profile.antiguedad ? "/profile" : undefined}
        empty={!profile.antiguedad}
      />

      <DashboardStat
        icon={AirplaneTilt}
        title="Calendario vacacional"
        value={
          nextVacation
            ? nextVacation.date.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
              })
            : "Sin información"
        }
        subtitle={
          nextVacation
            ? "Próxima fecha del calendario"
            : undefined
        }
        color="var(--area-assistance)"
        empty={!nextVacation}
      />

      <DashboardStat
        icon={IdentificationCard}
        title="Último tarjetón"
        value={hasTarjeton ? "Importado" : "Sin importar"}
        subtitle={hasTarjeton ? "Datos actualizados" : "Importa tu tarjetón IMSS"}
        color="var(--area-tools)"
        actionLabel={!hasTarjeton ? "Importar" : undefined}
        actionHref={!hasTarjeton ? "/tarjeton" : undefined}
        empty={!hasTarjeton}
      />

    </div>
  )
}
