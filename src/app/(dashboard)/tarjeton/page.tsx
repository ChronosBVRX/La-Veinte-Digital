import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"
import { TarjetonHistorySection } from "@/features/tarjeton/components/TarjetonHistorySection"

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

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <TarjetonImporterWrapper profile={snapshot} />
      {previousImports.length > 0 && <TarjetonHistorySection imports={previousImports} />}
    </div>
  )
}
