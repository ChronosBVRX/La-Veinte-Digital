"use client"

interface StressMeterProps {
  presion: number
}

export function StressMeter({ presion }: StressMeterProps) {
  const pct = ((presion - 1) / 9) * 100

  const getColor = (p: number) => {
    if (p <= 3) return "#22c55e"
    if (p <= 6) return "#f59e0b"
    return "#dc2626"
  }

  const getLabel = (p: number) => {
    if (p <= 3) return "Baja"
    if (p <= 6) return "Moderada"
    return "Alta"
  }

  const color = getColor(presion)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Presión
        </span>
        <span style={{
          fontSize: "0.75rem", fontWeight: 700, color,
          transition: "color 0.3s ease",
        }}>
          {getLabel(presion)}
        </span>
      </div>
      <div style={{
        width: "100%", height: 6, background: "var(--accent)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.5s ease, background 0.5s ease",
        }} />
      </div>
    </div>
  )
}
