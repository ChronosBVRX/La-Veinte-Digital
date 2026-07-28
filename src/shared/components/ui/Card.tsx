import type { ReactNode, CSSProperties } from "react"

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string
}

export function Card({ children, style, padding = "1.25rem" }: CardProps) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "0.5rem", padding, ...style,
    }}>
      {children}
    </div>
  )
}
