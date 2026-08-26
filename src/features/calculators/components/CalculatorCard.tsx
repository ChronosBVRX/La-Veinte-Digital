import Link from "next/link"
import type { IconProps } from "@phosphor-icons/react"

interface CalculatorCardProps {
  href: string
  title: string
  description: string
  icon: React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>
  badge?: string
}

export function CalculatorCard({ href, title, description, icon: Icon, badge }: CalculatorCardProps) {
  return (
    <Link href={href} className="hover-lift pressable" style={{
      textDecoration: "none", color: "inherit", background: "var(--card)",
      border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem",
      position: "relative", minHeight: 120,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: "0.75rem", background: "linear-gradient(135deg, var(--primary), #6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={24} color="white" weight="duotone" />
      </div>
      <div>
        <p style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>{description}</p>
      </div>
      {badge && (
        <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--muted)" }}>
          {badge}
        </span>
      )}
    </Link>
  )
}
