import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { WorkerProfileService } from "@/shared/server/worker-profile"
import { WorkerProfileUnavailableError, WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"
import { isSafeInternalReturnPath } from "@/shared/domain/worker"
import { PageContainer } from "@/shared/components/layout/PageContainer"
import { WorkerProfileCenter } from "@/features/profile/components/worker/WorkerProfileCenter"
import { TarjetonUploaderSection } from "@/features/profile/components/worker/TarjetonUploaderSection"
import { TarjetonHistorySection, type PreviousImport } from "@/features/tarjeton/components/TarjetonHistorySection"
import { resolveActivePayslip } from "@/shared/server/active-payslip"
import type { WorkerProfile, ProfileQuality, FieldRequirement, WorkerDataEvent, WorkerProfileMode } from "@/shared/domain/worker"

interface PageProps {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function WorkerProfilePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <p style={{ padding: "2rem" }}>Debes iniciar sesión.</p>

  // Validar y sanitizar returnTo en servidor.
  const resolvedSearchParams = await searchParams
  const rawReturnTo = resolvedSearchParams?.returnTo
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
    if (err instanceof WorkerProfileUnavailableError) {
      // Estado de transición o sin perfil aún: degradar a unconfigured para
      // permitir acceso al historial de tarjetones y al importador
      console.warn("[worker-profile-page] Perfil no configurado o en transición:", err.message)
      state = "unconfigured"
    } else {
      console.error("[worker-profile-page]", err instanceof Error ? err.message : err)
      const displayMessage = err instanceof WorkerProfileUnauthorizedError
        ? "Debes iniciar sesión para ver tu información laboral."
        : "No se pudo cargar tu información laboral. Inténtalo de nuevo."
      return (
        <PageContainer maxWidth={600} padding="1.5rem 0">
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem", wordBreak: "break-word" }}>Mi información laboral</h1>
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "1rem", color: "#991b1b", fontSize: "0.9375rem", wordBreak: "break-word" }}>
            {displayMessage}
          </div>
        </PageContainer>
      )
    }
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

  // Resolver tarjetón activo canónico
  const resolved = await resolveActivePayslip(supabase, user.id, {
    activeMatricula: snapshot.matricula,
  })

  // Consultar historial de tarjetones para este usuario
  const payslipsRes = await supabase
    .from("imported_payslips")
    .select("id, period_raw, extraction_method, global_confidence, created_at, employee_data, payroll_totals")
    .eq("user_id", user.id)
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("period_half", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20)

  const previousImports: PreviousImport[] = (payslipsRes.data ?? []).map((p) => {
    const empData = (p.employee_data ?? {}) as Record<string, unknown>
    const totals = (p.payroll_totals ?? {}) as Record<string, unknown>
    return {
      id: p.id,
      periodRaw: p.period_raw,
      extractionMethod: p.extraction_method,
      globalConfidence: typeof p.global_confidence === "number" ? p.global_confidence : 1,
      createdAt: p.created_at,
      employeeName: (empData.fullName as string) || (empData.name as string) || null,
      totalNet: typeof totals.netPay === "number" ? totals.netPay : null,
    }
  })

  // Obtener conceptos del tarjetón activo
  let latestConcepts: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }> = []
  if (resolved.activePayslipId) {
    const { data: lines } = await supabase
      .from("imported_payslip_lines")
      .select("concept_code, description, amount, kind")
      .eq("payslip_id", resolved.activePayslipId)
      .order("line_index", { ascending: true })
      .limit(20)

    latestConcepts = (lines ?? []).map((l) => ({
      code: l.concept_code,
      description: l.description,
      amount: l.amount,
      kind: l.kind === "deduction" ? ("deduction" as const) : ("earning" as const),
    }))
  }

  return (
    <PageContainer maxWidth={700} style={{ display: "flex", flexDirection: "column", gap: "1.75rem", padding: "0.5rem 0" }}>
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

      {/* Historial de tarjetones con control de tarjetón activo */}
      {previousImports.length > 0 && (
        <section id="historial-tarjetones" style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem", wordBreak: "break-word" }}>
              Mis tarjetones importados
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.55, wordBreak: "break-word" }}>
              Selecciona cuál tarjetón alimenta tus calculadoras, vacaciones y herramientas.
            </p>
          </div>

          <TarjetonHistorySection
            imports={previousImports}
            activePayslipId={resolved.activePayslipId}
            latestPayslipId={resolved.latestPayslipId}
            selectionMode={resolved.selectionMode}
            latestConcepts={latestConcepts}
            uploadHref="#subir-tarjeton"
          />
        </section>
      )}

      {/* Sección unificada: aquí se sube el tarjetón y aquí se actualiza
          toda la información laboral (categoría, antigüedad, jornada,
          conceptos recurrentes). */}
      <section id="subir-tarjeton" style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem", wordBreak: "break-word" }}>
            Importar nuevo tarjetón IMSS
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.55, wordBreak: "break-word" }}>
            Sube tu archivo PDF de tarjetón para mantener tu información laboral al día.
            Tus datos se sincronizan de manera segura en tu dispositivo (categoría, antigüedad, jornada y conceptos)
            para alimentar las calculadoras de la app.
          </p>
        </div>

        <TarjetonUploaderSection profileSnapshot={snapshot} />

        <Link
          href="/documentos-personales"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            fontSize: "var(--text-sm)", fontWeight: 600,
            color: "var(--primary)", textDecoration: "none",
            width: "fit-content", maxWidth: "100%",
          }}
        >
          Ver mis documentos personales →
        </Link>
      </section>
    </PageContainer>
  )
}
