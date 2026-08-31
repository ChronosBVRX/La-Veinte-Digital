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
    <Link href={href} className="hover-lift pressable calculator-card" style={{
      textDecoration: "none", color: "inherit", background: "var(--card)",
      border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: "1rem", display: "flex", flexDirection: "column", gap: "0.625rem",
      position: "relative", minHeight: 130, minWidth: 0, overflow: "hidden",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: "0.625rem", background: "linear-gradient(135deg, var(--primary), #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={22} color="white" weight="duotone" />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, lineHeight: 1.25, overflowWrap: "anywhere" }}>{title}</p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{description}</p>
      </div>
      {badge && (
        <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--muted)" }}>
          {badge}
        </span>
      )}
    </Link>
  )
}
