"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Clock } from "lucide-react"

interface TimerProps {
  duration: number
  resetKey: number
  onTimeUp: () => void
}

export function Timer({ duration, resetKey, onTimeUp }: TimerProps) {
  const [remaining, setRemaining] = useState(duration)
  const onTimeUpRef = useRef(onTimeUp)

  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  })

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          onTimeUpRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [resetKey])

  const pct = (remaining / duration) * 100
  const isLow = remaining <= 10

  const getColor = () => {
    if (remaining <= 5) return "#dc2626"
    if (remaining <= 10) return "#f59e0b"
    return "var(--muted)"
  }

  return (
    <motion.div
      animate={remaining <= 5 ? { x: [0, -3, 3, -2, 2, 0] } : {}}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.375rem 0.75rem",
        background: isLow ? "#fef2f2" : "var(--accent)",
        borderRadius: "2rem",
        transition: "background 0.3s ease",
      }}
    >
      <motion.div
        animate={remaining <= 5 ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        <Clock size={14} style={{ color: getColor(), transition: "color 0.3s ease" }} />
      </motion.div>
      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%`, background: getColor() }}
          transition={{ width: { duration: 1, ease: "linear" }, background: { duration: 0.3 } }}
          style={{ height: "100%", borderRadius: 2 }}
        />
      </div>
      <motion.span
        animate={remaining <= 5 ? { scale: [1, 1.15, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.6 }}
        style={{
          fontSize: "0.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
          color: getColor(), minWidth: "2ch", textAlign: "right",
          transition: "color 0.3s ease",
        }}
      >
        {remaining}s
      </motion.span>
    </motion.div>
  )
}
