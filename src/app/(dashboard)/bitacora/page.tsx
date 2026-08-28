import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Notebook } from "@phosphor-icons/react/dist/ssr"
import { AgendaManagerPanel } from "@/features/agenda-laboral/components/AgendaManagerPanel"

export default async function BitacoraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: commitments } = await supabase
    .from("worker_commitments")
    .select("*")
    .eq("user_id", user.id)
    .order("start_at", { ascending: false })

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #0891b2, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Notebook size={24} color="white" weight="duotone" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mi Agenda</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            Tu registro de compromisos laborales: tiempo extra, vacaciones, cambios de turno y más
          </p>
        </div>
      </div>
      <AgendaManagerPanel userId={user.id} initialCommitments={commitments ?? []} />
    </div>
  )
}
