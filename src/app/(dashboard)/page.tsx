import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TodayCard } from "@/shared/components/layout/TodayCard"
import { WelcomeCard } from "@/shared/components/app/WelcomeCard"
import { OnboardingCard } from "@/shared/components/app/OnboardingCard"
import { HomeQuickActions } from "@/shared/components/app/HomeQuickActions"
import { UpNextChips } from "@/shared/components/app/UpNextChips"
import { DesktopQuickPills } from "@/shared/components/app/DesktopQuickPills"
import { NoticiasSection } from "@/shared/components/app/NoticiasSection"
import { DashboardSection } from "@/shared/components/app/DashboardSection"
import { CalendarioLaboral } from "@/shared/components/app/CalendarioLaboral"
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

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  )
  const greeting =
    hour >= 6 && hour < 12
      ? "Buenos días"
      : hour >= 12 && hour < 19
      ? "Buenas tardes"
      : "Buenas noches"

  return (
    <div
      className="dashboard-root"
      style={{
        maxWidth: "1240px",
        margin: "0 auto",
      }}
    >
      <WelcomeCard
        fullName={profile?.full_name ?? null}
        greeting={greeting}
        dateLabel={dateLabel}
      />

      {/* Móvil */}
      <div className="mobile-only">
        <OnboardingCard
          hasAntiguedad={!!profile?.antiguedad}
          hasTarjeton={hasTarjeton}
          hasCategoria={!!profile?.categoria}
        />
        <HomeQuickActions />
        <UpNextChips />
        <CalendarioLaboral />
        <div id="agenda" style={{ scrollMarginTop: "calc(var(--nav-height) + 1.5rem)" }}>
          <AgendaCardWrapper userId={user.id} />
        </div>
        <NoticiasSection />
      </div>

      {/* Escritorio: layout 2 columnas */}
      <div className="dashboard-desktop desktop-only">
        <div className="dashboard-main">
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
          <DesktopQuickPills />
          <CalendarioLaboral />
        </div>
        <aside className="dashboard-rail">
          <OnboardingCard
            hasAntiguedad={!!profile?.antiguedad}
            hasTarjeton={hasTarjeton}
            hasCategoria={!!profile?.categoria}
          />
          <div id="agenda" style={{ scrollMarginTop: "calc(var(--nav-height) + 1.5rem)" }}>
            <AgendaCardWrapper userId={user.id} />
          </div>
          <NoticiasSection />
        </aside>
      </div>

      <style>{`
        .dashboard-desktop {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 1.5rem;
          align-items: start;
        }
        .dashboard-main { min-width: 0; }
        .dashboard-rail {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          position: sticky;
          top: calc(var(--nav-height) + 1.5rem);
          max-height: calc(100dvh - var(--nav-height) - 3rem);
          overflow-y: auto;
          padding-right: 0.25rem;
        }
        @media (max-width: 1100px) {
          .dashboard-desktop {
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  )
}