import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"

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

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Bienvenido{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Panel principal de La Veinte Digital
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <SummaryCard title="Publicaciones" value={postCount ?? 0} href="/foro" />
        <SummaryCard title="Mensajes" value={messageCount ?? 0} href="/chat" />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Información del perfil</h2>
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
    </div>
  )
}

function SummaryCard({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.25rem" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{title}</p>
        <p style={{ fontSize: "2rem", fontWeight: 700 }}>{value}</p>
      </div>
    </Link>
  )
}
