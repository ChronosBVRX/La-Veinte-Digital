"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import type { IconProps } from "@phosphor-icons/react"
import {
  CalendarDots,
  Article,
  Clock,
  FolderOpen,
  PencilLine,
  Sparkle,
} from "@phosphor-icons/react"
import { useIsNativeApp } from "@/shared/hooks/useIsNativeApp"
import { createClient } from "@/lib/supabase/client"
import { getUserWithTimeout } from "@/shared/lib/auth-helpers"
import {
  getTodayCommitments,
  getNextCommitment,
  getCommitmentDisplayTitle,
  formatHumanCommitmentDate,
} from "@/features/agenda-laboral/lib/commitment-calendar"
import { useCommitmentsListener } from "@/features/agenda-laboral/lib/agenda-bus"
import type { WorkerCommitment } from "@/features/agenda-laboral/types"
import { rowToCommitment, type CommitmentRow } from "@/features/agenda-laboral/services/commitments-supabase"

type IconType = React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>

interface HomeQuickActionsProps {
  heading?: string
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function formatQuincena(periodHalf: number | null, periodMonth: number | null): string | null {
  if (!periodHalf || !periodMonth) return null
  const monthName = MONTHS_ES[(periodMonth - 1) % 12]
  return `${periodHalf}ª quincena de ${monthName}`
}

function formatChecadaTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  if (isToday) return `Hoy · ${time}`
  if (isYesterday) return `Ayer · ${time}`
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + ` · ${time}`
}

// ── Tarjeta ─────────────────────────────────────────────────────────────────
interface QuickCardProps {
  icon: IconType
  title: string
  description: string
  status?: string | null
  statusTone?: "muted" | "success" | "warning"
  href: string
  color: string
  ariaLabel: string
  onClick?: () => void
  externalLink?: boolean
}

