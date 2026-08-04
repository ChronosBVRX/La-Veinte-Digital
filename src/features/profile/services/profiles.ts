import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"
import {
  EDITABLE_PROFILE_FIELD_NAMES,
  type EditableProfileFields,
} from "@/shared/contracts/profile"

type Profile = Tables<"profiles">

const EDITABLE_PROFILE_FIELDS = new Set<keyof EditableProfileFields>(
  EDITABLE_PROFILE_FIELD_NAMES,
)

export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  return data as Profile | null
}

export async function updateProfile(userId: string, updates: EditableProfileFields) {
  const unknownField = Object.keys(updates).find(
    (field) => !EDITABLE_PROFILE_FIELDS.has(field as keyof EditableProfileFields),
  )
  if (unknownField) throw new Error(`Campo de perfil no editable: ${unknownField}`)

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
