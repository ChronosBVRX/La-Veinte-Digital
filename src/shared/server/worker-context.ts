"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveActivePayslip } from "./active-payslip"
import {
  buildWorkerContext,
  type PayslipLineRow,
  type WorkerContext,
} from "./worker-context-builder"

export type { WorkerContext } from "./worker-context-builder"

export async function getWorkerContext(): Promise<WorkerContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      profile: null,
      employment: null,
      payroll: null,
      vacations: null,
      vacationProfile: null,
    }
  }

  // 1. Obtener perfil para conocer la matrícula activa
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, matricula, categoria, antiguedad, adscripcion")
    .eq("id", user.id)
    .maybeSingle()

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

  let ctx = ctxRes.data
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
        console.warn(`[worker-context] WORKER_CONTEXT_IDENTITY_MISMATCH: latest payslip (${latestEmpNum}) !== profile (${activeMatricula})`)
      }
      latest = null
    }

    const ctxMatricula = (ctx?.matricula as string | undefined)?.trim() || null
    if (ctx && ctxMatricula && ctxMatricula !== activeMatricula) {
      if (process.env.NODE_ENV !== "production" || process.env.VITEST) {
        console.warn(`[worker-context] WORKER_CONTEXT_IDENTITY_MISMATCH: payroll_contexts (${ctxMatricula}) !== profile (${activeMatricula})`)
      }
      ctx = null
    }

    const vacEmpNum = (vacProfile?.employee_number as string | undefined)?.trim() || null
    if (vacProfile && vacEmpNum && vacEmpNum !== activeMatricula) {
      if (process.env.NODE_ENV !== "production" || process.env.VITEST) {
        console.warn(`[worker-context] WORKER_CONTEXT_IDENTITY_MISMATCH: vacation_profile_data (${vacEmpNum}) !== profile (${activeMatricula})`)
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
    if (!linesRes.error && Array.isArray(linesRes.data)) {
      payslipLines = linesRes.data as PayslipLineRow[]
    }
  }

  return buildWorkerContext({
    profileRow: profile,
    payrollContextRow: ctx,
    latestPayslipRow: latest,
    payslipLines,
    vacationProfileRow: vacProfile,
  })
}
