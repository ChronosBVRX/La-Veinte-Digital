import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { fetchLatestServerPayslip } from "@/features/tarjeton-guia/services/fetch-latest-payslip"
import { MiQuincenaPage } from "@/features/tarjeton-guia/components/MiQuincenaPage"

export default async function MiQuincenaPageRoute({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const serverPayslip = await fetchLatestServerPayslip(user.id)
  const { vista } = await searchParams

  return <MiQuincenaPage serverPayslip={serverPayslip} initialTab={vista} />
}
