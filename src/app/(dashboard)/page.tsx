import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Globe, ArrowRight } from "lucide-react"
import Link from "next/link"
import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"
import { TodayCard } from "@/shared/components/layout/TodayCard"
import { DashboardHero } from "@/shared/components/app/DashboardHero"
import { DashboardPendientes } from "@/shared/components/app/DashboardPendientes"
import { DashboardSection } from "@/shared/components/app/DashboardSection"
import { CompactCalendar } from "@/shared/components/app/CompactCalendar"
import { AgendaCardWrapper } from "@/shared/components/app/AgendaCardWrapper"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { count: tarjetonesCount } = await supabase
    .from("imported_payslips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const hasTarjeton = (tarjetonesCount ?? 0) > 0

  const now = new Date()

  const dateLabel = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  const hour = now.getHours()
  const greeting =
    hour >= 6 && hour < 12
      ? "Buenos días"
      : hour >= 12 && hour < 19
      ? "Buenas tardes"
      : "Buenas noches"

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <DashboardHero
        fullName={profile?.full_name ?? null}
        greeting={greeting}
        dateLabel={dateLabel}
      />

      <DashboardPendientes
        hasAntiguedad={!!profile?.antiguedad}
        hasTarjeton={hasTarjeton}
        hasCategoria={!!profile?.categoria}
      />

      <DashboardSection title="">
        <TodayCard
          profile={{
            id: profile?.id,
            adscripcion: profile?.adscripcion ?? null,
            categoria: profile?.categoria ?? null,
            antiguedad: profile?.antiguedad ?? null,
          }}
        />
      </DashboardSection>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}>
          <span style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Acciones frecuentes
          </span>
          <Link
            href="/herramientas"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--primary)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Ver todas las herramientas
            <ArrowRight size={12} />
          </Link>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/tarjeton" style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.625rem 0.875rem", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600,
            textDecoration: "none", color: "var(--fg)", transition: "box-shadow var(--transition)",
          }} className="hover-lift">
            Mi tarjetón <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          </Link>
          <Link href="/bitacora" style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.625rem 0.875rem", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600,
            textDecoration: "none", color: "var(--fg)", transition: "box-shadow var(--transition)",
          }} className="hover-lift">
            Registrar incidencia <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          </Link>
          <Link href="/asistente" style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.625rem 0.875rem", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600,
            textDecoration: "none", color: "var(--fg)", transition: "box-shadow var(--transition)",
          }} className="hover-lift">
            Preguntar al asistente <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          </Link>
        </div>
      </div>

      <CompactCalendar />

      <AgendaCardWrapper userId={user.id} />

      <DashboardSection title="">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Globe size={16} style={{ color: "#1877F2" }} />
            <span style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              Noticias de la Secci&oacute;n XX
            </span>
          </div>
          <Link
            href="/facebook"
            style={{
              fontSize: "0.75rem",
              color: "var(--primary)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Ver feed completo
            <ArrowRight size={12} />
          </Link>
        </div>
        <FacebookFeeds compact />
      </DashboardSection>
    </div>
  )
}
