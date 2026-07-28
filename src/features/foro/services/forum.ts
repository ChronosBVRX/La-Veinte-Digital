import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert } from "@/lib/supabase/types"

type Post = Tables<"forum_posts">
type Comment = Tables<"forum_comments">
type Category = Tables<"forum_categories">

export async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })
  return (data ?? []) as Category[]
}

export async function getPosts(categorySlug?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("forum_posts")
    .select("*, profiles!forum_posts_author_id_fkey(full_name, avatar_url), forum_categories!inner(name, slug)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (categorySlug) {
    query = query.eq("forum_categories.slug", categorySlug)
  }

  const { data } = await query
  return data ?? []
}

export async function getPost(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("forum_posts")
    .select("*, profiles!forum_posts_author_id_fkey(full_name, avatar_url, matricula, adscripcion), forum_categories(name, slug)")
    .eq("id", id)
    .single()
  return data as Post & { profiles: { full_name: string | null; avatar_url: string | null; matricula: string | null; adscripcion: string | null }; forum_categories: { name: string; slug: string } } | null
}

export async function createPost(post: TablesInsert<"forum_posts">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("forum_posts")
    .insert(post)
    .select()
    .single()
  if (error) throw error
  return data as Post
}

export async function getComments(postId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("forum_comments")
    .select("*, profiles!forum_comments_author_id_fkey(full_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
  return (data ?? []) as (Comment & { profiles: { full_name: string | null; avatar_url: string | null } })[]
}

export async function createComment(comment: TablesInsert<"forum_comments">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("forum_comments")
    .insert(comment)
    .select()
    .single()
  if (error) throw error
  return data as Comment
}
