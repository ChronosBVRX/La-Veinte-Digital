import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { fetchLatestServerPayslip } from "@/features/tarjeton-guia/services/fetch-latest-payslip"
import { MiQuincenaPage } from "@/features/tarjeton-guia/components/MiQuincenaPage"

export default async function MiQuincenaPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { vista, id } = await searchParams
  const serverResult = await fetchLatestServerPayslip(user.id, id)

  return (
    <MiQuincenaPage
      serverPayslip={serverResult.payslip}
      allServerPayslips={serverResult.allServerPayslips}
      serverError={serverResult.error?.message}
      userId={user.id}
      initialTab={vista}
      selectedPayslipId={id}
    />
  )
}
