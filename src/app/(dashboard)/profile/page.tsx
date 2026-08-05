import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/features/profile/components/ProfileForm"
import { ProfileSummaryCard } from "@/features/profile/components/ProfileSummaryCard"
import { BitacoraPanel } from "@/features/bitacora/components/BitacoraPanel"
import { SectionCard } from "@/shared/components/ui/SectionCard"
import { PageHeader } from "@/shared/components/app/PageHeader"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p>Debes iniciar sesión</p>

  await supabase.rpc("ensure_profile_exists")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: bitacoraEntries } = await supabase
    .from("bitacora_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Perfil laboral"
        description="Tus datos se utilizan para personalizar nómina, calculadoras y escritos."
      />

      <ProfileSummaryCard
        fullName={profile?.full_name ?? null}
        phone={profile?.phone ?? null}
        email={user.email ?? null}
        hasMatricula={!!profile?.matricula}
        hasCategoria={!!profile?.categoria}
        hasAdscripcion={!!profile?.adscripcion}
        hasAntiguedad={!!profile?.antiguedad}
      />

      <SectionCard title="Información personal" description="Estos datos se muestran solo a ti.">
        <ProfileForm profile={profile} />
      </SectionCard>

      <div style={{ marginTop: "var(--space-6)" }}>
        <SectionCard title="Bitácora personal" description="Registro de tus incidencias y actividad.">
          <BitacoraPanel userId={user.id} initialEntries={bitacoraEntries ?? []} />
        </SectionCard>
      </div>
    </div>
  )
}
