"use client"

import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/shared/lib/ui/cn"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ActionLinkProps {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "0.375rem 0.75rem", minHeight: "var(--control-sm, 36px)", fontSize: "var(--text-sm, 0.8125rem)" },
  md: { padding: "0.5rem 1rem", minHeight: "var(--control-md, 44px)", fontSize: "0.875rem" },
  lg: { padding: "0.625rem 1.25rem", minHeight: "var(--control-lg, 52px)", fontSize: "1rem" },
}

function variantBase(v: ButtonVariant): CSSProperties {
  switch (v) {
    case "primary":
      return { background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-fg)" }
    case "secondary":
      return { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--fg)" }
    case "outline":
      return { background: "transparent", borderColor: "var(--border)", color: "var(--fg)" }
    case "ghost":
      return { background: "transparent", borderColor: "transparent", color: "var(--fg)" }
    case "danger":
      return { background: "var(--error)", borderColor: "var(--error)", color: "#ffffff" }
  }
}

export function ActionLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  leadingIcon,
  trailingIcon,
  children,
  className,
  style,
}: ActionLinkProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    border: "1px solid transparent",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
    textDecoration: "none",
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    textAlign: "center",
    lineHeight: 1.3,
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    width: fullWidth ? "100%" : undefined,
    ...sizeStyles[size],
    ...variantBase(variant),
    ...style,
  }

  return (
    <Link href={href} className={cn(className)} style={base}>
      {leadingIcon && <span style={{ display: "inline-flex", flexShrink: 0 }}>{leadingIcon}</span>}
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
      {trailingIcon && <span style={{ display: "inline-flex", flexShrink: 0 }}>{trailingIcon}</span>}
    </Link>
  )
}
