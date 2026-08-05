import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Shield, Globe, ArrowRight } from "lucide-react"
import Link from "next/link"
import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"
import { CalendarioMensual } from "@/features/calendario/components/CalendarioMensual"
import { TodayCard } from "@/shared/components/layout/TodayCard"
import { DashboardHero } from "@/shared/components/app/DashboardHero"
import { DashboardStatsGrid } from "@/shared/components/app/DashboardStatsGrid"
import { QuickActionsGrid } from "@/shared/components/app/QuickActionsGrid"
import { DashboardSection } from "@/shared/components/app/DashboardSection"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

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

      <DashboardStatsGrid
        profile={{ antiguedad: profile?.antiguedad ?? null }}
      />

      <QuickActionsGrid />

      <DashboardSection title="Mi d&iacute;a laboral">
        <TodayCard
          profile={{
            id: profile?.id,
            adscripcion: profile?.adscripcion ?? null,
            categoria: profile?.categoria ?? null,
            antiguedad: profile?.antiguedad ?? null,
          }}
        />
      </DashboardSection>

      <DashboardSection title="Calendario y datos">
        <div
          className="dashboard-content-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <CalendarioMensual />

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
            }}
          >
            <h3
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                margin: "0 0 0.75rem",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <Shield size={14} style={{ color: "var(--primary)" }} />
              Mi informaci&oacute;n
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.375rem 0.75rem",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Email:</span>
              <span>{user.email}</span>
              {profile?.matricula && (
                <>
                  <span style={{ color: "var(--muted)" }}>Matr&iacute;cula:</span>
                  <span>{profile.matricula}</span>
                </>
              )}
              {profile?.adscripcion && (
                <>
                  <span style={{ color: "var(--muted)" }}>Adscripci&oacute;n:</span>
                  <span>{profile.adscripcion}</span>
                </>
              )}
              {profile?.categoria && (
                <>
                  <span style={{ color: "var(--muted)" }}>Categor&iacute;a:</span>
                  <span>{profile.categoria}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Globe size={16} style={{ color: "#1877F2" }} />
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
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

      <style>{`
        @media (max-width: 640px) {
          .dashboard-content-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
