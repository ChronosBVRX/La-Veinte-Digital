"use client"

import { useState, type ReactNode } from "react"

export interface AvatarProps {
  src?: string | null
  alt?: string
  icon?: ReactNode
  size?: number
  gradient?: string
  className?: string
  style?: React.CSSProperties
}

export function Avatar({
  src,
  alt = "Avatar",
  icon,
  size = 32,
  gradient = "linear-gradient(135deg, var(--primary), #6366f1)",
  className,
  style,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  const hasImage = Boolean(src && !imageError)

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: hasImage ? "var(--card)" : gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        transition: "transform var(--transition), box-shadow var(--transition)",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Dynamic avatar from storage / url
        <img
          src={src!}
          alt={alt}
          onError={() => setImageError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            borderRadius: "50%",
          }}
        />
      ) : (
        icon
      )}
    </div>
  )
}
