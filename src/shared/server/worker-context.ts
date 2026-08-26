"use server"

import { createClient } from "@/lib/supabase/server"
import { buildWorkerContextPayroll, type PayslipLineRow, type WorkerContext } from "./worker-context-builder"

export type { WorkerContext } from "./worker-context-builder"

export async function getWorkerContext(): Promise<WorkerContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { profile: null, employment: null, payroll: null }

  const [profileRes, ctxRes, payslipRes] = await Promise.all([
    supabase.from("profiles").select("full_name, matricula, categoria, antiguedad").eq("id", user.id).single(),
    supabase.from("payroll_contexts").select("*").eq("user_id", user.id).single(),
    supabase.from("imported_payslips").select("id, period_raw, payroll_totals, employee_data").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
  ])

  const profile = profileRes.data
  const ctx = ctxRes.data
  const latest = payslipRes.data?.[0]

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

  return {
    profile: profile ? {
      fullName: profile.full_name,
      matricula: profile.matricula,
      categoria: profile.categoria,
      antiguedad: profile.antiguedad,
    } : null,
    employment: ctx ? {
      categoryName: (latest?.employee_data as Record<string, unknown> | undefined)?.categoryName as string ?? ctx.category_name,
      categoryCode: ctx.category_code,
      workdayHours: ctx.workday_hours,
      employmentType: ctx.employment_type,
      entryDate: null,
      effectiveSeniorityDate: ctx.effective_seniority_date,
      seniorityRaw: (latest?.employee_data as Record<string, unknown> | undefined)?.seniority as string ?? null,
    } : null,
    payroll: buildWorkerContextPayroll(
      latest
        ? {
            period_raw: latest.period_raw ?? null,
            payroll_totals: (latest.payroll_totals as Record<string, number> | undefined) ?? null,
          }
        : null,
      (ctx?.recurring_concepts as unknown[]) ?? [],
      (ctx?.payroll_facts as unknown[]) ?? [],
      payslipLines,
    ),
  }
}
