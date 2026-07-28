"use client"

import { useActionState, useOptimistic, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Comment {
  id: string
  content: string
  author_id: string
  created_at: string | null
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

export function CommentSection({ postId, comments: initialComments }: { postId: string; comments: Comment[] }) {
  const router = useRouter()
  const [optimisticComments, addOptimistic] = useOptimistic(
    initialComments,
    (state, newComment: Comment) => [...state, newComment]
  )

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      const supabase = createClient()
      const content = formData.get("content") as string
      if (!content.trim()) return { error: "El comentario no puede estar vacío" }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "Debes iniciar sesión" }

      const optimistic: Comment = {
        id: crypto.randomUUID(),
        content,
        author_id: user.id,
        created_at: new Date().toISOString(),
        profiles: { full_name: null, avatar_url: null },
      }

      startTransition(() => addOptimistic(optimistic))

      const { error } = await supabase
        .from("forum_comments")
        .insert({ content, post_id: postId, author_id: user.id })

      if (error) return { error: error.message }
      router.refresh()
      return {}
    },
    undefined
  )

  return (
    <div>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
        Comentarios ({optimisticComments.length})
      </h2>

      <form action={formAction} style={{ marginBottom: "1.5rem" }}>
        {state?.error && (
          <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{state.error}</p>
        )}
        <textarea
          name="content"
          rows={3}
          placeholder="Escribe un comentario..."
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem", resize: "vertical", fontFamily: "inherit" }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: "0.5rem", padding: "0.5rem 1rem", background: "var(--primary)", color: "var(--primary-fg)",
            border: "none", borderRadius: "0.375rem", fontWeight: 600, cursor: "pointer", opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Enviando..." : "Comentar"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {optimisticComments.map((comment) => (
          <div key={comment.id} style={{ background: "var(--bg)", borderRadius: "0.375rem", padding: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {comment.profiles?.full_name ?? "Tú"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {comment.created_at ? new Date(comment.created_at).toLocaleDateString("es-MX") : ""}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{comment.content}</p>
          </div>
        ))}
        {optimisticComments.length === 0 && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem 0" }}>
            No hay comentarios aún. ¡Sé el primero!
          </p>
        )}
      </div>
    </div>
  )
}
