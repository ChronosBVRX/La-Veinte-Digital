"use client"

import { useState, useEffect } from "react"
import { Modal } from "@/shared/components/ui/Modal"
import Link from "next/link"
import { CALENDARIOS, EVENT_LABELS } from "@/features/calendario/services/calendarioData"
import type { CalendarEventType } from "@/features/calendario/services/calendarioData"

interface ProfileSummary {
  adscripcion: string | null
  categoria: string | null
  antiguedad: string | null
  id?: string
}

interface NominaProfileLight {
  shift?: string
  workdayHours?: number
  employmentType?: string
  years?: number
  months?: number
  days?: number
  referenceDate?: string
}

const SHIFT_LABELS: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  nocturno: "Nocturno",
  jornada_acumulada: "Jornada Acumulada",
  mixto: "Mixto",
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

function getNextPaymentDay(year: number, monthIndex: number, day: number, types?: CalendarEventType[]): { date: Date; label: string } | null {
  const filterTypes = types ?? ["santander", "otros", "cheque", "jubilados"]
  const yearData = CALENDARIOS[year] ?? CALENDARIOS[2026]
  if (!yearData) return null
  const now = new Date(year, monthIndex, day)
  const candidates: { date: Date; label: string }[] = []
  for (let mi = 0; mi < yearData.length; mi++) {
    const m = yearData[mi]
    for (const type of filterTypes) {
      const days = m.events[type]
      if (!days) continue
      for (const d of days) {
        const candidate = new Date(year, mi, d)
        if (candidate >= now) candidates.push({ date: candidate, label: EVENT_LABELS[type] })
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
  return yearData[monthIndex]?.events.interactivo?.includes(day) ?? false
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
      if (candidate >= now) candidates.push(candidate)
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { date: candidates[0] }
}

function getBiweekEnd(): string {
  const now = new Date()
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (day <= 15) return `${year}-${String(month + 1).padStart(2, "0")}-15`
  const lastDay = new Date(year, month + 1, 0).getDate()
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

function formatSeniority(y: number, m: number, d: number): string {
  return `${y} años, ${m} meses y ${d} días`
}

export function TodayCard({ profile }: { profile: ProfileSummary }) {
  const [open, setOpen] = useState(false)
  const [nominaProfile, setNominaProfile] = useState<NominaProfileLight | null>(null)

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("nomina_profile") : null
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const seniority = parsed.displayedSeniorityAtLastPayslip
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNominaProfile({
        shift: parsed.shift,
        workdayHours: parsed.workdayHours,
        employmentType: parsed.employmentType,
        years: seniority?.years,
        months: seniority?.months,
        days: seniority?.days,
        referenceDate: seniority?.referenceDate,
      })
    } catch {
      // ignore
    }
  }, [])

  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()
  const yearData = CALENDARIOS[year]
  const displayYear = yearData ? year : 2026
  const dayName = DAY_NAMES[now.getDay()]

  const nextPayment = getNextPaymentDay(displayYear, monthIndex, day)
  const nextPaymentActivo = getNextPaymentDay(displayYear, monthIndex, day, ["santander"])
  const nextPaymentOtro = getNextPaymentDay(displayYear, monthIndex, day, ["otros", "cheque"])
  const interactivoAbierto = isInteractivoOpen(displayYear, monthIndex, day)
  const nextVacation = getNextVacationStart(displayYear, monthIndex, day)

  const diffDaysActivo = nextPaymentActivo
    ? Math.ceil((nextPaymentActivo.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const diffDaysOtro = nextPaymentOtro
    ? Math.ceil((nextPaymentOtro.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  function calcEvolvedSeniority(): string | null {
    if (
      nominaProfile?.years == null ||
      nominaProfile?.months == null ||
      nominaProfile?.days == null ||
      !nominaProfile?.referenceDate
    ) return null
    const ref = nominaProfile.referenceDate.split("-").map(Number)
    let ey = ref[0] - nominaProfile.years
    let em = ref[1] - nominaProfile.months
    let ed = ref[2] - nominaProfile.days
    if (ed < 1) { em--; ed += new Date(ey, em - 1, 0).getDate() }
    if (em < 1) { ey--; em += 12 }
    const effectiveDate = new Date(ey, em - 1, ed)
    const biweekEnd = getBiweekEnd().split("-").map(Number)
    const target = new Date(biweekEnd[0], biweekEnd[1] - 1, biweekEnd[2])
    if (isNaN(effectiveDate.getTime())) return null
    let years = target.getFullYear() - effectiveDate.getFullYear()
    let months = target.getMonth() - effectiveDate.getMonth()
    let days = target.getDate() - effectiveDate.getDate()
    if (days < 0) { months--; days += new Date(target.getFullYear(), target.getMonth(), 0).getDate() }
    if (months < 0) { years--; months += 12 }
    return formatSeniority(years, months, days)
  }
  const seniorityEvolucion = calcEvolvedSeniority()
  const turno = nominaProfile?.shift
  const jornada = nominaProfile?.workdayHours

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
          color: "#f1f5f9", cursor: "pointer",
          transition: "opacity 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
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
            value={nextPayment ? `${nextPayment.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })} (${nextPayment.label})` : "Sin información"}
          />
          <Row
            icon="📅"
            label="Interactivo"
            value={interactivoAbierto ? "Abierto" : "Cerrado"}
            valueColor={interactivoAbierto ? "#f87171" : "#4ade80"}
          />
          <Row
            icon="🏖️"
            label="Próximo periodo vacacional"
            value={nextVacation ? `${nextVacation.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}` : "Sin información"}
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

      <Modal open={open} onClose={() => setOpen(false)} title="Mi día laboral" size="md">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
            {dayName} {day} de {now.toLocaleDateString("es-MX", { month: "long" })} de {displayYear}
          </p>

          <Section icon="💰" title="Próximos pagos">
            {nextPaymentActivo && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Trabajador activo:</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {nextPaymentActivo.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                  {diffDaysActivo !== null ? ` (en ${diffDaysActivo} día${diffDaysActivo !== 1 ? "s" : ""})` : ""}
                </span>
              </div>
            )}
            <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 500, marginTop: "0.125rem" }}>
              Pago Santander y Scotiabank
            </div>
            {nextPaymentOtro && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Otros:</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    {nextPaymentOtro.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                    {diffDaysOtro !== null ? ` (en ${diffDaysOtro} día${diffDaysOtro !== 1 ? "s" : ""})` : ""}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  Pago Banamex, Banorte, BBVA y demás bancos o pago con cheque
                </div>
              </>
            )}
            {!nextPaymentActivo && !nextPaymentOtro && (
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Sin información</span>
            )}
          </Section>

          <Section icon="📅" title="Interactivo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Estado:</span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: interactivoAbierto ? "#f87171" : "#4ade80" }}>
                {interactivoAbierto ? "Abierto" : "Cerrado"}
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", margin: "0.375rem 0 0", color: "var(--muted)", fontStyle: "italic" }}>
              {interactivoAbierto
                ? "Estas fechas no se pueden realizar movimientos."
                : "Puedes hacer tus trámites."}
            </p>
          </Section>

          <Section icon="🏖️" title="Próximo periodo vacacional">
            {nextVacation ? (
              <div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  Inicio: {nextVacation.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                </span>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)", marginLeft: "0.375rem" }}>
                  ({DAY_NAMES[nextVacation.date.getDay()]})
                </span>
              </div>
            ) : (
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Sin información</span>
            )}
          </Section>

          <Section icon="⏳" title="Antigüedad">
            {profile.antiguedad ? (
              <>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                  {profile.antiguedad}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                  Esta es la antigüedad que registraste. Si no es correcta, corrígela en{" "}
                  <Link href="/profile" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                    tu perfil
                  </Link>{" "}
                  para mayor exactitud de datos.
                </p>
                {seniorityEvolucion && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--accent)", borderRadius: "var(--radius)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.125rem" }}>
                      Antigüedad actualizada al cierre de la quincena:
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      {seniorityEvolucion}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                No has registrado tu antigüedad.{" "}
                <Link href="/profile" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                  Regístrala aquí
                </Link>
              </span>
            )}
          </Section>

          <Section icon="📌" title="Próximos compromisos">
            {turno || jornada ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {turno && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Turno:</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{SHIFT_LABELS[turno]}</span>
                  </div>
                )}
                {jornada && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Jornada:</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{jornada} horas</span>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                No hay compromisos registrados.{" "}
                <Link href="/nomina/perfil" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                  Configura tu perfil laboral
                </Link>
              </span>
            )}
            {nominaProfile?.employmentType && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.375rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Tipo de contratación:</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                  {nominaProfile.employmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
            )}
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--accent)", borderRadius: "var(--radius)" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
                {turno && jornada
                  ? `Tu horario habitual es turno ${SHIFT_LABELS[turno]} con jornada de ${jornada} horas.`
                  : "Configura tu perfil laboral para ver tus compromisos."}
              </p>
            </div>
          </Section>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
            <Link
              href="/nomina/perfil"
              style={{
                fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Configurar perfil laboral completo →
            </Link>
          </div>
        </div>
      </Modal>
    </>
  )
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderBottom: "1px solid var(--border)", paddingBottom: "1rem",
    }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <span>{icon}</span>
        {title}
      </h3>
      {children}
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
