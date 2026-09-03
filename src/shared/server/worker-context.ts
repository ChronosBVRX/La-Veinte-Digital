"use server"

import { createClient } from "@/lib/supabase/server"
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

  const [profileRes, ctxRes, payslipRes, vacProfileRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, matricula, categoria, antiguedad, adscripcion")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("payroll_contexts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("imported_payslips")
      .select("id, period_raw, payroll_totals, employee_data, vacations")
      .eq("user_id", user.id)
      .order("period_year", { ascending: false, nullsFirst: false })
      .order("period_month", { ascending: false, nullsFirst: false })
      .order("period_half", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("vacation_profile_data")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const profile = profileRes.data
  const ctx = ctxRes.data
  const latest = payslipRes.data?.[0] ?? null
  const vacProfile = vacProfileRes.data ?? null

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
