import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Notebook } from "@phosphor-icons/react/dist/ssr"
import { AgendaManagerPanel } from "@/features/agenda-laboral/components/AgendaManagerPanel"

interface BitacoraPageProps {
  searchParams?: Promise<{ date?: string; commitment?: string }>
}

export default async function BitacoraPage(props: BitacoraPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const searchParams = props.searchParams ? await props.searchParams : undefined
  const targetDate = searchParams?.date
  const targetCommitmentId = searchParams?.commitment

  const { data: commitments } = await supabase
    .from("worker_commitments")
    .select("*")
    .eq("user_id", user.id)
    .order("start_at", { ascending: false })

  return (
    <div style={{ width: "100%", maxWidth: "700px", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", minWidth: 0, width: "100%" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #0891b2, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Notebook size={24} color="white" weight="duotone" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>Mi Agenda</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.125rem 0 0", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            Tiempo extra, deporte, faltas injustificadas y reclamaciones pendientes en un solo lugar
          </p>
        </div>
      </div>
      <AgendaManagerPanel
        userId={user.id}
        initialCommitments={commitments ?? []}
        targetDate={targetDate}
        targetCommitmentId={targetCommitmentId}
      />
    </div>
  )
}
