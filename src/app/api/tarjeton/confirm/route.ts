import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { confirmTarjetonService } from "@/features/tarjeton/services/confirm-tarjeton"
import type { Json } from "@/lib/supabase/types"

/**
 * POST /api/tarjeton/confirm
 *
 * Confirma un tarjetón IMSS previamente extraído y revisado por el
 * trabajador. El PDF original NO se envía: solo el resultado estructurado
 * y la huella SHA-256 del archivo. La persistencia es atómica (RPC).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) {
    return auth.response
  }
  const user = auth.user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const supabase = await createClient()

  const result = await confirmTarjetonService(
    {
      userId: user.id,
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn as "confirm_imported_payslip", args as never)
        if (error) {
          console.error("[tarjeton/confirm][supabase]", { code: error.code, message: error.message, details: error.details, hint: error.hint })
        }
        return {
          data,
          error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null,
        }
      },
    },
    body,
  )

  if (!result.ok) {
    const status = result.error.code === "unauthorized" ? 401
      : result.error.code === "invalid_payload" || result.error.code === "template_not_detected" ? 400
      : result.error.code === "consent_required" ? 403
      : result.error.code === "totals_mismatch" || result.error.code === "matricula_mismatch" || result.error.code === "duplicate" || result.error.code === "limits_exceeded" ? 422
      : 500
    return NextResponse.json(result.error, { status })
  }

  if (result.ok && result.data.id) {
    const payslipId = result.data.id
    try {
      const parsedBody = body as {
        parsed?: {
          payroll?: {
            earnings?: Array<{ code?: string; description?: string; amount?: number; confidence?: number }>
            deductions?: Array<{ code?: string; description?: string; amount?: number; confidence?: number }>
            totalEarnings?: number
            totalDeductions?: number
            netPay?: number
          }
          vacations?: { porVencer?: string; dueDate?: string; porVencerRaw?: string }
        }
      }

      // Si es duplicado o las líneas están vacías, asegurar persistencia en imported_payslip_lines
      const { count } = await supabase
        .from("imported_payslip_lines")
        .select("id", { count: "exact", head: true })
        .eq("payslip_id", payslipId)

      const earnings = parsedBody?.parsed?.payroll?.earnings ?? []
      const deductions = parsedBody?.parsed?.payroll?.deductions ?? []

      if ((count === null || count === 0) && (earnings.length > 0 || deductions.length > 0)) {
        const linesToInsert = [
          ...earnings.map((e, idx) => ({
            payslip_id: payslipId,
            line_index: idx,
            concept_code: e.code || "",
            description: e.description || "",
            amount: e.amount || 0,
            kind: "earning",
            confidence: e.confidence ?? 1.0,
            confirmed_by_user: true,
          })),
          ...deductions.map((d, idx) => ({
            payslip_id: payslipId,
            line_index: earnings.length + idx,
            concept_code: d.code || "",
            description: d.description || "",
            amount: d.amount || 0,
            kind: "deduction",
            confidence: d.confidence ?? 1.0,
            confirmed_by_user: true,
          })),
        ]

        await supabase.from("imported_payslip_lines").insert(linesToInsert)

        const totals = {
          totalEarnings: parsedBody?.parsed?.payroll?.totalEarnings,
          totalDeductions: parsedBody?.parsed?.payroll?.totalDeductions,
          netPay: parsedBody?.parsed?.payroll?.netPay,
          earningsCount: earnings.length,
          deductionsCount: deductions.length,
        }

        await supabase
          .from("imported_payslips")
          .update({ payroll_totals: totals as Json })
          .eq("id", payslipId)
          .eq("user_id", user.id)
      }

      if (result.data.duplicate) {
        const newVacations = parsedBody?.parsed?.vacations
        if (newVacations && (newVacations.porVencer || newVacations.dueDate)) {
          const { data: existingRow } = await supabase
            .from("imported_payslips")
            .select("vacations")
            .eq("id", payslipId)
            .eq("user_id", user.id)
            .maybeSingle()

          const existingVac = (existingRow?.vacations as Record<string, unknown>) ?? {}
          // No sobrescribir fechas válidas que ya existan
          const mergedVac = {
            ...newVacations,
            ...existingVac,
            porVencer: existingVac.porVencer || newVacations.porVencer,
            dueDate: existingVac.dueDate || newVacations.dueDate || existingVac.porVencer || newVacations.porVencer,
            porVencerRaw: existingVac.porVencerRaw || newVacations.porVencerRaw,
          }

          await supabase
            .from("imported_payslips")
            .update({ vacations: mergedVac as Json })
            .eq("id", payslipId)
            .eq("user_id", user.id)
        }
      }
    } catch (err) {
      console.warn("[tarjeton/confirm] no fue posible actualizar líneas/vacations en payslip:", err)
    }
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
