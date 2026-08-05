import { createClient } from "@/lib/supabase/server"
import { WorkerProfileService } from "@/shared/server/worker-profile"
import { isSafeInternalReturnPath } from "@/shared/domain/worker"
import { WorkerProfileCenter } from "@/features/profile/components/worker/WorkerProfileCenter"
import type { WorkerProfile, ProfileQuality, FieldRequirement, WorkerDataEvent, WorkerProfileMode } from "@/shared/domain/worker"

interface PageProps {
  searchParams: { returnTo?: string }
}

export default async function WorkerProfilePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <p style={{ padding: "2rem" }}>Debes iniciar sesión.</p>

  // Validar y sanitizar returnTo en servidor.
  const rawReturnTo = searchParams.returnTo
  const returnTo = typeof rawReturnTo === "string" && isSafeInternalReturnPath(rawReturnTo)
    ? rawReturnTo
    : undefined

  let state: "unconfigured" | "basic" | "configured" = "unconfigured"
  let mode: WorkerProfileMode | null = null
  let profile: WorkerProfile | null = null
  let quality: ProfileQuality | null = null
  let requirements: readonly FieldRequirement[] = []
  let events: WorkerDataEvent[] = []

  try {
    const svc = new WorkerProfileService()
    const current = await svc.getCurrentProfile()

    if (current.state === "unconfigured" || current.state === "basic") {
      state = current.state
    } else {
      state = "configured"
      mode = current.mode
      profile = current.profile
    }

    if (state === "configured" && profile) {
      quality = await svc.getProfileQuality()
      requirements = svc.getFieldRequirements()
      events = await svc.listWorkerEvents(20)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>Mi información laboral</h1>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "1rem", color: "#991b1b", fontSize: "0.9375rem" }}>
          {message.includes("disponible") || message.includes("UnavailableError")
            ? "El perfil laboral no está disponible en este momento. Inténtalo más tarde."
            : "No se pudo cargar tu información laboral. Inténtalo de nuevo."}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      <WorkerProfileCenter
        state={state}
        mode={mode}
        profile={profile}
        quality={quality}
        requirements={requirements}
        events={events}
        returnTo={returnTo}
      />
    </div>
  )
}
