import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/features/profile/components/ProfileForm"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p>Debes iniciar sesión</p>

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div style={{ maxWidth: "600px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Mi Perfil</h1>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.5rem" }}>
        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}
