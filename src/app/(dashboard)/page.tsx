import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Bot, FileText, Newspaper, MessageCircle, User, ArrowRight, Shield, Globe } from "lucide-react"
import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { count: postCount } = await supabase
    .from("forum_posts")
    .select("*", { count: "exact", head: true })

  const { count: messageCount } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })

  const { data: recentPosts } = await supabase
    .from("forum_posts")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(3)

  const quickActions = [
    { href: "/asistente", label: "Asistente SNTSS", desc: "Resuelve dudas laborales", icon: Bot, gradient: "linear-gradient(135deg, #2563eb, #6366f1)" },
    { href: "/escritos", label: "Generar Escritos", desc: "Documentos oficiales PSD", icon: FileText, gradient: "linear-gradient(135deg, #059669, #10b981)" },
    { href: "/foro", label: "Foro de Discusión", desc: "Participa en la comunidad", icon: Newspaper, gradient: "linear-gradient(135deg, #d97706, #f59e0b)" },
    { href: "/chat", label: "Chat en Vivo", desc: "Conversa con compañeros", icon: MessageCircle, gradient: "linear-gradient(135deg, #7c3aed, #a855f7)" },
  ]

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Saludo */}
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

      {/* Quick Actions */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "0.75rem", marginBottom: "2rem",
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
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "1.25rem",
                display: "flex", flexDirection: "column", gap: "0.75rem",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "0.75rem",
                background: action.gradient, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={20} color="white" />
              </div>
              <div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                  {action.label}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                  {action.desc}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "1rem", marginBottom: "2rem",
      }}>
        <StatCard icon={Newspaper} label="Publicaciones en el foro" value={postCount ?? 0} href="/foro" />
        <StatCard icon={MessageCircle} label="Mensajes en chat" value={messageCount ?? 0} href="/chat" />
        <StatCard icon={Bot} label="Consultas al asistente" value={0} href="/asistente" />
      </div>

      {/* Profile Card + Recent Posts */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
      }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1.25rem",
        }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={16} style={{ color: "var(--primary)" }} />
            Información del perfil
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--muted)" }}>Email:</span>
            <span>{user.email}</span>
            {profile?.matricula && (
              <><span style={{ color: "var(--muted)" }}>Matrícula:</span><span>{profile.matricula}</span></>
            )}
            {profile?.adscripcion && (
              <><span style={{ color: "var(--muted)" }}>Adscripción:</span><span>{profile.adscripcion}</span></>
            )}
            {profile?.categoria && (
              <><span style={{ color: "var(--muted)" }}>Categoría:</span><span>{profile.categoria}</span></>
            )}
          </div>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Newspaper size={16} style={{ color: "var(--primary)" }} />
              Últimas publicaciones
            </h2>
            <Link href="/foro" style={{ fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none" }}>
              Ver todas
            </Link>
          </div>
          {recentPosts && recentPosts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
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
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, margin: 0 }}>{post.title}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString("es-MX", { month: "short", day: "numeric" }) : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
              No hay publicaciones aún. <Link href="/foro/nuevo" style={{ color: "var(--primary)" }}>¡Crea la primera!</Link>
            </p>
          )}
        </div>
      </div>

      {/* Facebook */}
      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Globe size={18} style={{ color: "#1877F2" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Facebook SNTSS</h2>
          <Link href="/facebook" style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none" }}>
            Ver completo
          </Link>
        </div>
        <FacebookFeeds compact />
      </div>

      {/* Mobile: full width on small screens */}
      <style>{`
        @media (max-width: 640px) {
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, href }: { icon: typeof Bot; label: string; value: number; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="hover-lift" style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "0.5rem",
          background: "var(--accent)", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={18} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{value}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>{label}</p>
        </div>
      </div>
    </Link>
  )
}
