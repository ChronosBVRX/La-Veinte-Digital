import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"

export default function FacebookPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>Noticias SNTSS</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
          Sección XX Michoacán y CEN SNTSS
        </p>
      </div>
      <FacebookFeeds />
    </div>
  )
}
