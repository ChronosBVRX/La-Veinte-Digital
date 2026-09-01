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

// ── Modal de credenciales IMSS ──────────────────────────────────────────────
function ImssRequiredDialog({
  open,
  variant,
  onClose,
  onConfigure,
}: {
  open: boolean
  variant: "tarjeton" | "checadas"
  onClose: () => void
  onConfigure: () => void
}) {
  if (!open) return null
  const isTarjeton = variant === "tarjeton"
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="imss-dialog-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "1.25rem 1.25rem 1rem",
          width: "100%",
          maxWidth: 480,
          margin: "0 0.5rem",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          id="imss-dialog-title"
          style={{ margin: "0 0 0.375rem", fontSize: "1rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.3 }}
        >
          {isTarjeton ? "Acceso a Tu Perfil IMSS" : "Acceso a Tus Checadas"}
        </h3>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
          {isTarjeton
            ? "Para consultar y guardar automáticamente tus tarjetones, necesitas configurar el acceso a Tu Perfil IMSS."
            : "Para consultar y guardar tus registros biométricos necesitas configurar el acceso a Tu Perfil IMSS."}
        </p>
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1rem" }}>
          <button
            onClick={onConfigure}
            className="pressable"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: "var(--radius)",
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Configurar acceso
          </button>
          <button
            onClick={onClose}
            className="pressable"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}

function BiometricWebFallbackDialog({
  open,
  onClose,
  onViewSaved,
}: {
  open: boolean
  onClose: () => void
  onViewSaved: () => void
}) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bio-web-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "1.25rem 1.25rem 1rem",
          width: "100%",
          maxWidth: 480,
          margin: "0 0.5rem",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
          border: "1px solid var(--border)",
        }}
      >
        <h3 id="bio-web-title" style={{ margin: "0 0 0.375rem", fontSize: "1rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.3 }}>
          Consulta tus registros biométricos
        </h3>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
          El acceso directo a Tu Perfil IMSS está disponible desde la app de La Veinte Digital.
        </p>
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1rem" }}>
          <button
            onClick={onViewSaved}
            className="pressable"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: "var(--radius)",
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Ver checadas guardadas
          </button>
          <button
            onClick={onClose}
            className="pressable"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
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

  const [agendaCount, setAgendaCount] = useState<number | null>(null)
  const [agendaLoaded, setAgendaLoaded] = useState(false)

  const [tarjetonStatus, setTarjetonStatus] = useState<string | null>(null)
  const [tarjetonHasData, setTarjetonHasData] = useState(false)

  const [checadaStatus, setChecadaStatus] = useState<string | null>(null)
  const [checadaHasData, setChecadaHasData] = useState(false)

  const [hasImssCreds, setHasImssCreds] = useState<boolean | null>(null)

  // Detectar credenciales IMSS de forma sincrónica cuando bridge esté listo
  useEffect(() => {
    if (!isNative) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bridged detection
      setHasImssCreds(false)
      return
    }
    try {
      const bridge = typeof window !== "undefined" ? window.LaVeinteApp : undefined
      if (bridge?.hasImssCredentials) {
        // Android expone boolean sincrónico; iOS stub retorna false
        const v = bridge.hasImssCredentials("tuperfil")
        setHasImssCreds(Boolean(v))
      } else {
        setHasImssCreds(false)
      }
    } catch {
      setHasImssCreds(false)
    }
  }, [isNative])

  // Agenda: compromisos del día
  useEffect(() => {
    let cancelled = false
    const signal = { aborted: false }

    const loadAgenda = async () => {
      let client: ReturnType<typeof createClient> | null = null
      try {
        client = createClient()
      } catch {
        if (!cancelled) {
          setAgendaCount(0)
          setAgendaLoaded(true)
        }
        return
      }

      try {
        const authRes = await getUserWithTimeout(client, 4000, signal)
        if (cancelled) return

        if (!authRes.user) {
          setAgendaLoaded(true)
          setAgendaCount(0)
          return
        }

        const { data, error } = await client
          .from("worker_commitments")
          .select("id,start_at")
          .eq("user_id", authRes.user.id)
          .eq("status", "active")

        if (cancelled) return
        if (error || !data) {
          setAgendaCount(0)
          setAgendaLoaded(true)
          return
        }

        const rows = data as Array<{ start_at?: string }>
        const today = new Date()
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        const hoy = rows.filter((r) => {
          const raw = r.start_at
          if (!raw) return false
          const d = new Date(raw)
          return d >= start && d < end
        }).length
        setAgendaCount(hoy)
        setAgendaLoaded(true)
      } catch {
        if (!cancelled) {
          setAgendaCount(0)
          setAgendaLoaded(true)
        }
      }
    }

    loadAgenda()

    return () => {
      cancelled = true
      signal.aborted = true
    }
  }, [])

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
    if (isNative && hasImssCreds === false) {
      // Navigate directly to config — no modal
      router.push("/profile/mi-informacion-laboral")
      return
    }
    if (isNative && typeof window !== "undefined" && window.LaVeinteApp?.openOfficialPayslips) {
      window.LaVeinteApp.openOfficialPayslips()
      return
    }
    router.push("/profile/mi-informacion-laboral")
  }, [isNative, hasImssCreds, router])

  const handleChecadasClick = useCallback(() => {
    if (!isNative) {
      // Web: go directly to documentos
      router.push("/documentos-personales")
      return
    }
    if (hasImssCreds === false) {
      // Navigate directly to config — no modal
      router.push("/profile/mi-informacion-laboral")
      return
    }
    if (typeof window !== "undefined" && window.LaVeinteApp?.openBiometrics) {
      window.LaVeinteApp.openBiometrics()
      return
    }
    // Fallback si bridge antiguo sin openBiometrics: abre hub
    if (typeof window !== "undefined" && window.LaVeinteApp?.openOfficialPayslips) {
      window.LaVeinteApp.openOfficialPayslips()
      return
    }
    router.push("/documentos-personales")
  }, [isNative, hasImssCreds, router])

  // Estados derivados para cada tarjeta
  const agendaDesc = "Registra compromisos y recordatorios"
  const agendaStatus = !agendaLoaded
    ? "Cargando…"
    : agendaCount === 0
      ? "Sin compromisos hoy"
      : agendaCount === 1
        ? "1 compromiso hoy"
        : `${agendaCount} compromisos hoy`

  const needsImss = hasImssCreds === false
  const tarjetonDesc =
    needsImss && isNative
      ? "Configura Tu Perfil IMSS para consultar recibos"
      : "Consulta tus recibos de pago"
  const tarjetonStatusDisplay =
    tarjetonHasData && tarjetonStatus ? tarjetonStatus : null

  const checadaDesc =
    needsImss
      ? "Configura Tu Perfil IMSS para ver registros"
      : "Consulta tus registros biométricos"
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
          statusTone={agendaCount !== null && agendaCount > 0 ? "success" : "muted"}
          href="/bitacora"
          color="var(--area-work)"
          ariaLabel="Mi agenda: registra compromisos y recordatorios"
        />
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
