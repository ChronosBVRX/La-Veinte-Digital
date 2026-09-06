"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Sun,
  Moon,
  Clock,
  Wallet,
  CalendarDots,
  Briefcase,
  CalendarCheck,
} from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { CALENDARIOS } from "@/shared/data/calendario"
import {
  getNextPaymentDay,
  isInteractivoOpen,
  getNextNonInteractiveDay,
  SHIFT_LABELS,
} from "@/shared/lib/calendario-helpers"
import {
  getNextCommitment,
  formatHumanCommitmentDate,
  formatLocalTime,
  getCommitmentDisplayTitle,
  getCommitmentDisplayIcon,
  type NextCommitmentResult,
} from "@/features/agenda-laboral/lib/commitment-calendar"
import { useCommitmentsListener } from "@/features/agenda-laboral/lib/agenda-bus"
import type { WorkerCommitment } from "@/features/agenda-laboral/types"
import { rowToCommitment, type CommitmentRow } from "@/features/agenda-laboral/services/commitments-supabase"

interface WelcomeCardProps {
  fullName: string | null
  greeting: string
  dateLabel: string
}

interface NominaProfileLight {
  shift?: string
  workdayHours?: number
}

const para = (days: number | null): string | null => {
  if (days === null) return null
  return `${days} día${days !== 1 ? "s" : ""}`
}

