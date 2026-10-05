import { createClient } from "@/lib/supabase/server"
import { AppSettingsContent } from "@/features/profile/components/AppSettingsContent"

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p style={{ padding: "2rem" }}>Debes iniciar sesión.</p>

  return <AppSettingsContent />
}
