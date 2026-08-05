"use client"

import type { ButtonHTMLAttributes, CSSProperties } from "react"
import { cn } from "@/shared/lib/ui/cn"

type IconButtonVariant = "ghost" | "outline" | "danger"
type IconButtonSize = "sm" | "md" | "lg"

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
}

const sizeStyles: Record<IconButtonSize, CSSProperties> = {
  sm: { width: "var(--control-sm)", height: "var(--control-sm)" },
  md: { width: "var(--control-md)", height: "var(--control-md)" },
  lg: { width: "var(--control-lg)", height: "var(--control-lg)" },
}

function variantBase(v: IconButtonVariant): CSSProperties {
  switch (v) {
    case "ghost":
      return { background: "transparent", borderColor: "transparent", color: "var(--fg)" }
    case "outline":
      return { background: "transparent", borderColor: "var(--border)", color: "var(--fg)" }
    case "danger":
      return { background: "var(--error)", borderColor: "var(--error)", color: "#ffffff" }
  }
}

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  children,
  className,
  style,
  disabled,
  type,
  ...props
}: IconButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "var(--radius)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all var(--transition)",
    flexShrink: 0,
    padding: 0,
    ...sizeStyles[size],
    ...variantBase(variant),
    ...style,
  }

  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      className={cn(className)}
      style={base}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
