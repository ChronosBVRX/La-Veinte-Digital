import { CALENDARIOS, EVENT_LABELS } from "@/features/calendario/services/calendarioData"
import type { CalendarEventType } from "@/features/calendario/services/calendarioData"

interface ProfileSummary {
  adscripcion: string | null
  categoria: string | null
  antiguedad: string | null
}

function getNextPaymentDay(year: number, monthIndex: number, day: number): { date: Date; label: string } | null {
  const paymentTypes: CalendarEventType[] = ["santander", "otros", "cheque", "jubilados"]
  const yearData = CALENDARIOS[year] ?? CALENDARIOS[2026]
  if (!yearData) return null

  const now = new Date(year, monthIndex, day)
  const candidates: { date: Date; label: string }[] = []

  for (let mi = 0; mi < yearData.length; mi++) {
    const m = yearData[mi]
    for (const type of paymentTypes) {
      const days = m.events[type]
      if (!days) continue
      for (const d of days) {
        const candidate = new Date(year, mi, d)
        if (candidate >= now) {
          candidates.push({ date: candidate, label: EVENT_LABELS[type] })
        }
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates[0]
}

function isInteractivoOpen(year: number, monthIndex: number, day: number): boolean {
  const yearData = CALENDARIOS[year] ?? CALENDARIOS[2026]
  if (!yearData) return false
  const monthEvents = yearData[monthIndex]?.events.interactivo
  return monthEvents?.includes(day) ?? false
}

function getNextVacationStart(year: number, monthIndex: number, day: number): { date: Date } | null {
  const yearData = CALENDARIOS[year] ?? CALENDARIOS[2026]
  if (!yearData) return null

  const now = new Date(year, monthIndex, day)
  const candidates: Date[] = []

  for (let mi = 0; mi < yearData.length; mi++) {
    const m = yearData[mi]
    const days = m.events.vacacional
    if (!days) continue
    for (const d of days) {
      const candidate = new Date(year, mi, d)
      if (candidate >= now) {
        candidates.push(candidate)
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { date: candidates[0] }
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

export function TodayCard({ profile }: { profile: ProfileSummary }) {
  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()

  const yearData = CALENDARIOS[year]
  const displayYear = yearData ? year : 2026
  const dayName = DAY_NAMES[now.getDay()]

  const nextPayment = getNextPaymentDay(displayYear, monthIndex, day)
  const interactivoAbierto = isInteractivoOpen(displayYear, monthIndex, day)
  const nextVacation = getNextVacationStart(displayYear, monthIndex, day)

  const diffDays = nextPayment
    ? Math.ceil((nextPayment.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        borderRadius: "var(--radius-lg)", padding: "1.25rem",
        color: "#f1f5f9",
      }}
    >
      <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.125rem" }}>
        Mi d&iacute;a laboral
      </h2>
      <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: "0 0 1rem" }}>
        {dayName} {day} de {now.toLocaleDateString("es-MX", { month: "long" })} de {displayYear}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Row
          icon="💰"
          label="Próximo pago"
          value={nextPayment ? `${nextPayment.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })} (${nextPayment.label})${diffDays !== null ? ` · en ${diffDays} día${diffDays !== 1 ? "s" : ""}` : ""}` : "Sin información"}
        />

        <Row
          icon="📅"
          label="Interactivo"
          value={interactivoAbierto ? "Abierto" : "Cerrado"}
          valueColor={interactivoAbierto ? "#4ade80" : "#f87171"}
        />

        <Row
          icon="🏖️"
          label="Próximo periodo vacacional"
          value={nextVacation ? nextVacation.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "Sin información"}
        />

        {profile.antiguedad && (
          <Row icon="⏳" label="Antigüedad" value={profile.antiguedad} />
        )}

        {profile.adscripcion && (
          <Row icon="🏢" label="Adscripción" value={profile.adscripcion} />
        )}

        {profile.categoria && (
          <Row icon="📋" label="Categoría" value={profile.categoria} />
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
      <span style={{ flexShrink: 0, width: "1.25rem", textAlign: "center" }}>{icon}</span>
      <span style={{ color: "#94a3b8", minWidth: "9rem" }}>{label}:</span>
      <span style={{ fontWeight: 500, color: valueColor ?? "#e2e8f0", marginLeft: "auto", textAlign: "right" }}>
        {value}
      </span>
    </div>
  )
}
