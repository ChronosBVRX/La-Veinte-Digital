import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AdminVacationsPage from "@/features/vacations/pages/admin/page"

export default async function VacacionesAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    redirect("/vacaciones")
  }

  return <AdminVacationsPage />
}
