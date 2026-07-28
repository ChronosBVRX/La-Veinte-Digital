"use client"

import { useActionState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input, Textarea, Select } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"

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
      <Input id="title" name="title" label="Título" required />
      <Select id="category_id" name="category_id" label="Categoría">
        <option value="">Sin categoría</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </Select>
      <Textarea id="content" name="content" label="Contenido" rows={8} required />
      <Button type="submit" loading={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Publicando..." : "Publicar"}
      </Button>
    </form>
  )
}