function QuickCard({
  icon: Icon,
  title,
  description,
  status,
  statusTone = "muted",
  href,
  color,
  ariaLabel,
  onClick,
}: QuickCardProps) {
  const statusColor =
    statusTone === "success" ? "var(--success)" : statusTone === "warning" ? "var(--warning)" : "var(--muted)"

  const cardInner = (
    <>
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius)",
          background: `linear-gradient(135deg, ${color}14, ${color}0f)`,
          border: `1px solid ${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} weight="duotone" color={color} />
      </span>
      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--fg)",
          lineHeight: 1.2,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: "1.95em",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 500,
          color: "var(--muted)",
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: "1.75em",
        }}
      >
        {description}
      </span>
      <span
        aria-live="polite"
        style={{
          fontSize: "0.6875rem",
          fontWeight: statusTone === "muted" ? 500 : 600,
          color: statusColor,
          lineHeight: 1.3,
          minHeight: "1rem",
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {status ?? "\u00A0"}
      </span>
    </>
  )

  const baseStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.32rem",
    minHeight: 108,
    padding: "0.7rem 0.65rem 0.6rem",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    textDecoration: "none",
    color: "var(--fg)",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
    transition: "transform var(--transition), box-shadow var(--transition), border-color var(--transition)",
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="hover-lift pressable"
        style={baseStyle}
      >
        {cardInner}
      </button>
    )
  }

  return (
    <Link href={href} aria-label={ariaLabel} className="hover-lift pressable" style={baseStyle}>
      {cardInner}
    </Link>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function HomeQuickActions({ heading = "¿Qué necesitas hoy?" }: HomeQuickActionsProps) {
  const isNative = useIsNativeApp()
  const router = useRouter()

  const [agendaSummary, setAgendaSummary] = useState<{
    loaded: boolean
    todayCount: number
    nextStatus: string | null
  }>({ loaded: false, todayCount: 0, nextStatus: null })

  const [tarjetonStatus, setTarjetonStatus] = useState<string | null>(null)
  const [tarjetonHasData, setTarjetonHasData] = useState(false)

  const [checadaStatus, setChecadaStatus] = useState<string | null>(null)
  const [checadaHasData, setChecadaHasData] = useState(false)

  // Agenda: compromisos usando la misma fuente de verdad canónica
  const loadAgenda = useCallback(async () => {
    let client: ReturnType<typeof createClient> | null = null
    try {
      client = createClient()
    } catch {
      setAgendaSummary({ loaded: true, todayCount: 0, nextStatus: null })
      return
    }

    try {
      const authRes = await getUserWithTimeout(client, 4000)
      if (!authRes.user) {
        setAgendaSummary({ loaded: true, todayCount: 0, nextStatus: null })
        return
      }

      const { data, error } = await client
        .from("worker_commitments")
        .select("*")
        .eq("user_id", authRes.user.id)
        .eq("status", "active")

      if (error || !data) {
        setAgendaSummary({ loaded: true, todayCount: 0, nextStatus: null })
        return
      }

      const commitments: WorkerCommitment[] = (data as CommitmentRow[]).map(rowToCommitment)
      const today = getTodayCommitments(commitments)
      const next = getNextCommitment(commitments)
      let nextStatus: string | null = null
      if (today.length === 0 && next) {
        const title = getCommitmentDisplayTitle(next.commitment)
        const dateLabel = formatHumanCommitmentDate(next.commitment.startAt).toLowerCase()
        nextStatus = `Próximo: ${title} · ${dateLabel}`
      }

      setAgendaSummary({
        loaded: true,
        todayCount: today.length,
        nextStatus,
      })
    } catch {
      setAgendaSummary({ loaded: true, todayCount: 0, nextStatus: null })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    loadAgenda()
  }, [loadAgenda])

  useCommitmentsListener(loadAgenda)

  // Tarjetón: último recibo
  useEffect(() => {
    let cancelled = false
    const signal = { aborted: false }

    const loadTarjeton = async () => {
      let client: ReturnType<typeof createClient> | null = null
      try {
        client = createClient()
      } catch {
        if (!cancelled) setTarjetonStatus(null)
        return
      }

      try {
        const authRes = await getUserWithTimeout(client, 4000, signal)
        if (cancelled || !authRes.user) {
          if (!cancelled) setTarjetonStatus(null)
          return
        }

        const { data } = await client
          .from("imported_payslips")
          .select("period_half,period_month,created_at")
          .eq("user_id", authRes.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return
        const row = data as { period_half?: number; period_month?: number } | null
        if (row?.period_half) {
          const q = formatQuincena(row.period_half, row.period_month ?? null)
          if (q) {
            setTarjetonStatus(`Último: ${q}`)
            setTarjetonHasData(true)
            return
          }
        }
        if (!cancelled) setTarjetonStatus(null)
      } catch {
        if (!cancelled) setTarjetonStatus(null)
      }
    }

    loadTarjeton()

    return () => {
      cancelled = true
      signal.aborted = true
    }
  }, [])

  // Checadas: última desde documentos nativos (si existe)
  useEffect(() => {
    if (!isNative || typeof window === "undefined" || !window.LaVeinteApp?.listNativeDocuments) {
      // No nativo: sin dato local
      return
    }
    let cancelled = false
    window.LaVeinteApp.listNativeDocuments()
      .then((docs) => {
        if (cancelled || !docs) return
        const checadas = docs.filter((d) => d.source.includes("BIOMETRIC"))
        if (checadas.length === 0) return
        // Más reciente por downloadedAt
        checadas.sort((a, b) => b.downloadedAt - a.downloadedAt)
        const latest = checadas[0]
        setChecadaStatus(`Última: ${formatChecadaTime(latest.downloadedAt)}`)
        setChecadaHasData(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isNative])

  const handleTarjetonClick = useCallback(() => {
    if (typeof window !== "undefined" && window.LaVeinteApp?.openOfficialPayslips) {
      window.LaVeinteApp.openOfficialPayslips()
      return
    }
    router.push("/profile/mi-informacion-laboral")
  }, [router])

  const handleChecadasClick = useCallback(() => {
    if (typeof window !== "undefined" && window.LaVeinteApp?.openBiometrics) {
      window.LaVeinteApp.openBiometrics()
      return
    }
    if (typeof window !== "undefined" && window.LaVeinteApp?.openOfficialPayslips) {
      window.LaVeinteApp.openOfficialPayslips()
      return
    }
    router.push("/documentos-personales")
  }, [router])

  // Estados derivados para cada tarjeta
  const agendaDesc = "Registra compromisos y recordatorios"
  const agendaStatus = !agendaSummary.loaded
    ? "Cargando…"
    : agendaSummary.todayCount > 0
      ? agendaSummary.todayCount === 1
        ? "1 compromiso hoy"
        : `${agendaSummary.todayCount} compromisos hoy`
      : agendaSummary.nextStatus
        ? agendaSummary.nextStatus
        : "Sin compromisos hoy"

  const tarjetonDesc = "Consulta tus recibos de pago"
  const tarjetonStatusDisplay =
    tarjetonHasData && tarjetonStatus ? tarjetonStatus : null

  const checadaDesc = "Consulta tus registros biométricos"
  const checadaStatusDisplay =
    checadaHasData && checadaStatus ? checadaStatus : null

  const docDesc = "Consulta tus archivos guardados"
  // No hay fuente única fiable para el total (tarjetones + checadas + escritos + PDFs/IDs digitalizados).
  // Para no mostrar un número incompleto, la tarjeta usa solo la descripción.
  const docStatusDisplay: string | null = null

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
        {heading}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.625rem",
        }}
      >
        <QuickCard
          icon={CalendarDots}
          title="Mi agenda"
          description={agendaDesc}
          status={agendaStatus}
          statusTone={agendaSummary.loaded && agendaSummary.todayCount > 0 ? "success" : "muted"}
          href="/bitacora"
          color="var(--area-work)"
          ariaLabel="Mi agenda: registra compromisos y recordatorios"
        />
        {isNative && (
          <QuickCard
            icon={Article}
            title="Mi tarjetón"
            description={tarjetonDesc}
            status={tarjetonStatusDisplay}
            statusTone={tarjetonHasData ? "success" : "muted"}
            href="/profile/mi-informacion-laboral"
            color="var(--area-tools)"
            ariaLabel="Mi tarjetón: consulta tus recibos de pago"
            onClick={handleTarjetonClick}
          />
        )}
        {isNative && (
          <QuickCard
            icon={Clock}
            title="Mis checadas"
            description={checadaDesc}
            status={checadaStatusDisplay}
            statusTone={checadaHasData ? "success" : "muted"}
            href="/documentos-personales"
            color="#0e7490"
            ariaLabel="Mis checadas: consulta tus registros biométricos"
            onClick={handleChecadasClick}
          />
        )}
        <QuickCard
          icon={FolderOpen}
          title="Mis documentos"
          description={docDesc}
          status={docStatusDisplay}
          statusTone="muted"
          href="/documentos-personales"
          color="#7c3aed"
          ariaLabel="Mis documentos: consulta tus archivos guardados"
        />
        <QuickCard
          icon={PencilLine}
          title="Hacer un escrito"
          description="Créalo paso a paso"
          status="Te ayudamos a redactarlo"
          href="/escritos"
          color="var(--area-work)"
          ariaLabel="Hacer un escrito: créalo paso a paso"
        />
        <QuickCard
          icon={Sparkle}
          title="Mis derechos"
          description="Pregunta sobre tu contrato y derechos"
          status="Asistente normativo"
          href="/asistente"
          color="var(--area-assistance)"
          ariaLabel="Mis derechos: pregunta sobre tu contrato y derechos"
        />
      </div>
      <p
        style={{
          margin: "0.5rem 0 0",
          fontSize: "0.6875rem",
          color: "var(--muted)",
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        Calculadoras y transferencias siguen en Herramientas y Documentos.
      </p>
    </section>
  )
}
