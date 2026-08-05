import type { ReactNode } from "react"

interface DashboardSectionProps {
  title?: string
  children: ReactNode
  style?: React.CSSProperties
}

export function DashboardSection({ title, children, style }: DashboardSectionProps) {
  return (
    <section style={{ marginBottom: "1.5rem", ...style }}>
      {title && (
        <h2
          style={{
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "0 0 0.75rem",
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
