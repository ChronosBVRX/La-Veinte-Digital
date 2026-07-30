import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"
import { BitacoraPanel } from "@/features/bitacora/components/BitacoraPanel"

export default async function BitacoraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: bitacoraEntries } = await supabase
    .from("bitacora_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #0891b2, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ClipboardList size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Bitácora</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            Registro de incidencias laborales
          </p>
        </div>
      </div>
      <BitacoraPanel userId={user.id} initialEntries={bitacoraEntries ?? []} />
    </div>
  )
}
