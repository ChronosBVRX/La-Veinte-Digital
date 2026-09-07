import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CalculatorsIndex } from "@/features/calculators/components/CalculatorsIndex"

export default async function CalculadorasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("matricula")
    .eq("id", user.id)
    .maybeSingle()

  const activeMatricula = profile?.matricula?.trim() || null

  let query = supabase
    .from("imported_payslips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  if (activeMatricula) {
    query = query.eq("employee_number", activeMatricula)
  }

  const { count: tarjetonesCount } = await query

  const hasTarjeton = (tarjetonesCount ?? 0) > 0

  return <CalculatorsIndex hasTarjeton={hasTarjeton} />
}
