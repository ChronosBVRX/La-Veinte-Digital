import { createClient } from "@/lib/supabase/server"
import { isSafeInternalReturnPath } from "@/shared/domain/worker"
import { PageContainer } from "@/shared/components/layout/PageContainer"
import { UnifiedProfileView } from "@/features/profile/components/UnifiedProfileView"
import { type PreviousImport } from "@/features/tarjeton/components/TarjetonHistorySection"
import { resolveActivePayslip } from "@/shared/server/active-payslip"

interface PageProps {
  searchParams?: Promise<{ returnTo?: string; onboarding?: string }>
}

export default async function WorkerProfilePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <p style={{ padding: "2rem" }}>Debes iniciar sesión.</p>

  const { error: ensureProfileError } = await supabase.rpc("ensure_profile_exists")
  if (ensureProfileError) {
    console.error("[worker-profile-page] ensure_profile_exists:", ensureProfileError.code)
    return (
      <PageContainer maxWidth={600} padding="1.5rem 0">
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem", wordBreak: "break-word" }}>Mi Perfil</h1>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "1rem", color: "#991b1b", fontSize: "0.9375rem", wordBreak: "break-word" }}>
          No se pudo preparar tu perfil para cargar tu información laboral. Recarga la página e inténtalo de nuevo.
        </div>
      </PageContainer>
    )
  }

  // Validar y sanitizar returnTo en servidor.
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const rawReturnTo = resolvedSearchParams?.returnTo
  const returnTo = typeof rawReturnTo === "string" && isSafeInternalReturnPath(rawReturnTo)
    ? rawReturnTo
    : undefined
  const isInitialOnboarding = resolvedSearchParams?.onboarding === "true"

  const [profileRes, payrollRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, matricula, adscripcion, categoria, antiguedad, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("payroll_contexts")
      .select("category_name, matricula, adscripcion, effective_seniority_date, workday_hours")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const profileData = profileRes.data
  const payrollData = payrollRes.data

  const snapshot = {
    fullName: profileData?.full_name ?? null,
    matricula: profileData?.matricula || payrollData?.matricula || null,
    adscripcion: profileData?.adscripcion || payrollData?.adscripcion || null,
    categoria: profileData?.categoria || payrollData?.category_name || null,
    antiguedad: profileData?.antiguedad || (payrollData?.effective_seniority_date ? String(payrollData.effective_seniority_date) : null),
  }

  // Resolver tarjetón activo canónico
  const resolved = await resolveActivePayslip(supabase, user.id, {
    activeMatricula: snapshot.matricula,
  })

  if (resolved.error) {
    console.error("[worker-profile-page] Error al resolver tarjetón activo (código):", resolved.error.code || "unknown")
  }

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

  if (payslipsRes.error) {
    console.error("[worker-profile-page] Error al consultar imported_payslips (código):", payslipsRes.error.code || "unknown")
  }
  const payslipsQueryError = Boolean(payslipsRes.error) || Boolean(resolved.error)

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

  const activePayslipRow =
    (payslipsRes.data ?? []).find((p) => p.id === resolved.activePayslipId) ??
    (payslipsRes.data ?? [])[0] ??
    null
  const activeEmpData = ((activePayslipRow?.employee_data ?? {}) as Record<string, unknown>)
  const activeEmployeeName =
    (activeEmpData.fullName as string) || (activeEmpData.name as string) || null

  // Obtener conceptos del tarjetón activo solo si no hubo error
  let latestConcepts: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }> = []
  if (resolved.activePayslipId && !resolved.error) {
    const { data: lines, error: linesError } = await supabase
      .from("imported_payslip_lines")
      .select("concept_code, description, amount, kind")
      .eq("payslip_id", resolved.activePayslipId)
      .order("line_index", { ascending: true })
      .limit(20)

    if (linesError) {
      console.error("[worker-profile-page] Error al consultar líneas del tarjetón activo (código):", linesError.code || "unknown")
    } else {
      latestConcepts = (lines ?? []).map((l) => ({
        code: l.concept_code,
        description: l.description,
        amount: l.amount,
        kind: l.kind === "deduction" ? ("deduction" as const) : ("earning" as const),
      }))
    }
  }

  return (
    <UnifiedProfileView
      userId={user.id}
      email={user.email ?? null}
      fullName={snapshot.fullName || activeEmployeeName}
      avatarUrl={profileData?.avatar_url ?? null}
      matricula={snapshot.matricula}
      categoria={snapshot.categoria}
      antiguedad={snapshot.antiguedad}
      adscripcion={snapshot.adscripcion}
      workdayHours={payrollData?.workday_hours ?? null}
      activePeriodRaw={activePayslipRow?.period_raw ?? null}
      snapshot={snapshot}
      previousImports={previousImports}
      activePayslipId={resolved.activePayslipId}
      latestPayslipId={resolved.latestPayslipId}
      selectionMode={resolved.selectionMode}
      latestConcepts={latestConcepts}
      payslipsQueryError={payslipsQueryError}
      returnTo={returnTo}
      isInitialOnboarding={isInitialOnboarding}
    />
  )
}
