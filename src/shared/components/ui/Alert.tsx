"use client"

import type { ReactNode } from "react"
import { Info, SealCheck, Warning, X } from "@phosphor-icons/react"
import { cn } from "@/shared/lib/ui/cn"

type AlertVariant = "info" | "success" | "warning" | "error"

interface AlertProps {
  variant: AlertVariant
  title?: string
  children: ReactNode
  action?: ReactNode
  dismissible?: boolean
  onDismiss?: () => void
}

const config: Record<AlertVariant, { Icon: typeof Info; bg: string; fg: string; border: string }> = {
  info: { Icon: Info, bg: "var(--state-info-bg)", fg: "var(--state-info-fg)", border: "var(--state-info-fg)" },
  success: { Icon: SealCheck, bg: "var(--state-success-bg)", fg: "var(--state-success-fg)", border: "var(--state-success-fg)" },
  warning: { Icon: Warning, bg: "var(--state-warning-bg)", fg: "var(--state-warning-fg)", border: "var(--state-warning-fg)" },
  error: { Icon: X, bg: "var(--state-error-bg)", fg: "var(--state-error-fg)", border: "var(--state-error-fg)" },
}

export function Alert({ variant, title, children, action, dismissible, onDismiss }: AlertProps) {
  const { Icon, bg, fg, border } = config[variant]

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: "0.75rem",
        padding: "1rem",
        borderRadius: "var(--radius-md)",
        background: bg,
        borderLeft: `4px solid ${border}`,
        position: "relative",
      }}
    >
      <Icon
        size={20}
        weight="fill"
        style={{ color: fg, flexShrink: 0, marginTop: "0.125rem" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: fg, marginBottom: "0.25rem" }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: "var(--text-sm)", color: fg, lineHeight: 1.5 }}>
          {children}
        </div>
        {action && (
          <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
            {action}
          </div>
        )}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "var(--radius-sm)",
            color: fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1" }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6" }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
