import type { ReactNode } from "react"

interface AvatarProps {
  icon?: ReactNode
  size?: number
  gradient?: string
}

export function Avatar({ icon, size = 32, gradient = "linear-gradient(135deg, var(--primary), #6366f1)" }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: gradient, display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      transition: "transform var(--transition), box-shadow var(--transition)",
    }}>
      {icon}
    </div>
  )
}
