import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { resolveActivePayslip } from "@/shared/server/active-payslip"
import { GuiaHome, type GuiaHomeServerData } from "@/features/tarjeton-guia/components/GuiaHome"

export default async function GuiaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("matricula")
    .eq("id", user.id)
    .maybeSingle()

  const activeMatricula = profile?.matricula?.trim() || null

  const resolved = await resolveActivePayslip(supabase, user.id, { activeMatricula })
  const latest = resolved.payslip
  const totals = (latest?.payroll_totals ?? {}) as Record<string, unknown> | null

  let counts = { earningsCount: 0, deductionsCount: 0 }
  if (latest) {
    const { data: lines } = await supabase
      .from("imported_payslip_lines")
      .select("kind")
      .eq("payslip_id", latest.id)
      .limit(80)
    const kinds = (lines ?? []).map((l) => l.kind)
    counts = {
      earningsCount: kinds.filter((k) => k !== "deduction").length,
      deductionsCount: kinds.filter((k) => k === "deduction").length,
    }
  }

  const data: GuiaHomeServerData = {
    hasPayslip: !!latest,
    documentId: latest?.id,
    periodRaw: typeof latest?.period_raw === "string" ? latest.period_raw : undefined,
    netPay: typeof totals?.netPay === "number" ? (totals.netPay as number) : undefined,
    totalEarnings: typeof totals?.totalEarnings === "number" ? (totals.totalEarnings as number) : undefined,
    totalDeductions: typeof totals?.totalDeductions === "number" ? (totals.totalDeductions as number) : undefined,
    ...counts,
  }

  return <GuiaHome data={data} />
}
