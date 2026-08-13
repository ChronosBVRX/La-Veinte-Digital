/**
 * Obtención del último tarjetón (lado servidor) para la Guía de mi Tarjetón.
 *
 * Lee la fila más reciente de `imported_payslips` del usuario y sus
 * `imported_payslip_lines`/`imported_payslip_observations` (RLS protege que
 * solo sea visible para su dueño). Devuelve datos en el shape desacoplado
 * `GuidePayslip` o null si no hay tarjetón.
 */
import "server-only"
import { createClient } from "@/lib/supabase/server"
import { dbRowToGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"

export interface LatestPayslipResult {
  prefers: "local" | "server"
  local: GuidePayslip | null
  server: GuidePayslip | null
}

export async function fetchLatestServerPayslip(userId: string): Promise<GuidePayslip | null> {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from("imported_payslips")
    .select("id, period_raw, period_year, period_month, period_half, created_at, employee_data, payroll_totals")
    .eq("user_id", userId)
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)

  const latest = rows?.[0]
  if (error || !latest) return null

  const [linesRes, obsRes] = await Promise.all([
    supabase
      .from("imported_payslip_lines")
      .select("line_index, concept_code, description, amount, kind, confidence, confirmed_by_user")
      .eq("payslip_id", latest.id)
      .order("line_index", { ascending: true })
      .limit(80),
    supabase
      .from("imported_payslip_observations")
      .select("line_index, concept_code, amount, due_period, units, control_number, initial_charge, notes")
      .eq("payslip_id", latest.id)
      .order("line_index", { ascending: true })
      .limit(80),
  ])

  return dbRowToGuidePayslip(
    latest as unknown as Record<string, unknown>,
    (linesRes.data ?? []).map((l) => ({
      kind: l.kind,
      code: l.concept_code,
      description: l.description,
      amount: l.amount,
      confidence: l.confidence,
      confirmedByUser: l.confirmed_by_user,
    })),
    (obsRes.data ?? []).map((o) => ({ ...o }))
  )
}
