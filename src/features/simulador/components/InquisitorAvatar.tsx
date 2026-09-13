"use client"

import { motion } from "framer-motion"
import type { InquisitorState } from "../services/bot"

interface InquisitorAvatarProps {
  estado: InquisitorState
  size?: number
}

const EXPRESSIONS: Record<InquisitorState, { label: string; color: string }> = {
  neutral: { label: "Neutral", color: "var(--muted)" },
  inquisitivo: { label: "Indagando", color: "var(--primary)" },
  presionando: { label: "Presionando", color: "#dc2626" },
  desaprobando: { label: "Desaprobando", color: "#f59e0b" },
}

const EYE_STYLES: Record<InquisitorState, React.CSSProperties> = {
  neutral: { width: 6, height: 6, background: "var(--fg)" },
  inquisitivo: { width: 6, height: 6, background: "var(--primary)" },
  presionando: { width: 5, height: 7, background: "#dc2626", borderRadius: "40%" },
  desaprobando: { width: 5, height: 3, background: "#f59e0b", borderRadius: "10%" },
}

const MOUTH_STYLES: Record<InquisitorState, React.CSSProperties> = {
  neutral: { width: 12, height: 2, background: "var(--fg)", borderRadius: 1 },
  inquisitivo: { width: 10, height: 1, background: "var(--primary)" },
  presionando: { width: 8, height: 3, background: "#dc2626", borderRadius: "50%" },
  desaprobando: { width: 14, height: 2, background: "#f59e0b", borderRadius: 1, transform: "rotate(-5deg)" },
}

const GLOW_SHADOWS: Record<InquisitorState, string> = {
  neutral: "0 4px 12px rgba(0,0,0,0.2)",
  inquisitivo: "0 4px 16px rgba(37,99,235,0.35)",
  presionando: "0 4px 20px rgba(220,38,38,0.4)",
  desaprobando: "0 4px 16px rgba(245,158,11,0.35)",
}

export function InquisitorAvatar({ estado, size = 80 }: InquisitorAvatarProps) {
  const expr = EXPRESSIONS[estado] ?? EXPRESSIONS.neutral
  const eyeStyle = EYE_STYLES[estado] ?? EYE_STYLES.neutral
  const mouthStyle = MOUTH_STYLES[estado] ?? MOUTH_STYLES.neutral
  const glow = GLOW_SHADOWS[estado] ?? GLOW_SHADOWS.neutral

  return (
    <motion.div
      layout
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
    >
      <motion.div
        animate={{
          boxShadow: glow,
          scale: estado === "presionando" ? [1, 1.04, 1] : 1,
        }}
        transition={{
          boxShadow: { duration: 0.4 },
          scale: estado === "presionando" ? { repeat: Infinity, duration: 1.2 } : { duration: 0.3 },
        }}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: "linear-gradient(135deg, #1e293b, #334155)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "6px",
        }}>
          <div style={{ display: "flex", gap: estado === "presionando" ? "10px" : "14px", alignItems: "center", transition: "gap 0.3s ease" }}>
            <div style={{ ...eyeStyle, borderRadius: "50%", transition: "all 0.3s ease" }} />
            <div style={{ ...eyeStyle, borderRadius: "50%", transition: "all 0.3s ease" }} />
          </div>
          <div style={{ ...mouthStyle, transition: "all 0.3s ease" }} />
        </div>

        <div style={{
          position: "absolute", top: "32%", left: "15%", right: "15%",
          height: 0, borderTop: "1.5px solid rgba(255,255,255,0.2)",
        }} />
      </motion.div>

      <motion.span
        animate={{ color: expr.color }}
        transition={{ duration: 0.3 }}
        style={{
          fontSize: "0.8rem", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}
      >
        {expr.label}
      </motion.span>

      <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
        Lic. Mendoza
      </span>
    </motion.div>
  )
}
