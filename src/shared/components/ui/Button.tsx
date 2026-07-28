"use client"

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md"
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = "primary", size = "md", loading, children, style, disabled, ...props }: ButtonProps) {
  const base: CSSProperties = {
    padding: size === "sm" ? "0.375rem 0.75rem" : "0.5rem 1.25rem",
    background: variant === "primary" ? "var(--primary)" : variant === "secondary" ? "var(--accent)" : "transparent",
    color: variant === "primary" ? "var(--primary-fg)" : "var(--fg)",
    border: variant === "ghost" ? "none" : `1px solid ${variant === "primary" ? "transparent" : "var(--border)"}`,
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    transition: "all var(--transition)",
    ...style,
  }

  const hoverStyle: CSSProperties = variant === "ghost"
    ? { background: "var(--accent)" }
    : variant === "secondary"
    ? { background: "var(--border)" }
    : { boxShadow: "var(--shadow-md)" }

  return (
    <button
      style={base}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) Object.assign(e.currentTarget.style, hoverStyle)
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = base.background as string
          e.currentTarget.style.boxShadow = "none"
        }
      }}
      {...props}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, borderRadius: "50%",
          border: "2px solid currentColor",
          borderTopColor: "transparent",
          animation: "spin 0.6s linear infinite",
          display: "inline-block",
        }} />
      )}
      {children}
    </button>
  )
}
