import { createClient } from "@/lib/supabase/server"
import { NewPostForm } from "./new-post-form"

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  return (
    <div style={{ maxWidth: "700px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Nueva publicación</h1>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.5rem" }}>
        <NewPostForm categories={categories ?? []} />
      </div>
    </div>
  )
}
