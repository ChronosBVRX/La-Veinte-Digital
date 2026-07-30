import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert } from "@/lib/supabase/types"

type BitacoraEntry = Tables<"bitacora_entries">

export async function getBitacoraEntries(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bitacora_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
  return (data ?? []) as BitacoraEntry[]
}

export async function createBitacoraEntry(entry: TablesInsert<"bitacora_entries">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bitacora_entries")
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data as BitacoraEntry
}

export async function deleteBitacoraEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("bitacora_entries")
    .delete()
    .eq("id", id)
  if (error) throw error
}
