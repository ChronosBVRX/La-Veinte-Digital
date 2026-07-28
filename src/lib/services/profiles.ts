import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesUpdate } from "@/lib/supabase/types"

type Profile = Tables<"profiles">

export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  return data as Profile | null
}

export async function updateProfile(userId: string, updates: TablesUpdate<"profiles">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

export async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getProfile(user.id)
}
