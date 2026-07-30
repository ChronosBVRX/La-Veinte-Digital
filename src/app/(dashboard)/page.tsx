import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Bot, FileText, User, ArrowRight, Shield, Globe, BarChart3, Calendar } from "lucide-react"
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

  const { data: recentPosts } = await supabase
    .from("forum_posts")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(3)

  const quickActions = [
    { href: "/asistente", label: "Asistente SNTSS", desc: "Resuelve dudas laborales", icon: Bot, gradient: "linear-gradient(135deg, #2563eb, #6366f1)" },
    { href: "/escritos", label: "Generar Escritos", desc: "Documentos oficiales PDF", icon: FileText, gradient: "linear-gradient(135deg, #059669, #10b981)" },
    { href: "/foro", label: "Foro de Discusión", desc: "Participa en la comunidad", icon: ArrowRight, gradient: "linear-gradient(135deg, #d97706, #f59e0b)" },
    { href: "/nomina", label: "Proyección de Nómina", desc: "Estima tu próximo pago", icon: BarChart3, gradient: "linear-gradient(135deg, #7c3aed, #a855f7)" },
  ]

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
          adscripcion: profile?.adscripcion ?? null,
          categoria: profile?.categoria ?? null,
          antiguedad: profile?.antiguedad ?? null,
        }} />
      </div>

      <div className="dashboard-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "1rem", marginBottom: "1.5rem",
      }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
        }}>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--muted)" }}>
            Accesos directos
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "0.625rem",
          }}>
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="hover-lift"
                  style={{
                    textDecoration: "none", color: "inherit",
                    padding: "0.875rem", borderRadius: "var(--radius)",
                    display: "flex", flexDirection: "column", gap: "0.5rem",
                    background: "var(--accent)",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "0.625rem",
                    background: action.gradient, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={17} color="white" />
                  </div>
                  <div>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                      {action.label}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

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

        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, color: "var(--muted)" }}>
              <ArrowRight size={14} style={{ marginRight: "0.375rem", verticalAlign: "middle", color: "var(--primary)" }} />
              &Uacute;ltimas publicaciones
            </h2>
            <Link href="/foro" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "none" }}>
              Ver todas
            </Link>
          </div>
          {recentPosts && recentPosts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/foro/${post.id}`}
                  style={{
                    display: "block", textDecoration: "none", color: "inherit",
                    padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)",
                    background: "var(--accent)", transition: "background var(--transition)",
                  }}
                >
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500, margin: 0 }}>{post.title}</p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString("es-MX", { month: "short", day: "numeric" }) : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              No hay publicaciones a&uacute;n. <Link href="/foro/nuevo" style={{ color: "var(--primary)" }}>¡Crea la primera!</Link>
            </p>
          )}
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
