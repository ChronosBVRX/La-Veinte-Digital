"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Clock, Pause } from "lucide-react"

interface TimerProps {
  duration: number
  resetKey: number
  running?: boolean
  onTimeUp: () => void
  onWarning60?: () => void
  onWarning30?: () => void
}

export function Timer({
  duration,
  resetKey,
  running = true,
  onTimeUp,
  onWarning60,
  onWarning30,
}: TimerProps) {
  const [remaining, setRemaining] = useState(duration)
  const [prevReset, setPrevReset] = useState({ resetKey, duration })
  const onTimeUpRef = useRef(onTimeUp)
  const onWarning60Ref = useRef(onWarning60)
  const onWarning30Ref = useRef(onWarning30)
  const warned60ForKey = useRef<number>(-1)
  const warned30ForKey = useRef<number>(-1)

  if (prevReset.resetKey !== resetKey || prevReset.duration !== duration) {
    setPrevReset({ resetKey, duration })
    setRemaining(duration)
  }

  useEffect(() => {
    onTimeUpRef.current = onTimeUp
    onWarning60Ref.current = onWarning60
    onWarning30Ref.current = onWarning30
  })

  useEffect(() => {
    if (!running) return

    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1
        if (next <= 60 && warned60ForKey.current !== resetKey) {
          warned60ForKey.current = resetKey
          onWarning60Ref.current?.()
        }
        if (next <= 30 && warned30ForKey.current !== resetKey) {
          warned30ForKey.current = resetKey
          onWarning30Ref.current?.()
        }
        if (next <= 0) {
          clearInterval(id)
          onTimeUpRef.current()
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(id)
  }, [running, resetKey])

  const pct = Math.max(0, Math.min(100, (remaining / duration) * 100))
  const isUrgent = remaining <= 30
  const isWarning = remaining <= 60

  const getColor = () => {
    if (!running) return "var(--muted)"
    if (isUrgent) return "#dc2626"
    if (isWarning) return "#f59e0b"
    return "var(--primary)"
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const timeFormatted = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`

  return (
    <motion.div
      animate={running && isUrgent ? { x: [0, -2, 2, -1, 1, 0] } : {}}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.75rem",
        background: isUrgent && running ? "#fef2f2" : isWarning && running ? "#fffbeb" : "var(--accent)",
        border: `1px solid ${isUrgent && running ? "#fecaca" : isWarning && running ? "#fde68a" : "var(--border)"}`,
        borderRadius: "2rem",
        transition: "all 0.3s ease",
      }}
    >
      <motion.div
        animate={running && isUrgent ? { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        {running ? (
          <Clock size={14} style={{ color: getColor(), transition: "color 0.3s ease" }} />
        ) : (
          <Pause size={14} style={{ color: "var(--muted)" }} />
        )}
      </motion.div>
      <div style={{ width: 64, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%`, background: getColor() }}
          transition={{ width: { duration: 1, ease: "linear" }, background: { duration: 0.3 } }}
          style={{ height: "100%", borderRadius: 2 }}
        />
      </div>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: getColor(),
          minWidth: "4.5ch",
          textAlign: "right",
          transition: "color 0.3s ease",
        }}
      >
        {timeFormatted}
      </span>
      {!running && (
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--muted)",
            fontWeight: 500,
            marginLeft: "0.125rem",
          }}
        >
          (Pausado)
        </span>
      )}
    </motion.div>
  )
}
