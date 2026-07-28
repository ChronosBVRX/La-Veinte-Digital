import type { ReactNode, CSSProperties } from "react"

interface BadgeProps {
  children: ReactNode
  variant?: "default" | "success" | "warning" | "error" | "info"
  size?: "sm" | "md"
  style?: CSSProperties
}

const variantStyles: Record<string, CSSProperties> = {
  default: { background: "var(--accent)", color: "var(--muted)" },
  success: { background: "#f0fdf4", color: "var(--success)" },
  warning: { background: "#fffbeb", color: "var(--warning)" },
  error: { background: "#fef2f2", color: "var(--error)" },
  info: { background: "#eff6ff", color: "var(--info)" },
}

export function Badge({ children, variant = "default", size = "sm", style }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: size === "sm" ? "0.125rem 0.5rem" : "0.25rem 0.625rem",
        fontSize: size === "sm" ? "0.75rem" : "0.8125rem",
        fontWeight: 600,
        borderRadius: "9999px",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
