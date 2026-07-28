import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
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
    <div style={{ maxWidth: "800px" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
          {(post as { forum_categories?: { name: string } }).forum_categories?.name ?? "General"}
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>{post.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
          <span>{post.profiles?.full_name ?? "Anónimo"}</span>
          {post.profiles?.matricula && <span>&middot; {post.profiles.matricula}</span>}
          <span>&middot; {new Date(post.created_at!).toLocaleDateString("es-MX")}</span>
        </div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{post.content}</div>
      </div>

      <CommentSection postId={id} comments={comments ?? []} />
    </div>
  )
}
