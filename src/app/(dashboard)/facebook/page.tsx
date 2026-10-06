import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"
import { fetchFacebookPosts } from "@/features/facebook/services/facebook-posts-service"

export default async function FacebookPage() {
  const initialPosts = await fetchFacebookPosts({ limit: 30 })

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>Noticias SNTSS</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
          Comunicados y publicaciones oficiales de la Sección XX Michoacán y CEN SNTSS
        </p>
      </div>
      <FacebookFeeds initialPosts={initialPosts} />
    </div>
  )
}
