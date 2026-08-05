import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  secondaryAction?: ReactNode
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compact ? "1.5rem 1rem" : "2.5rem 1.5rem",
      }}
    >
      {icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            marginBottom: compact ? "0.75rem" : "1rem",
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: "var(--text-md)",
          fontWeight: 600,
          color: "var(--fg)",
          margin: 0,
          marginBottom: description ? "0.375rem" : "0",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--muted)",
            margin: 0,
            marginBottom: action || secondaryAction ? "1rem" : "0",
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
