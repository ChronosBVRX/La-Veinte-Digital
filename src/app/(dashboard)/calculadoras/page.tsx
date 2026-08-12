import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CalculatorsIndex } from "@/features/calculators/components/CalculatorsIndex"

export default async function CalculadorasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { count: tarjetonesCount } = await supabase
    .from("imported_payslips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const hasTarjeton = (tarjetonesCount ?? 0) > 0

  return <CalculatorsIndex hasTarjeton={hasTarjeton} />
}
