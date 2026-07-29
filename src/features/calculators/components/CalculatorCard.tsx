import Link from "next/link"
import type { LucideIcon } from "lucide-react"

interface CalculatorCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
  badge?: string
}

export function CalculatorCard({ href, title, description, icon: Icon, badge }: CalculatorCardProps) {
  return (
    <Link href={href} className="hover-lift" style={{
      textDecoration: "none", color: "inherit", background: "var(--card)",
      border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem",
      position: "relative",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: "0.75rem", background: "linear-gradient(135deg, var(--primary), #6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color="white" />
      </div>
      <div>
        <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>{description}</p>
      </div>
      {badge && (
        <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", fontSize: "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.125rem 0.375rem", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--muted)" }}>
          {badge}
        </span>
      )}
    </Link>
  )
}
