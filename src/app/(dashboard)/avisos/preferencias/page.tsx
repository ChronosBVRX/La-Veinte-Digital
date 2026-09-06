import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getWorkerNotificationPreferences } from "@/features/announcements/services/announcements-inbox"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Button } from "@/shared/components/ui/Button"
import { PreferencesForm } from "@/features/announcements/components/PreferencesForm"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"

export default async function AvisosPreferenciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { announcements_push_enabled } = await getWorkerNotificationPreferences(user.id)

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Link href="/avisos" style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver a avisos
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="Configuración"
        title="Preferencias de notificaciones"
        description="Controla cómo y cuándo deseas recibir comunicados oficiales en tu dispositivo."
      />

      <PreferencesForm initialEnabled={announcements_push_enabled} />
    </div>
  )
}
