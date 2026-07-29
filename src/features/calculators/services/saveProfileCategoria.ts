"use server"

import { createClient } from "@/lib/supabase/server"
import type { TablesUpdate } from "@/lib/supabase/types"

export async function saveProfileCategoria(categoria: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const updates: TablesUpdate<"profiles"> = { categoria }
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)

  if (error) throw new Error(error.message)
}
