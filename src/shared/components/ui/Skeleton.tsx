import type { CSSProperties } from "react"

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  radius?: "sm" | "md" | "lg" | "pill"
  style?: CSSProperties
}

const radiusMap: Record<string, string> = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  pill: "var(--radius-pill)",
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius,
  radius,
  style,
}: SkeletonProps) {
  const resolvedRadius = borderRadius ?? (radius ? radiusMap[radius] : "var(--radius-sm)")

  return (
    <div
      aria-hidden="true"
      className="skeleton-pulse"
      style={{ width, height, borderRadius: resolvedRadius, ...style }}
    />
  )
}

interface SkeletonTextProps {
  lines?: number
  width?: string
}

export function SkeletonText({ lines = 3, width = "100%" }: SkeletonTextProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1
        return (
          <Skeleton
            key={i}
            width={isLast ? "60%" : width}
            height="0.875rem"
          />
        )
      })}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "1.25rem",
      }}
    >
      <Skeleton width="60%" height="0.875rem" style={{ marginBottom: "0.75rem" }} />
      <Skeleton height="1.75rem" width="40%" style={{ marginBottom: "0.5rem" }} />
      <Skeleton height="0.75rem" width="80%" />
    </div>
  )
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
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
