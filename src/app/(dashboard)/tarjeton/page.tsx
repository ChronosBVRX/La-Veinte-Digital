import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TarjetonPageClient } from "@/features/tarjeton/components/TarjetonPageClient"

export default async function TarjetonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [profileRes, payslipsRes] = await Promise.all([
    supabase.from("profiles").select("full_name, matricula, categoria, antiguedad").eq("id", user.id).single(),
    supabase.from("imported_payslips")
      .select("id, period_raw, extraction_method, global_confidence, created_at, employee_data, payroll_totals")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const profile = profileRes.data
  const snapshot = {
    fullName: profile?.full_name ?? null,
    matricula: profile?.matricula ?? null,
    categoria: profile?.categoria ?? null,
    antiguedad: profile?.antiguedad ?? null,
  }

  const previousImports = (payslipsRes.data ?? []).map((p) => ({
    id: p.id,
    periodRaw: p.period_raw,
    extractionMethod: p.extraction_method,
    globalConfidence: p.global_confidence,
    createdAt: p.created_at,
    employeeName: (p.employee_data as Record<string, unknown> | undefined)?.fullName as string ?? null,
    totalNet: (p.payroll_totals as Record<string, number> | undefined)?.netPay ?? null,
  }))

  // Conceptos del último tarjetón (para la guía integrada en el visor).
  let latestConcepts: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }> = []
  const latestRow = payslipsRes.data?.[0]
  if (latestRow) {
    const { data: lines } = await supabase
      .from("imported_payslip_lines")
      .select("concept_code, description, amount, kind")
      .eq("payslip_id", latestRow.id)
      .order("line_index", { ascending: true })
      .limit(12)
    latestConcepts = (lines ?? []).map((l) => ({
      code: l.concept_code,
      description: l.description,
      amount: l.amount,
      kind: l.kind === "deduction" ? ("deduction" as const) : ("earning" as const),
    }))
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <TarjetonPageClient profile={snapshot} previousImports={previousImports} latestConcepts={latestConcepts} />
    </div>
  )
}
