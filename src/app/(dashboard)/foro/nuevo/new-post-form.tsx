"use client"

import { useActionState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Category {
  id: string
  name: string
}

export function NewPostForm({ categories }: { categories: Category[] }) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "Debes iniciar sesión" }

      const { error } = await supabase.from("forum_posts").insert({
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        category_id: formData.get("category_id") as string || null,
        author_id: user.id,
      })

      if (error) return { error: error.message }
      router.push("/foro")
      return {}
    },
    undefined
  )

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {state?.error && (
        <p style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="title" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Título
        </label>
        <input
          id="title"
          name="title"
          required
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
        />
      </div>
      <div>
        <label htmlFor="category_id" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Categoría
        </label>
        <select
          id="category_id"
          name="category_id"
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem", background: "white" }}
        >
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="content" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Contenido
        </label>
        <textarea
          id="content"
          name="content"
          rows={8}
          required
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "0.625rem 1.25rem", background: "var(--primary)", color: "var(--primary-fg)",
          border: "none", borderRadius: "0.375rem", fontWeight: 600, cursor: "pointer",
          alignSelf: "flex-start", opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Publicando..." : "Publicar"}
      </button>
    </form>
  )
}
