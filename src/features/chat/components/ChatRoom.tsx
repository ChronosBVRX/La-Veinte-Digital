"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Send } from "lucide-react"

interface Message {
  id: string
  content: string
  user_id: string
  created_at: string | null
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

export function ChatRoom({ roomId, userId, initialMessages }: { roomId: string; userId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as { id: string; content: string; user_id: string; created_at: string | null; room_id: string }
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single()

          setMessages((prev) => [
            ...prev,
            { ...newMsg, profiles: profile ?? { full_name: null, avatar_url: null } },
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const supabase = createClient()
    await supabase.from("chat_messages").insert({
      content: input,
      room_id: roomId,
      user_id: userId,
    })
    setInput("")
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - var(--nav-height) - 5rem)",
    }}>
      <div style={{
        flex: 1, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem", marginBottom: "0.75rem",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.user_id === userId ? "flex-end" : "flex-start",
              maxWidth: "75%", background: msg.user_id === userId ? "var(--primary)" : "var(--accent)",
              color: msg.user_id === userId ? "var(--primary-fg)" : "var(--fg)",
              borderRadius: msg.user_id === userId ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
              padding: "0.5rem 0.75rem",
            }}
          >
            {msg.user_id !== userId && (
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, marginBottom: "0.25rem", opacity: 0.7 }}>
                {msg.profiles?.full_name ?? "Usuario"}
              </div>
            )}
            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.4 }}>{msg.content}</p>
            <div style={{
              fontSize: "0.625rem", opacity: 0.5, textAlign: "right",
              marginTop: "0.125rem",
            }}>
              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          style={{
            flex: 1, padding: "0.625rem 1rem", border: "1px solid var(--border)",
            borderRadius: "0.75rem", fontSize: "0.875rem", outline: "none",
            transition: "border-color var(--transition), box-shadow var(--transition)",
          }}
        />
        <button
          type="submit"
          style={{
            width: 42, height: 42,
            background: !input.trim() ? "var(--border)" : "var(--primary)",
            color: "var(--primary-fg)", border: "none",
            borderRadius: "0.75rem",
            cursor: !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background var(--transition)",
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
