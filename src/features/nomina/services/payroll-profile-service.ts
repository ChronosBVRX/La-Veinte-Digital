import { createClient } from "@/lib/supabase/client"
import type { EmployeePayrollProfile } from "../lib/types"

export async function fetchProfileFromSupabase(userId: string): Promise<Partial<EmployeePayrollProfile> | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("profiles")
    .select("categoria, antiguedad, adscripcion, full_name")
    .eq("id", userId)
    .single()

  if (!data) return null

  const result: Partial<EmployeePayrollProfile> = {}
  if (data.categoria) result.categoryName = data.categoria
  return result
}

export async function saveProfileToSupabase(profile: EmployeePayrollProfile): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Si no hay sesión, conservamos el almacenamiento local y no escribimos.
    // El servicio se usa principalmente desde el hook de nómina donde el usuario siempre está autenticado.
    return
  }
  const { error: ensureError } = await supabase.rpc("ensure_profile_exists")
  if (ensureError) {
    console.error("[payroll-profile-service] ensure_profile_exists:", ensureError.message)
    throw new Error("No se pudo preparar el perfil para escribir.")
  }
  const { error } = await supabase
    .from("profiles")
    .update({ categoria: profile.categoryName ?? null })
    .eq("id", user.id)

  if (error) throw error
}