export function WelcomeCard({ fullName, greeting, dateLabel }: WelcomeCardProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const [nominaProfile, setNominaProfile] = useState<NominaProfileLight | null>(null)
  const [nextCommitmentState, setNextCommitmentState] = useState<{
    loaded: boolean
    result: NextCommitmentResult | null
  }>({ loaded: false, result: null })

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem("nomina_profile")
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNominaProfile({ shift: parsed.shift, workdayHours: parsed.workdayHours })
    } catch {
      // ignore
    }
  }, [])

  const loadNextCommitment = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNextCommitmentState({ loaded: true, result: null })
        return
      }
      const { data, error } = await supabase
        .from("worker_commitments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
      if (error || !data) {
        setNextCommitmentState({ loaded: true, result: null })
        return
      }
      const commitments: WorkerCommitment[] = (data as CommitmentRow[]).map(rowToCommitment)
      const next = getNextCommitment(commitments)
      setNextCommitmentState({ loaded: true, result: next })
    } catch {
      setNextCommitmentState({ loaded: true, result: null })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    loadNextCommitment()
  }, [loadNextCommitment])

  useCommitmentsListener(loadNextCommitment)

  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()
  const yearData = CALENDARIOS[year]
  const hasCalendar = Boolean(yearData)

  const santander = hasCalendar ? getNextPaymentDay(year, monthIndex, day, ["santander"]) : null
  const otros = hasCalendar ? getNextPaymentDay(year, monthIndex, day, ["otros", "cheque"]) : null
  const interactiveOpen = hasCalendar ? isInteractivoOpen(year, monthIndex, day) : false
  const nextNonInteractive = interactiveOpen
    ? getNextNonInteractiveDay(year, monthIndex, day)
    : null
  const interactiveDaysLeft =
    nextNonInteractive !== null
      ? Math.ceil((nextNonInteractive.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null
  const interactiveEndsLabel = nextNonInteractive
    ? nextNonInteractive.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
    : ""
  const santanderDaysLeft = santander
    ? Math.ceil((santander.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const santanderLabel = santander
    ? santander.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
    : ""
  const otrosDaysLeft = otros
    ? Math.ceil((otros.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const otrosLabel = otros
    ? otros.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
    : ""

  const shift = nominaProfile?.shift
  const jornadaHours = nominaProfile?.workdayHours

  const greetingIsMorning = greeting === "Buenos días"
  const greetingIsAfternoon = greeting === "Buenas tardes"
  const greetingIcon = greetingIsMorning ? (
    <Sun size={20} weight="duotone" color="#5eead4" />
  ) : greetingIsAfternoon ? (
    <Clock size={20} weight="duotone" color="#5eead4" />
  ) : (
    <Moon size={20} weight="duotone" color="#5eead4" />
  )

  return (
    <section
      style={{
        marginBottom: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        padding: "1.25rem",
        color: "#f1f5f9",
        boxShadow: "0 6px 20px rgba(2,6,23,0.28)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(94,234,212,0.12)",
            color: "#5eead4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {greetingIcon}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "#cbd5e1",
              fontSize: "var(--text-sm)",
              textTransform: "capitalize",
            }}
          >
            {dateLabel}
          </p>
        </div>
      </div>

      <p
        style={{
          margin: "0.5rem 0 0",
          color: "#94a3b8",
          fontSize: "var(--text-sm)",
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Aquí tienes lo más importante de tu día.
      </p>

      <Block icon={<Wallet size={18} weight="duotone" />} label="Próximo pago">
        {santander && santanderDaysLeft !== null && santanderDaysLeft === 0 ? (
          <Line>
            Hoy paga Santander o Scotiabank&nbsp;
            <span style={dateChip}>cae el {santanderLabel}</span>.
          </Line>
        ) : santander && santanderDaysLeft !== null && santanderDaysLeft === 1 ? (
          <Line>
            Mañana paga Santander o Scotiabank&nbsp;
            <span style={dateChip}>cae el {santanderLabel}</span>.
          </Line>
        ) : santander && santanderDaysLeft !== null ? (
          <Line>
            Faltan <strong style={strong}>{para(santanderDaysLeft)}</strong>{" "}para tu pago de{" "}
            Santander o Scotiabank&nbsp;
            <span style={dateChip}>cae el {santanderLabel}</span>.
          </Line>
        ) : null}
        {otros && otrosDaysLeft !== null && otrosDaysLeft === 0 ? (
          <Line>
            {santanderDaysLeft === 0 ? "y h" : "H"}oy pagan Banamex, Banorte, BBVA o con
            cheque&nbsp;
            <span style={dateChip}>cae el {otrosLabel}</span>.
          </Line>
        ) : otros && otrosDaysLeft !== null && otrosDaysLeft === 1 ? (
          <Line>
            {santanderDaysLeft === 0 ? "y m" : "M"}añana pagan Banamex, Banorte, BBVA o con
            cheque&nbsp;
            <span style={dateChip}>cae el {otrosLabel}</span>.
          </Line>
        ) : otros && otrosDaysLeft !== null ? (
          <Line>
            Faltan <strong style={strong}>{para(otrosDaysLeft)}</strong>{" "}para el pago de{" "}
            Banamex, Banorte, BBVA o con cheque&nbsp;
            <span style={dateChip}>cae el {otrosLabel}</span>.
          </Line>
        ) : null}
        {!santander && !otros && <Line>Sin información de pagos por ahora.</Line>}
      </Block>

      <Block icon={<CalendarDots size={18} weight="duotone" />} label="Periodo interactivo">
        {interactiveOpen ? (
          <Line>
            Estamos en <strong style={strong}>periodo interactivo</strong>, así que por el momento
            no puedes hacer cambios ni consultar lugares.
            {interactiveDaysLeft !== null && nextNonInteractive ? (
              interactiveDaysLeft <= 0 ? (
                " Termina mañana."
              ) : (
                <>
                  {" "}
                  Faltan <strong style={strong}>{para(interactiveDaysLeft)}</strong>{" "}para que
                  termine&nbsp;
                  <span style={dateChip}>cae el {interactiveEndsLabel}</span>.
                </>
              )
            ) : null}
          </Line>
        ) : (
          <Line>
            Hoy <strong style={strong}>no estamos en interactivo</strong>: puedes hacer tus trámites
            y consultar lugares libremente.
          </Line>
        )}
      </Block>

      {shift && (
        <Block icon={<Briefcase size={18} weight="duotone" />} label="Tu turno de hoy">
          <Line>
            <strong style={strong}>{SHIFT_LABELS[shift] ?? shift}</strong>
            {jornadaHours ? ` · ${jornadaHours} horas` : ""}.
          </Line>
        </Block>
      )}

      <Block icon={<CalendarCheck size={18} weight="duotone" />} label="Tu próximo compromiso">
        {!nextCommitmentState.loaded ? (
          <Line>Cargando…</Line>
        ) : !nextCommitmentState.result ? (
          <Line>No tienes próximos compromisos.</Line>
        ) : nextCommitmentState.result.inProgress ? (
          <>
            <Line>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>En curso</span>
              {" · "}
              <strong style={strong}>
                {getCommitmentDisplayTitle(nextCommitmentState.result.commitment)}
              </strong>
              {" hasta las "}
              {formatLocalTime(nextCommitmentState.result.commitment.endAt)}
              {nextCommitmentState.result.commitment.service ? ` · ${nextCommitmentState.result.commitment.service}` : ""}
            </Line>
            <div style={{ marginTop: "0.25rem" }}>
              <Link href="#agenda" style={{ color: "#60a5fa", textDecoration: "underline", fontWeight: 600, fontSize: "var(--text-xs)" }}>
                Ver en tu agenda
              </Link>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>
                {getCommitmentDisplayIcon(nextCommitmentState.result.commitment.type)}
              </span>
              <strong style={strong}>
                {getCommitmentDisplayTitle(nextCommitmentState.result.commitment)}
              </strong>
            </div>
            <div style={{ color: "#cbd5e1", fontSize: "var(--text-xs)" }}>
              {formatHumanCommitmentDate(nextCommitmentState.result.commitment.startAt)} · {formatLocalTime(nextCommitmentState.result.commitment.startAt)}
              {nextCommitmentState.result.commitment.endAt && `–${formatLocalTime(nextCommitmentState.result.commitment.endAt)}`}
              {nextCommitmentState.result.commitment.service
                ? ` · ${nextCommitmentState.result.commitment.service}`
                : nextCommitmentState.result.commitment.workplace
                  ? ` · ${nextCommitmentState.result.commitment.workplace}`
                  : ""}
            </div>
            <div style={{ marginTop: "0.25rem" }}>
              <Link href="#agenda" style={{ color: "#60a5fa", textDecoration: "underline", fontWeight: 600, fontSize: "var(--text-xs)" }}>
                Ver en tu agenda
              </Link>
            </div>
          </div>
        )}
      </Block>
    </section>
  )
}

const strong: React.CSSProperties = {
  color: "#ffffff",
  fontWeight: 700,
}

const dateChip: React.CSSProperties = {
  background: "rgba(96,165,250,0.16)",
  color: "#93c5fd",
  padding: "0.05rem 0.4rem",
  borderRadius: "var(--radius-pill)",
  fontSize: "0.75rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
}

interface BlockProps {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}

function Block({ icon, label, children }: BlockProps) {
  return (
    <div
      style={{
        marginTop: "0.875rem",
        paddingTop: "0.875rem",
        borderTop: "1px solid rgba(148,163,184,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
        <span style={{ color: "#7dd3fc", display: "flex" }}>{icon}</span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#93c5fd",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "#e2e8f0", lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function Line({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0 }}>{children}</p>
}