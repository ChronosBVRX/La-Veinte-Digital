import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"
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
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #0891b2, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ClipboardList size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mi agenda</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            Tu registro laboral unificado: tiempo extra, vacaciones, TXT y más
          </p>
        </div>
      </div>
      <AgendaManagerPanel userId={user.id} initialCommitments={commitments ?? []} />
    </div>
  )
}
