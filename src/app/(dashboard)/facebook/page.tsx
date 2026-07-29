import { FacebookFeed } from "@/features/facebook/components/FacebookFeed"

export default function FacebookPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>Facebook SNTSS</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
          Publicaciones recientes de la Secci&oacute;n XX Michoac&aacute;n
        </p>
      </div>
      <FacebookFeed />
    </div>
  )
}