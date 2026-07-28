import type { CSSProperties } from "react"

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  style?: CSSProperties
}

export function Skeleton({ width = "100%", height = "1rem", borderRadius = "var(--radius-sm)", style }: SkeletonProps) {
  return (
    <div
      className="skeleton-pulse"
      style={{ width, height, borderRadius, ...style }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
      <Skeleton width="60%" height="0.875rem" style={{ marginBottom: "0.75rem" }} />
      <Skeleton height="1.75rem" width="40%" style={{ marginBottom: "0.5rem" }} />
      <Skeleton height="0.75rem" width="80%" />
    </div>
  )
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Skeleton width="2.5rem" height="2.5rem" borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height="0.875rem" style={{ marginBottom: "0.375rem" }} />
            <Skeleton width="40%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
