"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Flag, Loader, BookOpen, AlertTriangle, RotateCcw } from "lucide-react"
import { InquisitorAvatar } from "./InquisitorAvatar"
import { StressMeter } from "./StressMeter"
import { Timer } from "./Timer"
import { Button } from "@/shared/components/ui/Button"
import type { SimMessage, InquisitorState } from "../services/bot"
import type { SimulationStatus } from "../hooks/useSimulation"

interface SimulationChatProps {
  messages: SimMessage[]
  loading: boolean
  status?: SimulationStatus
  timerDuration?: number
  error: string | null
  difficulty: 1 | 2
  onStartResponding?: () => void
  onSend: (text: string) => void
  onRetry?: (text: string) => void
  onFinish: () => void
}

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

export function SimulationChat({
  messages,
  loading,
  status = "reading",
  timerDuration: propTimerDuration,
  error,
  difficulty,
  onStartResponding,
  onSend,
  onRetry,
  onFinish,
}: SimulationChatProps) {
  const [input, setInput] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [warningNotice, setWarningNotice] = useState<string | null>(null)
  const [prevTimerKey, setPrevTimerKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant")
  const currentPresion = lastAssistantMsg?.presion ?? 1
  const currentEstado = lastAssistantMsg?.estado ?? ("neutral" as InquisitorState)
  
  // Tiempos humanos: 3 min (180s) para nivel 2 / presión, 5 min (300s) para nivel 1
  const duration = propTimerDuration ?? (difficulty === 2 ? 180 : 300)
  const timerKey = messages.filter((m) => m.role === "assistant" && m.content !== "...").length

  if (prevTimerKey !== timerKey) {
    setPrevTimerKey(timerKey)
    setWarningNotice(null)
  }

  const isResponding = status === "responding"
  const isReading = status === "reading" || status === "question_ready"
  const isPreparing = status === "inquisitor_preparing" || status === "connecting" || loading

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, status])

  const handleStartResponding = useCallback(() => {
    onStartResponding?.()
    inputRef.current?.focus()
  }, [onStartResponding])

  const handleInputChange = (val: string) => {
    setInput(val)
    if (isReading && val.trim().length > 0) {
      onStartResponding?.()
    }
  }

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isPreparing) return
    setWarningNotice(null)
    onSend(input.trim())
    setInput("")
    inputRef.current?.focus()
  }, [input, isPreparing, onSend])

  const handleTimeUp = useCallback(() => {
    if (isPreparing) return
    setWarningNotice("⏱️ El tiempo concedido ha concluido. Conservamos tu texto intacto para que puedas revisarlo y enviarlo cuando estés listo.")
  }, [isPreparing])

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry(input.trim())
    } else {
      onSend(input.trim())
    }
  }, [onRetry, onSend, input])

  const confirmFinish = () => {
    setShowConfirm(false)
    onFinish()
  }

  return (
    <div style={{
      height: "100%",
      minHeight: 0,
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
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
            duration={duration}
            resetKey={timerKey}
            running={isResponding}
            onTimeUp={handleTimeUp}
            onWarning60={() => setWarningNotice("⏱️ Te quedan 60 segundos para concluir tu comparecencia.")}
            onWarning30={() => setWarningNotice("⚠️ Te quedan 30 segundos. Concluye tu declaración y presiona Enviar.")}
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

      {/* Avisos de tiempo a los 60s / 30s */}
      <AnimatePresence>
        {warningNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              padding: "0.5rem 0.875rem",
              borderRadius: "0.5rem",
              background: warningNotice.includes("30") ? "#fef2f2" : "#fffbeb",
              border: `1px solid ${warningNotice.includes("30") ? "#fecaca" : "#fde68a"}`,
              fontSize: "0.8125rem",
              color: warningNotice.includes("30") ? "#991b1b" : "#92400e",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{warningNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error recuperable con botón de reintento */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "0.625rem 0.875rem", borderRadius: "0.5rem",
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "0.8125rem", color: "#991b1b", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangle size={16} />
              <span>{error} (Tu texto redactado se encuentra a salvo).</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              style={{ flexShrink: 0 }}
            >
              <RotateCcw size={13} style={{ marginRight: 4 }} />
              Reintentar
            </Button>
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
        {isPreparing && (
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
              Lic. Mendoza formulando pregunta...
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barra de estado / Llamado a la acción de lectura vs responder */}
      {isReading && !isPreparing && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            <BookOpen size={16} style={{ color: "var(--primary)" }} />
            <span>Fase de lectura pausada. Analiza la acusación y tus derechos.</span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleStartResponding}
          >
            Comenzar respuesta
          </Button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (isReading) onStartResponding?.()
          }}
          disabled={isPreparing}
          placeholder={isReading ? "Haz clic aquí o en 'Comenzar respuesta' para activar el reloj y redactar..." : "Escribe tu comparecencia o respuesta formal..."}
          style={{
            flex: 1, padding: "0.75rem 1rem",
            border: `1px solid ${isResponding ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "0.75rem",
            fontSize: "0.875rem", outline: "none",
            background: "var(--card)",
            color: "var(--fg)",
            transition: "border-color var(--transition), box-shadow var(--transition)",
          }}
        />
        <motion.button
          type="submit"
          disabled={isPreparing || !input.trim()}
          whileHover={!isPreparing && input.trim() ? { scale: 1.05 } : {}}
          whileTap={!isPreparing && input.trim() ? { scale: 0.95 } : {}}
          style={{
            width: 44, height: 44,
            background: isPreparing || !input.trim() ? "var(--border)" : "var(--primary)",
            color: "var(--primary-fg)", border: "none",
            borderRadius: "0.75rem", cursor: isPreparing || !input.trim() ? "not-allowed" : "pointer",
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
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowConfirm(false)}
                >
                  Seguir en la simulación
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={confirmFinish}
                >
                  Sí, finalizar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
