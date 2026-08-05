"use client"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
}

const sizeMap: Record<string, number> = {
  sm: 16,
  md: 32,
  lg: 48,
}

export function Spinner({ size = "md", text }: SpinnerProps) {
  const px = sizeMap[size]
  const borderWidth = size === "sm" ? 2 : 3

  return (
    <div
      role="status"
      aria-label={text ?? "Cargando"}
      style={{ textAlign: "center", padding: "0.5rem" }}
    >
      <div
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          border: `${borderWidth}px solid var(--border)`,
          borderTopColor: "var(--primary)",
          animation: "spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          margin: "0 auto",
        }}
      />
      {text && (
        <span
          style={{
            display: "block",
            marginTop: "0.5rem",
            fontSize: "var(--text-sm)",
            color: "var(--muted)",
          }}
        >
          {text}
        </span>
      )}
    </div>
  )
}
