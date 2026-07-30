import type { EmployeePayrollProfile } from "../lib/types"
import { getProfile } from "./storage"
import { fetchProfileFromSupabase, saveProfileToSupabase } from "./payroll-profile-service"

export async function migrateLocalProfileToSupabase(userId: string): Promise<EmployeePayrollProfile | null> {
  const localProfile = getProfile()
  const supabaseProfile = await fetchProfileFromSupabase(userId)

  if (!localProfile && !supabaseProfile) return null

  if (localProfile && !supabaseProfile) {
    localProfile.userId = userId
    await saveProfileToSupabase(localProfile)
    return localProfile
  }

  if (supabaseProfile && !localProfile) {
    const existing = getProfile()
    if (existing) {
      existing.categoryName = supabaseProfile.categoryName ?? existing.categoryName
      existing.userId = userId
      return existing
    }
    return null
  }

  if (localProfile && supabaseProfile) {
    localProfile.categoryName = supabaseProfile.categoryName ?? localProfile.categoryName
    localProfile.userId = userId
    return localProfile
  }

  return null
}
