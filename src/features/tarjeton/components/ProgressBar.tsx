"use client"

interface ProgressBarProps {
  progress: number
  label: string
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--muted)" }}>
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div style={{
        height: 8,
        borderRadius: 999,
        background: "var(--accent)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--primary)",
          borderRadius: 999,
          transition: "width 0.25s ease",
        }} />
      </div>
    </div>
  )
}
