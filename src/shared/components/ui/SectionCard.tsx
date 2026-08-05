import type { ReactNode } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/Card"

interface SectionCardProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
}: SectionCardProps) {
  return (
    <Card variant="default">
      <CardHeader
        style={{
          display: "flex",
          alignItems: action ? "center" : "flex-start",
          justifyContent: action ? "space-between" : "flex-start",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            minWidth: 0,
            flex: 1,
          }}
        >
          {icon && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "0.125rem",
                color: "var(--muted)",
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {action && (
          <div style={{ flexShrink: 0 }}>{action}</div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
