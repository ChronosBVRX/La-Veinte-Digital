/**
 * Obtención del último tarjetón (lado servidor) para la Guía de mi Tarjetón.
 *
 * Lee la fila más reciente de `imported_payslips` del usuario y sus
 * `imported_payslip_lines`/`imported_payslip_observations` (RLS protege que
 * solo sea visible para su dueño). Devuelve datos en el shape desacoplado
 * `GuidePayslip` o null si no hay tarjetón, junto con la lista histórica de tarjetones.
 */
import "server-only"
import { createClient } from "@/lib/supabase/server"
import { resolveActivePayslip } from "@/shared/server/active-payslip"
import { dbRowToGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"

export interface LatestPayslipResult {
  prefers: "local" | "server"
  local: GuidePayslip | null
  server: GuidePayslip | null
}

export interface ServerPayslipSummary {
  id: string
  periodRaw?: string
  periodLabel?: string
  netPay?: number
}

export interface ServerPayslipQueryResult {
  payslip: GuidePayslip | null
  allServerPayslips?: ServerPayslipSummary[]
  error?: { message: string; code?: string } | null
}

export async function fetchLatestServerPayslip(
  userId: string,
  targetPayslipId?: string | null
): Promise<ServerPayslipQueryResult> {
  const supabase = await createClient()

  // Consultar historial de tarjetones del usuario para el selector
  const { data: allSlipsRows } = await supabase
    .from("imported_payslips")
    .select("id, period_raw, payroll_totals")
    .eq("user_id", userId)
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("period_half", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(24)

  const allServerPayslips: ServerPayslipSummary[] = (allSlipsRows ?? []).map((row) => {
    const totals = (row.payroll_totals ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      periodRaw: row.period_raw || undefined,
      periodLabel: row.period_raw || undefined,
      netPay: typeof totals.netPay === "number" ? totals.netPay : undefined,
    }
  })

  let latest: Record<string, unknown> | null = null

  if (targetPayslipId) {
    const { data: targetRow } = await supabase
      .from("imported_payslips")
      .select("*")
      .eq("id", targetPayslipId)
      .eq("user_id", userId)
      .maybeSingle()
    if (targetRow) {
      latest = targetRow as Record<string, unknown>
    }
  }

  if (!latest) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("matricula")
      .eq("id", userId)
      .maybeSingle()

    if (profileErr) {
      console.error("[fetch-latest-payslip] Error al consultar perfil (código):", profileErr.code || "unknown")
      return {
        payslip: null,
        allServerPayslips,
        error: { message: "Error al consultar perfil del trabajador", code: profileErr.code },
      }
    }

    const activeMatricula = profile?.matricula?.trim() || null

    const resolved = await resolveActivePayslip(supabase, userId, { activeMatricula })
    if (resolved.error) {
      console.error("[fetch-latest-payslip] Error al resolver tarjetón activo (código):", resolved.error.code || "unknown")
      return { payslip: null, allServerPayslips, error: resolved.error }
    }
    latest = resolved.payslip as unknown as Record<string, unknown>
  }

  if (!latest) return { payslip: null, allServerPayslips, error: null }

  const latestPayslipId = String(latest.id)

  const [linesRes, obsRes] = await Promise.all([
    supabase
      .from("imported_payslip_lines")
      .select("line_index, concept_code, description, amount, kind, confidence, confirmed_by_user")
      .eq("payslip_id", latestPayslipId)
      .order("line_index", { ascending: true })
      .limit(80),
    supabase
      .from("imported_payslip_observations")
      .select("line_index, concept_code, amount, due_period, units, control_number, initial_charge, notes")
      .eq("payslip_id", latestPayslipId)
      .order("line_index", { ascending: true })
      .limit(80),
  ])

  if (linesRes.error) {
    console.error("[fetch-latest-payslip] Error al consultar líneas (código):", linesRes.error.code || "unknown")
    return {
      payslip: null,
      allServerPayslips,
      error: { message: "Error al consultar líneas del tarjetón", code: linesRes.error.code },
    }
  }

  return {
    payslip: dbRowToGuidePayslip(
      latest as unknown as Record<string, unknown>,
      (linesRes.data ?? []).map((l) => ({
        kind: l.kind,
        code: l.concept_code,
        description: l.description,
        amount: l.amount,
        confidence: l.confidence,
        confirmedByUser: l.confirmed_by_user,
      })),
      (obsRes.data ?? []).map((o) => ({ ...o })),
    ),
    allServerPayslips,
    error: null,
  }
}
