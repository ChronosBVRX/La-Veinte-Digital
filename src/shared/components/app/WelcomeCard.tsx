"use client"

import { useState, useEffect } from "react"
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
  const [commitmentsCount, setCommitmentsCount] = useState<number | null>(null)

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

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) {
        setCommitmentsCount(0)
        return
      }
      supabase
        .from("worker_commitments")
        .select("id,start_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .then(({ data, error }) => {
          if (error || !data || !mounted) {
            setCommitmentsCount(0)
            return
          }
          const today = new Date()
          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
          const todayCount = data.filter((c) => {
            if (!c.start_at) return false
            const d = new Date(c.start_at)
            return d >= start && d < end
          }).length
          setCommitmentsCount(todayCount)
        })
    })
    return () => {
      mounted = false
    }
  }, [])

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
        {santander && santanderDaysLeft !== null && (
          <Line>
            Faltan <strong style={strong}>{para(santanderDaysLeft)}</strong> para tu pago de
            Santander o Scotiabank&nbsp;
            <span style={dateChip}>cae el {santanderLabel}</span>.
          </Line>
        )}
        {otros && otrosDaysLeft !== null && (
          <Line>
            Faltan <strong style={strong}>{para(otrosDaysLeft)}</strong> para el pago de Banamex,
            Banorte, BBVA o con cheque&nbsp;
            <span style={dateChip}>cae el {otrosLabel}</span>.
          </Line>
        )}
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
                  Faltan <strong style={strong}>{para(interactiveDaysLeft)}</strong> para que
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

      <Block icon={<CalendarCheck size={18} weight="duotone" />} label="Tus compromisos hoy">
        {commitmentsCount === null ? (
          <Line>Cargando…</Line>
        ) : commitmentsCount === 0 ? (
          <Line>
            No tienes compromisos programados para hoy. ¡Aprovecha tu día!
          </Line>
        ) : (
          <Line>
            Tienes <strong style={strong}>{commitmentsCount}</strong> compromiso{commitmentsCount !== 1 ? "s" : ""} hoy.{" "}
            <Link href="#agenda" style={{ color: "#60a5fa", textDecoration: "underline", fontWeight: 600 }}>
              Verlos en tu agenda
            </Link>
          </Line>
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