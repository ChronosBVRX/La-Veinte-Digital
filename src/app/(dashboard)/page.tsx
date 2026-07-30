import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, User, ArrowRight, Shield, Globe, BarChart3, Calendar } from "lucide-react"
import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"
import { CalendarioMensual } from "@/features/calendario/components/CalendarioMensual"
import { TodayCard } from "@/shared/components/layout/TodayCard"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{
        marginBottom: "2rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Bienvenido{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Panel principal &middot; La Veinte Digital
          </p>
        </div>
        <Link
          href="/profile"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.5rem 1rem", borderRadius: "var(--radius)",
            background: "var(--accent)", border: "1px solid var(--border)",
            textDecoration: "none", color: "var(--fg)", fontSize: "0.875rem",
            fontWeight: 500, transition: "all var(--transition)",
          }}
        >
          <User size={16} />
          Mi Perfil
          <ArrowRight size={14} />
        </Link>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <TodayCard profile={{
          id: profile?.id,
          adscripcion: profile?.adscripcion ?? null,
          categoria: profile?.categoria ?? null,
          antiguedad: profile?.antiguedad ?? null,
        }} />
      </div>

      <div className="dashboard-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "1rem", marginBottom: "1.5rem",
      }}>
        <CalendarioMensual />

        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
        }}>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--muted)" }}>
            <Shield size={14} style={{ marginRight: "0.375rem", verticalAlign: "middle", color: "var(--primary)" }} />
            Mi informaci&oacute;n
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.375rem 0.75rem", fontSize: "0.8125rem" }}>
            <span style={{ color: "var(--muted)" }}>Email:</span>
            <span>{user.email}</span>
            {profile?.matricula && (
              <><span style={{ color: "var(--muted)" }}>Matr&iacute;cula:</span><span>{profile.matricula}</span></>
            )}
            {profile?.adscripcion && (
              <><span style={{ color: "var(--muted)" }}>Adscripci&oacute;n:</span><span>{profile.adscripcion}</span></>
            )}
            {profile?.categoria && (
              <><span style={{ color: "var(--muted)" }}>Categor&iacute;a:</span><span>{profile.categoria}</span></>
            )}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <FileText size={14} style={{ color: "var(--primary)" }} />
              <Link href="/escritos" style={{ color: "var(--primary)", textDecoration: "none" }}>Ir a Generar Escritos</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <BarChart3 size={14} style={{ color: "var(--primary)" }} />
              <Link href="/nomina" style={{ color: "var(--primary)", textDecoration: "none" }}>Ir a Proyecci&oacute;n de N&oacute;mina</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <Calendar size={14} style={{ color: "var(--primary)" }} />
              <Link href="/calendario" style={{ color: "var(--primary)", textDecoration: "none" }}>Ver Calendario</Link>
            </div>
          </div>
        </div>

      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Globe size={18} style={{ color: "#1877F2" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Facebook SNTSS</h2>
          <Link href="/facebook" style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none" }}>
            Ver completo
          </Link>
        </div>
        <FacebookFeeds compact />
      </div>

      <style>{`
        @media (max-width: 640px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
