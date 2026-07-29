"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Flag, Loader } from "lucide-react"
import { InquisitorAvatar } from "./InquisitorAvatar"
import { StressMeter } from "./StressMeter"
import { Timer } from "./Timer"
import type { SimMessage, InquisitorState } from "../services/bot"

interface SimulationChatProps {
  messages: SimMessage[]
  loading: boolean
  error: string | null
  difficulty: 1 | 2
  onSend: (text: string) => void
  onFinish: () => void
}

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

export function SimulationChat({ messages, loading, error, difficulty, onSend, onFinish }: SimulationChatProps) {
  const [input, setInput] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant")
  const currentPresion = lastAssistantMsg?.presion ?? 1
  const currentEstado = lastAssistantMsg?.estado ?? ("neutral" as InquisitorState)
  const timerDuration = difficulty === 2 ? 30 : 45
  const timerKey = messages.filter((m) => m.role === "assistant" && m.content !== "...").length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    onSend(input.trim())
    setInput("")
    inputRef.current?.focus()
  }, [input, loading, onSend])

  const handleTimeUp = useCallback(() => {
    if (!loading) {
      onSend("(Silencio - no responde)")
    }
  }, [loading, onSend])

  const confirmFinish = () => {
    setShowConfirm(false)
    onFinish()
  }

  return (
    <div style={{
      height: "calc(100dvh - var(--nav-height) - 3rem)",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex", alignItems: "center", gap: "1rem",
          padding: "0.75rem", background: "var(--card)",
          border: "1px solid var(--border)", borderRadius: "0.75rem",
        }}
      >
        <InquisitorAvatar estado={currentEstado} size={56} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <StressMeter presion={currentPresion} />
          <Timer
            key={timerKey}
            duration={timerDuration}
            resetKey={timerKey}
            onTimeUp={handleTimeUp}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowConfirm(true)}
          style={{
            padding: "0.5rem 1rem", borderRadius: "0.5rem",
            border: "1px solid var(--border)", background: "var(--card)",
            cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem",
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontWeight: 500, transition: "all var(--transition)",
          }}
        >
          <Flag size={14} />
          Finalizar
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "0.8125rem", color: "#991b1b", overflow: "hidden",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        flex: 1, overflow: "auto",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.75rem",
      }}>
        <AnimatePresence>
          {messages.map((msg, i) => {
            if (msg.content === "..." && i === 0) return null
            const isUser = msg.role === "user"
            return (
              <motion.div
                key={i}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "80%",
                  padding: "0.75rem 1rem",
                  borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                  background: isUser ? "var(--primary)" : "var(--accent)",
                  color: isUser ? "var(--primary-fg)" : "var(--fg)",
                  fontSize: "0.875rem", lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", justifyContent: "flex-start" }}
          >
            <div style={{
              padding: "0.75rem 1rem", borderRadius: "1rem 1rem 1rem 0.25rem",
              background: "var(--accent)", fontSize: "0.875rem",
              display: "flex", alignItems: "center", gap: "0.5rem",
              color: "var(--muted)",
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Loader size={14} />
              </motion.div>
              Escribiendo...
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Escribe tu respuesta..."
          style={{
            flex: 1, padding: "0.75rem 1rem",
            border: "1px solid var(--border)", borderRadius: "0.75rem",
            fontSize: "0.875rem", outline: "none",
            transition: "border-color var(--transition), box-shadow var(--transition)",
          }}
        />
        <motion.button
          type="submit"
          disabled={loading || !input.trim()}
          whileHover={!loading && input.trim() ? { scale: 1.05 } : {}}
          whileTap={!loading && input.trim() ? { scale: 0.95 } : {}}
          style={{
            width: 44, height: 44,
            background: loading || !input.trim() ? "var(--border)" : "var(--primary)",
            color: "var(--primary-fg)", border: "none",
            borderRadius: "0.75rem", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background var(--transition)",
          }}
        >
          <Send size={18} />
        </motion.button>
      </form>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1rem",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                background: "var(--card)", borderRadius: "1rem",
                padding: "1.5rem", maxWidth: 380, width: "100%",
                display: "flex", flexDirection: "column", gap: "1rem",
                textAlign: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
                ¿Finalizar simulación?
              </h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Se generará un reporte de desempeño con retroalimentación sobre tu actuación.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowConfirm(false)}
                  style={{
                    padding: "0.625rem 1.25rem", borderRadius: "0.5rem",
                    border: "1px solid var(--border)", background: "var(--card)",
                    cursor: "pointer", color: "var(--fg)", fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  Seguir en la simulación
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmFinish}
                  style={{
                    padding: "0.625rem 1.25rem", borderRadius: "0.5rem",
                    border: "none", background: "var(--primary)",
                    cursor: "pointer", color: "var(--primary-fg)", fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  Sí, finalizar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
