"use client"

import type { FacebookPost } from "@/features/facebook/services/feed"

interface Props {
  post: FacebookPost
}

function formatNumber(n: number | null): string {
  if (n == null) return ""
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function FacebookPostCard({ post }: Props) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden",
    }}>
      {post.image && (
        <img
          src={post.image}
          alt=""
          style={{ width: "100%", height: "auto", display: "block", maxHeight: 300, objectFit: "cover" }}
        />
      )}

      {post.video && !post.image && (
        <div style={{
          width: "100%", height: 200, background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <span style={{ fontSize: "2rem" }}>{String.fromCodePoint(9654)}</span>
        </div>
      )}

      <div style={{ padding: "0.75rem" }}>
        {post.text && (
          <p style={{
            fontSize: "0.875rem", color: "var(--fg)", margin: "0 0 0.75rem",
            lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {post.text.length > 280 ? post.text.slice(0, 280) + "..." : post.text}
          </p>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: "1rem",
          fontSize: "0.75rem", color: "var(--muted)", flexWrap: "wrap",
        }}>
          <span>{timeAgo(post.time)}</span>

          {post.likes != null && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {String.fromCodePoint(10084)} {formatNumber(post.likes)}
            </span>
          )}

          {post.comments != null && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {String.fromCodePoint(128172)} {formatNumber(post.comments)}
            </span>
          )}

          {post.shares != null && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {String.fromCodePoint(8618)} {formatNumber(post.shares)}
            </span>
          )}

          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: "auto", color: "var(--primary)", textDecoration: "none",
                fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              Ver post {String.fromCodePoint(8599)}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
