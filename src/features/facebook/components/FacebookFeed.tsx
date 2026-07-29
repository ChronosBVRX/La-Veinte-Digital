"use client"

import { useFacebookFeed } from "@/features/facebook/hooks/useFacebookFeed"
import { FacebookPostCard } from "@/features/facebook/components/FacebookPostCard"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { Button } from "@/shared/components/ui/Button"

const FB_PAGE_URL = "https://www.facebook.com/SNTSSSeccionXXMichoacan"
const FB_PAGE_NAME = "SNTSSSeccionXXMichoacan"

interface Props {
  compact?: boolean
}

export function FacebookFeed({ compact }: Props) {
  const { posts, loading, error } = useFacebookFeed(FB_PAGE_NAME)
  const visible = compact ? posts.slice(0, 3) : posts

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden",
    }}>
      {loading && (
        <div style={{ padding: "2rem" }}>
          <LoadingSpinner text="Cargando publicaciones..." />
        </div>
      )}

      {error && (
        <div style={{ padding: "1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            No se pudo cargar el feed de Facebook.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(FB_PAGE_URL, "_blank", "noopener,noreferrer")}
          >
            Ver en Facebook &#8599;
          </Button>
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div style={{ padding: "1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
            No hay publicaciones recientes.
          </p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div style={{
          display: "flex", flexDirection: "column",
          gap: compact ? "0.5rem" : "0.75rem",
          padding: compact ? "0.75rem" : "1rem",
        }}>
          {visible.map((post) => (
            <FacebookPostCard key={post.id} post={post} />
          ))}

          <Button
            variant="secondary"
            size="sm"
            style={{ alignSelf: "center", marginTop: "0.25rem" }}
            onClick={() => window.open(FB_PAGE_URL, "_blank", "noopener,noreferrer")}
          >
            Ver más en Facebook &#8599;
          </Button>
        </div>
      )}
    </div>
  )
}
