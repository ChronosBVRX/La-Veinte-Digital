import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, User } from "lucide-react"
import { CommentSection } from "@/features/foro/components/CommentSection"

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("forum_posts")
    .select("*, profiles!forum_posts_author_id_fkey(full_name, avatar_url, matricula, adscripcion), forum_categories(name)")
    .eq("id", id)
    .single()

  if (!post) notFound()

  const { data: comments } = await supabase
    .from("forum_comments")
    .select("*, profiles!forum_comments_author_id_fkey(full_name, avatar_url)")
    .eq("post_id", id)
    .order("created_at", { ascending: true })

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Link
        href="/foro"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          fontSize: "0.875rem", color: "var(--muted)", textDecoration: "none",
          marginBottom: "1rem", transition: "color var(--transition)",
        }}
      >
        <ArrowLeft size={14} />
        Volver al foro
      </Link>

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.25rem",
          fontSize: "0.75rem", color: "var(--muted)", background: "var(--accent)",
          padding: "0.125rem 0.5rem", borderRadius: "9999px", marginBottom: "0.75rem",
        }}>
          {(post as { forum_categories?: { name: string } }).forum_categories?.name ?? "General"}
        </div>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>{post.title}</h1>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <User size={12} />
            {post.profiles?.full_name ?? "Anónimo"}
          </span>
          {post.profiles?.matricula && <span>&middot; {post.profiles.matricula}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Clock size={12} />
            {new Date(post.created_at!).toLocaleDateString("es-MX", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </span>
        </div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.9375rem" }}>
          {post.content}
        </div>
      </div>

      <CommentSection postId={id} comments={comments ?? []} />
    </div>
  )
}
