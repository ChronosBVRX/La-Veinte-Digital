import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ChatRoom } from "./chat-room"

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("id", id)
    .single()

  if (!room) notFound()

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*, profiles!chat_messages_user_id_fkey(full_name, avatar_url)")
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(100)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div style={{ height: "calc(100dvh - 56px - 3rem)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{room.name}</h1>
        {room.description && (
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0 0" }}>{room.description}</p>
        )}
      </div>

      <ChatRoom
        roomId={id}
        userId={user?.id ?? ""}
        initialMessages={messages ?? []}
      />
    </div>
  )
}
