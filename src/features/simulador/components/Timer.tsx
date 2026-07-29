"use client"

import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"

interface TimerProps {
  duration: number
  resetKey: number
  onTimeUp: () => void
}

export function Timer({ duration, resetKey, onTimeUp }: TimerProps) {
  const [remaining, setRemaining] = useState(duration)
  const triggeredRef = useRef(false)
  const onTimeUpRef = useRef(onTimeUp)

  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  })

  useEffect(() => {
    triggeredRef.current = false

    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          if (!triggeredRef.current) {
            triggeredRef.current = true
            onTimeUpRef.current()
          }
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
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.375rem 0.75rem",
      background: isLow ? "#fef2f2" : "var(--accent)",
      borderRadius: "2rem",
      transition: "background 0.3s ease",
    }}>
      <Clock size={14} style={{ color: getColor(), transition: "color 0.3s ease" }} />
      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: getColor(),
          borderRadius: 2,
          transition: "width 1s linear, background 0.5s ease",
        }} />
      </div>
      <span style={{
        fontSize: "0.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
        color: getColor(), minWidth: "2ch", textAlign: "right",
        transition: "color 0.3s ease",
      }}>
        {remaining}s
      </span>
    </div>
  )
}
