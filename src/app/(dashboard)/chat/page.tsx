import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("*, profiles!chat_rooms_created_by_fkey(full_name)")
    .eq("is_private", false)
    .order("created_at", { ascending: false })

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Salas de Chat</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {rooms?.length === 0 && (
          <p style={{ color: "var(--muted)", gridColumn: "1 / -1", textAlign: "center", padding: "3rem 0" }}>
            No hay salas disponibles
          </p>
        )}
        {rooms?.map((room) => (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
              padding: "1.25rem", height: "100%",
            }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>{room.name}</h2>
              {room.description && (
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.5rem 0" }}>
                  {room.description}
                </p>
              )}
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
                Creado por {room.profiles?.full_name ?? "Desconocido"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
