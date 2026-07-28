import type { ReactNode, CSSProperties } from "react"

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string
}

export function Card({ children, style, padding = "1.25rem" }: CardProps) {
  return (
    <div className="hover-lift" style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding, ...style,
    }}>
      {children}
    </div>
  )
}
