import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function ForumPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("*, profiles!forum_posts_author_id_fkey(full_name), forum_categories!inner(name, slug)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Foro</h1>
        <Link
          href="/foro/nuevo"
          style={{
            padding: "0.5rem 1rem", background: "var(--primary)", color: "var(--primary-fg)",
            borderRadius: "0.375rem", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600,
          }}
        >
          Nueva publicación
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link
          href="/foro"
          style={{
            padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.875rem",
            textDecoration: "none", background: "var(--primary)", color: "var(--primary-fg)",
          }}
        >
          Todas
        </Link>
        {categories?.map((cat) => (
          <Link
            key={cat.id}
            href={`/foro?categoria=${cat.slug}`}
            style={{
              padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.875rem",
              textDecoration: "none", background: "var(--accent)", color: "var(--fg)",
            }}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {posts?.length === 0 && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "3rem 0" }}>
            No hay publicaciones aún. ¡Sé el primero en crear una!
          </p>
        )}
        {posts?.map((post) => (
          <Link
            key={post.id}
            href={`/foro/${post.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
              padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  {post.is_pinned && (
                    <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "0.125rem 0.5rem", borderRadius: "999px" }}>
                      Fijado
                    </span>
                  )}
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{post.title}</h2>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
                  {(post as { forum_categories?: { name: string } }).forum_categories?.name ?? "General"} &middot;{" "}
                  {post.profiles?.full_name ?? "Anónimo"}
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {new Date(post.created_at!).toLocaleDateString("es-MX")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
