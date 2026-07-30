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
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: profile.userId,
      categoria: profile.categoryName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })

  if (error) throw error
}
