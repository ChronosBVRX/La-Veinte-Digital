import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WelcomeCard } from "@/shared/components/app/WelcomeCard"
import { OnboardingCard } from "@/shared/components/app/OnboardingCard"
import { HomeQuickActions } from "@/shared/components/app/HomeQuickActions"
import { DesktopQuickPills } from "@/shared/components/app/DesktopQuickPills"
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
        maxWidth: "1440px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <WelcomeCard
        fullName={profile?.full_name ?? null}
        greeting={greeting}
        dateLabel={dateLabel}
      />

      <div className="mobile-only">
        <OnboardingCard
          hasAntiguedad={!!profile?.antiguedad}
          hasTarjeton={hasTarjeton}
          hasCategoria={!!profile?.categoria}
        />
        <HomeQuickActions />
        <CalendarioLaboral />
        <div id="agenda" style={{ scrollMarginTop: "calc(var(--nav-height) + 1.5rem)" }}>
          <AgendaCardWrapper userId={user.id} />
        </div>
      </div>

      <div className="dashboard-desktop desktop-only">
        <div className="dashboard-main">
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
        </aside>
      </div>

      <style>{`
        .dashboard-desktop {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(1rem, 2vw, 1.5rem);
          align-items: start;
        }

        .dashboard-main {
          min-width: 0;
        }

        .dashboard-rail {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          min-width: 0;
        }

        @media (min-width: 1200px) {
          .dashboard-desktop {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
          }
        }
      `}</style>
    </div>
  )
}
