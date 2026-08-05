import Link from "next/link"
import type { ReactNode } from "react"
import type { IconProps } from "@phosphor-icons/react"

interface DashboardStatProps {
  icon: React.ComponentType<IconProps & { size?: number; weight?: string }>
  title: string
  value: string
  subtitle?: string
  color: string
  actionLabel?: string
  actionHref?: string
  empty?: boolean
}

export function DashboardStat({
  icon: IconComponent,
  title,
  value,
  subtitle,
  color,
  actionLabel,
  actionHref,
  empty,
}: DashboardStatProps) {
  const content = (
    <>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius)",
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconComponent size={20} weight="fill" color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "block",
            marginBottom: "0.125rem",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: empty ? "var(--muted)" : "var(--fg)",
            display: "block",
            lineHeight: 1.3,
          }}
        >
          {value}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--muted)",
              display: "block",
              marginTop: "0.125rem",
            }}
          >
            {subtitle}
          </span>
        )}
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            style={{
              fontSize: "0.6875rem",
              color,
              fontWeight: 600,
              textDecoration: "none",
              marginTop: "0.25rem",
              display: "inline-block",
            }}
          >
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
    </>
  )

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        transition: "box-shadow var(--transition)",
      }}
      className="hover-lift"
    >
      {content}
    </div>
  )
}
