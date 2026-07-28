import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { MessageCircle } from "lucide-react"

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("*, profiles!chat_rooms_created_by_fkey(full_name)")
    .eq("is_private", false)
    .order("created_at", { ascending: false })

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <MessageCircle size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Salas de Chat</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            Conversa con otros trabajadores del SNTSS
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        {(!rooms || rooms.length === 0) && (
          <div style={{
            textAlign: "center", padding: "3rem 1rem", color: "var(--muted)",
            gridColumn: "1 / -1",
          }}>
            <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
            <p style={{ fontSize: "0.9375rem", margin: 0 }}>No hay salas disponibles</p>
          </div>
        )}
        {rooms?.map((room) => (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="hover-lift" style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.25rem", height: "100%",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "0.5rem",
                background: "var(--accent)", display: "flex", alignItems: "center",
                justifyContent: "center", marginBottom: "0.75rem", flexShrink: 0,
              }}>
                <MessageCircle size={18} style={{ color: "var(--primary)" }} />
              </div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>{room.name}</h2>
              {room.description && (
                <p style={{
                  fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.5rem 0",
                  flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {room.description}
                </p>
              )}
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, marginTop: "auto" }}>
                Por {room.profiles?.full_name ?? "Desconocido"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
