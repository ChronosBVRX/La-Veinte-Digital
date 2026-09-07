import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { resolveActivePayslip } from "./active-payslip"

export interface WorkerActiveDiagnostics {
  activeEmployee: string | null
  activePayslipId: string | null
  activePayslipPeriod: string | null
  profileMatricula: string | null
  profileNombre: string | null
  payrollMatricula: string | null
  vacationProfileMatricula: string | null
  radiologicalSource: string | null
  selectionMode: "AUTO_LATEST" | "PINNED"
  isPinned: boolean
  invariants: {
    identityMismatch: boolean
    activePayslipNotOwned: boolean
    activePayslipEmployeeMismatch: boolean
  }
}

/**
 * Utilidad de diagnóstico e invariantes para tests y verificación.
 */
export async function getWorkerActiveDiagnostics(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<WorkerActiveDiagnostics> {
  const [profileRes, activeContextRes, payrollRes, vacProfileRes] = await Promise.all([
    supabase.from("profiles").select("matricula, full_name").eq("id", userId).maybeSingle(),
    supabase.from("worker_active_context").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("payroll_contexts").select("matricula").eq("user_id", userId).maybeSingle(),
    supabase.from("vacation_profile_data").select("employee_number, radiological_exposure_source").eq("user_id", userId).maybeSingle(),
  ])

  const profileMatricula = profileRes.data?.matricula?.trim() || null
  const profileNombre = profileRes.data?.full_name?.trim() || null
  const payrollMatricula = (payrollRes.data?.matricula as string | undefined)?.trim() || null
  const vacationProfileMatricula = vacProfileRes.data?.employee_number?.trim() || null
  const radiologicalSource = vacProfileRes.data?.radiological_exposure_source || null

  const resolved = await resolveActivePayslip(supabase, userId, { activeMatricula: profileMatricula })
  const activePayslip = resolved.payslip
  const activeEmployee = profileMatricula || activeContextRes.data?.employee_number || activePayslip?.employee_number || null

  const payslipEmpNum = activePayslip?.employee_number?.trim() || null
  const identityMismatch = Boolean(
    (profileMatricula && payrollMatricula && profileMatricula !== payrollMatricula) ||
    (profileMatricula && vacationProfileMatricula && profileMatricula !== vacationProfileMatricula)
  )
  const activePayslipNotOwned = Boolean(activePayslip && activePayslip.user_id !== userId)
  const activePayslipEmployeeMismatch = Boolean(
    profileMatricula && payslipEmpNum && profileMatricula !== payslipEmpNum
  )

  return {
    activeEmployee,
    activePayslipId: resolved.activePayslipId,
    activePayslipPeriod: activePayslip?.period_raw || null,
    profileMatricula,
    profileNombre,
    payrollMatricula,
    vacationProfileMatricula,
    radiologicalSource,
    selectionMode: resolved.selectionMode,
    isPinned: resolved.isPinned,
    invariants: {
      identityMismatch,
      activePayslipNotOwned,
      activePayslipEmployeeMismatch,
    },
  }
}
