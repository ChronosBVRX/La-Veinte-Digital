"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md"
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = "primary", size = "md", loading, children, style, disabled, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: size === "sm" ? "0.375rem 0.75rem" : "0.5rem 1.25rem",
    background: variant === "primary" ? "var(--primary)" : variant === "secondary" ? "var(--accent)" : "transparent",
    color: variant === "primary" ? "var(--primary-fg)" : "var(--fg)",
    border: variant === "ghost" ? "none" : `1px solid ${variant === "primary" ? "transparent" : "var(--border)"}`,
    borderRadius: "0.5rem",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    transition: "all 0.15s",
    ...style,
  }

  return (
    <button style={base} disabled={disabled || loading} {...props}>
      {children}
    </button>
  )
}
