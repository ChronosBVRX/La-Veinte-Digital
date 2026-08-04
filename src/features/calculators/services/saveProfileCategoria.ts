"use server"

import { createClient } from "@/lib/supabase/server"
import type { EditableProfileFields } from "@/shared/contracts/profile"

export async function saveProfileCategoria(categoria: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const updates: EditableProfileFields = { categoria }
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)

  if (error) throw new Error(error.message)
}
