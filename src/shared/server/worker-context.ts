"use server"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

export interface WorkerContext {
  profile: {
    fullName: string | null
    matricula: string | null
    categoria: string | null
    antiguedad: string | null
  } | null
  employment: {
    categoryName: string | null
    categoryCode: string | null
    workdayHours: number | null
    employmentType: string | null
    entryDate: string | null
    effectiveSeniorityDate: string | null
    seniorityRaw: string | null
  } | null
  payroll: {
    latestPeriod: string | null
    totalEarnings: number | null
    totalDeductions: number | null
    netPay: number | null
    recurringConcepts: unknown[]
    payrollFacts: unknown[]
  } | null
}

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
    payroll: {
      latestPeriod: latest?.period_raw ?? null,
      totalEarnings: (latest?.payroll_totals as Record<string, number> | undefined)?.totalEarnings ?? null,
      totalDeductions: (latest?.payroll_totals as Record<string, number> | undefined)?.totalDeductions ?? null,
      netPay: (latest?.payroll_totals as Record<string, number> | undefined)?.netPay ?? null,
      recurringConcepts: (ctx?.recurring_concepts as unknown[]) ?? [],
      payrollFacts: (ctx?.payroll_facts as unknown[]) ?? [],
    },
  }
}
