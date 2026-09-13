"use client"

import { motion } from "framer-motion"

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
  const isHigh = presion > 6

  return (
    <motion.div
      layout
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Presión
        </span>
        <motion.span
          animate={{ color, scale: isHigh ? [1, 1.1, 1] : 1 }}
          transition={{
            color: { duration: 0.3 },
            scale: isHigh ? { repeat: Infinity, duration: 0.8 } : { duration: 0.3 },
          }}
          style={{ fontSize: "0.75rem", fontWeight: 700 }}
        >
          {getLabel(presion)}
        </motion.span>
      </div>
      <div style={{
        width: "100%", height: 6, background: "var(--accent)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${pct}%`, background: color }}
          transition={{ width: { duration: 0.5, ease: "easeOut" }, background: { duration: 0.3 } }}
          style={{ height: "100%", borderRadius: 3 }}
        />
      </div>
    </motion.div>
  )
}
