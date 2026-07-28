import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert } from "@/lib/supabase/types"

type Room = Tables<"chat_rooms">
type Message = Tables<"chat_messages">
type Participant = Tables<"chat_participants">

export async function getRooms() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_rooms")
    .select("*, profiles!chat_rooms_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getRoom(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("id", id)
    .single()
  return data as Room | null
}

export async function getMessages(roomId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_messages")
    .select("*, profiles!chat_messages_user_id_fkey(full_name, avatar_url)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100)
  return (data ?? []) as (Message & { profiles: { full_name: string | null; avatar_url: string | null } })[]
}

export async function sendMessage(message: TablesInsert<"chat_messages">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chat_messages")
    .insert(message)
    .select()
    .single()
  if (error) throw error
  return data as Message
}

export async function joinRoom(roomId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_participants")
    .insert({ room_id: roomId, user_id: userId })
    .select()
    .single()
  return data as Participant | null
}

export async function getParticipants(roomId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_participants")
    .select("*, profiles(full_name, avatar_url)")
    .eq("room_id", roomId)
  return data ?? []
}
