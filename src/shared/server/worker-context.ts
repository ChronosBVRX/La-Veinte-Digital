import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { resolveActivePayslip } from "./active-payslip"
import {
  buildWorkerContext,
  type PayslipLineRow,
  type WorkerContext,
} from "./worker-context-builder"

export type { WorkerContext } from "./worker-context-builder"

export class WorkerContextQueryError extends Error {
  readonly code: string
  readonly requestId?: string
  constructor(message: string, code = "worker_context_query_failed", requestId?: string) {
    super(message)
    this.name = "WorkerContextQueryError"
    this.code = code
    this.requestId = requestId
  }
}

export async function getWorkerContext(
  existingUser?: User | null,
  existingSupabase?: SupabaseClient<Database> | null,
  requestId?: string,
): Promise<WorkerContext> {
  const supabase = existingSupabase ?? (await createClient())
  let user = existingUser ?? null
  if (!user) {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    user = authUser
  }

  if (!user) {
    return {
      userId: null,
      meta: null,
      profile: null,
      employment: null,
      payroll: null,
      vacations: null,
      vacationProfile: null,
    }
  }

  const reqId = requestId || "req"

  // 1. Obtener perfil para conocer la matrícula activa
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, matricula, categoria, antiguedad, adscripcion")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError && profileError.code !== "PGRST116") {
    console.error(`[worker-context][${reqId}] Error en profiles (código):`, profileError.code || "unknown")
    throw new WorkerContextQueryError("Error al consultar perfil del trabajador", "profile_query_failed", reqId)
  }

  const activeMatricula = profile?.matricula?.trim() || null

  // 2. Resolver el tarjetón activo mediante el resolver canónico
  const [ctxRes, activePayslipResult, vacProfileRes] = await Promise.all([
    supabase
      .from("payroll_contexts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    resolveActivePayslip(supabase, user.id, { activeMatricula }),
    supabase
      .from("vacation_profile_data")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (activePayslipResult.error) {
    console.error(`[worker-context][${reqId}] Error en activePayslip (código):`, activePayslipResult.error.code || "unknown")
    throw new WorkerContextQueryError("Error al resolver tarjetón activo", "active_payslip_query_failed", reqId)
  }

  if (ctxRes.error && ctxRes.error.code !== "PGRST116") {
    console.warn(`[worker-context][${reqId}] Advertencia en payroll_contexts (código):`, ctxRes.error.code || "unknown")
  }

  if (vacProfileRes.error && vacProfileRes.error.code !== "PGRST116") {
    console.warn(`[worker-context][${reqId}] Advertencia en vacation_profile_data (código):`, vacProfileRes.error.code || "unknown")
  }

  let ctx = ctxRes.data ?? null
  let latest = activePayslipResult.payslip
  let vacProfile = vacProfileRes.data ?? null

  // 3. Invariante de identidad laboral: si alguna fuente tiene matrícula distinta a la activa,
  // NO se mezcla silenciosamente: se aísla y se advierte.
  if (activeMatricula) {
    const latestEmpNum = (latest?.employee_number?.trim() ||
      (typeof latest?.employee_data === "object" && latest?.employee_data !== null && "employeeNumber" in latest.employee_data
        ? String((latest.employee_data as Record<string, unknown>).employeeNumber ?? "").trim()
        : null))

    if (latest && latestEmpNum && latestEmpNum !== activeMatricula) {
      if (process.env.NODE_ENV !== "production" || process.env.VITEST) {
        console.warn(`[worker-context][${reqId}] WORKER_CONTEXT_IDENTITY_MISMATCH: latest_payslip_mismatch`)
      }
      latest = null
    }

    const ctxMatricula = (ctx?.matricula as string | undefined)?.trim() || null
    if (ctx && ctxMatricula && ctxMatricula !== activeMatricula) {
      if (process.env.NODE_ENV !== "production" || process.env.VITEST) {
        console.warn(`[worker-context][${reqId}] WORKER_CONTEXT_IDENTITY_MISMATCH: payroll_contexts_mismatch`)
      }
      ctx = null
    }

    const vacEmpNum = (vacProfile?.employee_number as string | undefined)?.trim() || null
    if (vacProfile && vacEmpNum && vacEmpNum !== activeMatricula) {
      if (process.env.NODE_ENV !== "production" || process.env.VITEST) {
        console.warn(`[worker-context][${reqId}] WORKER_CONTEXT_IDENTITY_MISMATCH: vacation_profile_data_mismatch`)
      }
      vacProfile = null
    }
  }

  // Líneas completas del tarjetón más reciente (verdad de terreno).
  let payslipLines: PayslipLineRow[] = []
  if (latest?.id) {
    const linesRes = await supabase
      .from("imported_payslip_lines")
      .select("concept_code, description, amount, kind, confirmed_by_user")
      .eq("payslip_id", latest.id)
      .order("line_index")
    if (linesRes.error) {
      console.error(`[worker-context][${reqId}] Error en imported_payslip_lines (código):`, linesRes.error.code || "unknown")
      throw new WorkerContextQueryError("Error al consultar líneas del tarjetón", "payslip_lines_query_failed", reqId)
    }
    if (Array.isArray(linesRes.data)) {
      payslipLines = linesRes.data as PayslipLineRow[]
    }
  }

  return buildWorkerContext({
    userId: user.id,
    meta: {
      userId: user.id,
      activePayslipId: activePayslipResult.activePayslipId,
      activePayslipPeriod: latest?.period_raw ?? activePayslipResult.latestPeriodRaw ?? null,
      activeEmployeeNumber: activeMatricula || activePayslipResult.activeMatricula,
      selectionMode: activePayslipResult.selectionMode,
      contextRevision: activePayslipResult.contextRevision,
    },
    profileRow: profile,
    payrollContextRow: ctx,
    latestPayslipRow: latest,
    payslipLines,
    vacationProfileRow: vacProfile,
  })
}
