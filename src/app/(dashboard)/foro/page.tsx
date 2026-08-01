import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Newspaper, Pin, Plus } from "lucide-react"

export default async function ForumPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("*, limited_profiles!forum_posts_author_id_fkey(full_name), forum_categories!inner(name, slug)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #d97706, #f59e0b)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Newspaper size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Foro</h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
              Discusiones de la comunidad SNTSS
            </p>
          </div>
        </div>
        <Link
          href="/foro/nuevo"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.5rem 1rem", background: "var(--primary)", color: "var(--primary-fg)",
            borderRadius: "var(--radius)", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600,
            transition: "all var(--transition)",
          }}
        >
          <Plus size={16} />
          Nueva publicación
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link
          href="/foro"
          style={{
            padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem",
            textDecoration: "none", background: "var(--primary)", color: "var(--primary-fg)",
            fontWeight: 500,
          }}
        >
          Todas
        </Link>
        {categories?.map((cat) => (
          <Link
            key={cat.id}
            href={`/foro?categoria=${cat.slug}`}
            style={{
              padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem",
              textDecoration: "none", background: "var(--accent)", color: "var(--fg)",
              fontWeight: 500, transition: "background var(--transition)",
            }}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {(!posts || posts.length === 0) && (
          <div style={{
            textAlign: "center", padding: "3rem 1rem", color: "var(--muted)",
          }}>
            <Newspaper size={40} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
            <p style={{ fontSize: "0.9375rem", margin: "0 0 0.5rem" }}>No hay publicaciones aún</p>
            <Link href="/foro/nuevo" style={{ color: "var(--primary)", fontSize: "0.875rem" }}>
              ¡Sé el primero en crear una!
            </Link>
          </div>
        )}
        {posts?.map((post) => (
          <Link
            key={post.id}
            href={`/foro/${post.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="hover-lift" style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: "1rem",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                  {post.is_pinned && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.25rem",
                      fontSize: "0.6875rem", fontWeight: 600,
                      background: "#fef3c7", color: "#92400e",
                      padding: "0.125rem 0.5rem", borderRadius: "9999px",
                    }}>
                      <Pin size={10} />
                      Fijado
                    </span>
                  )}
                  <h2 style={{
                    fontSize: "0.9375rem", fontWeight: 600, margin: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {post.title}
                  </h2>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                  {(post as { forum_categories?: { name: string } }).forum_categories?.name ?? "General"}
                  &nbsp;&middot;&nbsp;
                  {post.limited_profiles?.full_name ?? "Anónimo"}
                </p>
              </div>
              <span style={{
                fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {new Date(post.created_at!).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
