import { createClient } from "@/lib/supabase/server"
import { User, Shield } from "lucide-react"
import { ProfileForm } from "@/features/profile/components/ProfileForm"
import { getAllAdscripciones } from "@/features/catalogo/services/catalogo"
import prestamosRaw from "@/features/calculators/data/prestamos_categoria.json"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p>Debes iniciar sesión</p>

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const adscripciones = await getAllAdscripciones()
  const adscripcionOptions = adscripciones.map((a) => ({
    label: a.nombre,
    value: a.nombre,
  }))

  const raw = prestamosRaw as { CATEGORIA: string }[]
  const seen = new Set<string>()
  const categoriaOptions = raw
    .map((r) => r.CATEGORIA.trim())
    .filter((c) => {
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
    .map((c) => ({ label: c, value: c }))

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
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

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.5rem",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          marginBottom: "1.25rem", paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <Shield size={16} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Información personal</span>
        </div>
        <ProfileForm profile={profile} categoriaOptions={categoriaOptions} adscripcionOptions={adscripcionOptions} />
      </div>
    </div>
  )
}
