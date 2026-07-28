import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { NewPostForm } from "@/features/foro/components/NewPostForm"

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Link
        href="/foro"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          fontSize: "0.875rem", color: "var(--muted)", textDecoration: "none",
          marginBottom: "1rem",
        }}
      >
        <ArrowLeft size={14} />
        Volver al foro
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "0.625rem",
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Plus size={18} color="white" />
        </div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Nueva publicación</h1>
      </div>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.5rem",
      }}>
        <NewPostForm categories={categories ?? []} />
      </div>
    </div>
  )
}
