import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"

export default async function TarjetonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, matricula, categoria, antiguedad")
    .eq("id", user.id)
    .single()

  const snapshot = {
    fullName: profile?.full_name ?? null,
    matricula: profile?.matricula ?? null,
    categoria: profile?.categoria ?? null,
    antiguedad: profile?.antiguedad ?? null,
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <TarjetonImporterWrapper profile={snapshot} />
    </div>
  )
}
