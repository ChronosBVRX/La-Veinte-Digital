import { createClient } from "@/lib/supabase/server"
import { WorkerProfileService } from "@/shared/server/worker-profile"
import { WorkerProfileUnavailableError, WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"
import { isSafeInternalReturnPath } from "@/shared/domain/worker"
import { WorkerProfileCenter } from "@/features/profile/components/worker/WorkerProfileCenter"
import { TarjetonUploaderSection } from "@/features/profile/components/worker/TarjetonUploaderSection"
import { TarjetonHistorySection } from "@/features/tarjeton/components/TarjetonHistorySection"
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
    console.error("[worker-profile-page]", err instanceof Error ? err.message : err)
    const displayMessage = err instanceof WorkerProfileUnavailableError
      ? "El perfil laboral no está disponible en este momento. Inténtalo más tarde."
      : err instanceof WorkerProfileUnauthorizedError
        ? "Debes iniciar sesión para ver tu información laboral."
        : "No se pudo cargar tu información laboral. Inténtalo de nuevo."
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>Mi información laboral</h1>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "1rem", color: "#991b1b", fontSize: "0.9375rem" }}>
          {displayMessage}
        </div>
      </div>
    )
  }

  // Snapshot del perfil para detección de diferencias durante la importación.
  const profileRes = await supabase
    .from("profiles")
    .select("full_name, matricula, categoria, antiguedad")
    .eq("id", user.id)
    .single()
  const snapshot = {
    fullName: profileRes.data?.full_name ?? null,
    matricula: profileRes.data?.matricula ?? null,
    categoria: profileRes.data?.categoria ?? null,
    antiguedad: profileRes.data?.antiguedad ?? null,
  }

  // Historial de tarjetones confirmados (única fuente: imported_payslips).
  const payslipsRes = await supabase
    .from("imported_payslips")
    .select("id, period_raw, extraction_method, global_confidence, created_at, employee_data, payroll_totals")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const previousImports = (payslipsRes.data ?? []).map((p) => ({
    id: p.id,
    periodRaw: p.period_raw,
    extractionMethod: p.extraction_method,
    globalConfidence: p.global_confidence,
    createdAt: p.created_at,
    employeeName: (p.employee_data as Record<string, unknown> | undefined)?.fullName as string ?? null,
    totalNet: (p.payroll_totals as Record<string, number> | undefined)?.netPay ?? null,
  }))

  let latestConcepts: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }> = []
  const latestRow = payslipsRes.data?.[0]
  if (latestRow) {
    const { data: lines } = await supabase
      .from("imported_payslip_lines")
      .select("concept_code, description, amount, kind")
      .eq("payslip_id", latestRow.id)
      .order("line_index", { ascending: true })
      .limit(12)
    latestConcepts = (lines ?? []).map((l) => ({
      code: l.concept_code,
      description: l.description,
      amount: l.amount,
      kind: l.kind === "deduction" ? ("deduction" as const) : ("earning" as const),
    }))
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <WorkerProfileCenter
        state={state}
        mode={mode}
        profile={profile}
        quality={quality}
        requirements={requirements}
        events={events}
        returnTo={returnTo}
        profileSnapshot={snapshot}
      />

      {/* Sección unificada: aquí se sube el tarjetón y aquí se actualiza
          toda la información laboral (categoría, antigüedad, jornada,
          conceptos recurrentes). */}
      <section id="subir-tarjeton" style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
            Importar mi tarjetón IMSS
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
            Sube tu archivo PDF de tarjetón para mantener tu información laboral al día.
            Tus datos se sincronizan de manera segura en tu dispositivo (categoría, antigüedad, jornada y conceptos)
            para alimentar las calculadoras y el simulador de nómina.
          </p>
        </div>

        {previousImports.length > 0 && (
          <TarjetonHistorySection
            imports={previousImports}
            latestConcepts={latestConcepts}
          />
        )}

        <TarjetonUploaderSection profileSnapshot={snapshot} />
      </section>
    </div>
  )
}
