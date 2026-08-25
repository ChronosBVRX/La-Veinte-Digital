import { createClient } from "@/lib/supabase/server"
import { User, Shield } from "lucide-react"
import Link from "next/link"
import { ProfileForm } from "@/features/profile/components/ProfileForm"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p>Debes iniciar sesión</p>

  await supabase.rpc("ensure_profile_exists")

  const profileRes = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const profile = profileRes.data

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <User size={22} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {profile?.full_name ?? "Mi Perfil"}
          </h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* CTA unificado: datos laborales + tarjetones */}
      <Link href="/profile/mi-informacion-laboral" style={{
        display: "block", textDecoration: "none", marginBottom: "1.5rem",
        background: "linear-gradient(135deg, rgba(37,99,235,0.06), var(--card))",
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
      }}>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.125rem", color: "var(--fg)" }}>
          Datos laborales y tarjetones IMSS →
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Configura tu categoría, antigüedad y jornada. Sube tu tarjetón cuando quieras y tus datos se actualizan solos; ahí mismo queda tu historial de recibos.
        </div>
      </Link>

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        <div style={{ padding: "0 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 0", borderBottom: "2px solid var(--primary)",
              marginBottom: "-1px", cursor: "default",
            }}>
              <Shield size={16} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--primary)" }}>
                Información personal
              </span>
            </div>
            <Link href="/profile/mi-informacion-laboral" style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 0", cursor: "pointer", textDecoration: "none",
              fontSize: "0.9375rem", color: "var(--muted)",
            }}>
              Datos laborales
            </Link>
          </div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <ProfileForm profile={profile} />
        </div>
      </div>
    </div>
  )
}
