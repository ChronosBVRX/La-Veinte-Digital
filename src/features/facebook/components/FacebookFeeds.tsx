"use client"

import { useState, useEffect } from "react"
import { FacebookFeed } from "@/features/facebook/components/FacebookFeed"

interface Props {
  compact?: boolean
}

function FeedBox({ page, label, compact }: { page: "seccionxx" | "cen"; label: string; compact?: boolean }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        marginBottom: "0.75rem",
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "#1877F2", display: "flex", alignItems: "center",
          justifyContent: "center", color: "#fff", fontSize: "0.75rem",
          fontWeight: 700, flexShrink: 0,
        }}>f</span>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>
          {label}
        </h3>
      </div>
      <FacebookFeed compact={compact} page={page} label={label} />
    </div>
  )
}

export function FacebookFeeds({ compact }: Props) {
  const [wide, setWide] = useState(true)

  useEffect(() => {
    const check = () => setWide(window.innerWidth >= 768)
    check()
    addEventListener("resize", check)
    return () => removeEventListener("resize", check)
  }, [])

  if (!wide) {
    if (compact) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <FeedBox page="seccionxx" label="SNTSS Sección XX" compact />
          <FeedBox page="cen" label="SNTSS Nacional" compact />
        </div>
      )
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <details style={{
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          overflow: "visible", background: "var(--card)",
        }}>
          <summary style={{
            cursor: "pointer", padding: "0.875rem 1.25rem", fontWeight: 600,
            fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: "0.5rem",
            userSelect: "none",
          }}>
            <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
            SNTSS Sección XX
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
          </summary>
          <FacebookFeed page="seccionxx" label="SNTSS Sección XX" />
        </details>
        <details style={{
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          overflow: "visible", background: "var(--card)",
        }}>
          <summary style={{
            cursor: "pointer", padding: "0.875rem 1.25rem", fontWeight: 600,
            fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: "0.5rem",
            userSelect: "none",
          }}>
            <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
            SNTSS Nacional
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
          </summary>
          <FacebookFeed page="cen" label="SNTSS Nacional" />
        </details>
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
      <FeedBox page="seccionxx" label="SNTSS Sección XX" compact={compact} />
      <FeedBox page="cen" label="SNTSS Nacional" compact={compact} />
    </div>
  )
}
