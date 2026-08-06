import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types"

export type CommitmentRow = Tables<"worker_commitments">
export type CommitmentInsert = TablesInsert<"worker_commitments">
export type CommitmentUpdate = TablesUpdate<"worker_commitments">

export type FetchResult =
  | { ok: true; data: CommitmentRow[] }
  | { ok: false; error: string }

export async function fetchCommitments(userId: string): Promise<FetchResult> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("worker_commitments")
    .select("*")
    .eq("user_id", userId)
    .order("start_at", { ascending: true })

  if (error) {
    console.error("[commitments-supabase] fetch:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data ?? [] }
}

export async function insertCommitment(commitment: CommitmentInsert): Promise<CommitmentRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("worker_commitments")
    .insert(commitment)
    .select()
    .single()

  if (error) {
    console.error("[commitments-supabase] insert:", error.message)
    return null
  }
  return data
}

export async function updateCommitment(id: string, updates: CommitmentUpdate): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("worker_commitments")
    .update(updates)
    .eq("id", id)

  if (error) {
    console.error("[commitments-supabase] update:", error.message)
    return false
  }
  return true
}

export async function deleteCommitment(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("worker_commitments")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("[commitments-supabase] delete:", error.message)
    return false
  }
  return true
}

export async function upsertLegacyCommitment(
  commitment: CommitmentInsert
): Promise<CommitmentRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("worker_commitments")
    .upsert(commitment, { onConflict: "user_id,legacy_local_id" })
    .select()
    .single()

  if (error) {
    console.error("[commitments-supabase] legacy upsert:", error.message)
    return null
  }
  return data
}
