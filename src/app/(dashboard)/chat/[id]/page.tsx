import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ChatRoom } from "@/features/chat/components/ChatRoom"

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
    .select("*, limited_profiles!chat_messages_user_id_fkey(full_name, avatar_url)")
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(100)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <Link
          href="/chat"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--accent)", color: "var(--muted)",
            textDecoration: "none", flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>{room.name}</h1>
          {room.description && (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
              {room.description}
            </p>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: "calc(100dvh - var(--nav-height) - 4rem)" }}>
        <ChatRoom
          roomId={id}
          userId={user?.id ?? ""}
          initialMessages={messages ?? []}
        />
      </div>
    </div>
  )
}
