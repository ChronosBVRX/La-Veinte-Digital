"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Sparkle, PaperPlaneRight } from "@phosphor-icons/react"
import { useChat } from "../hooks/useChat"
import { ChatMessage } from "./ChatMessage"
import { ChatSuggestions } from "./ChatSuggestions"
import { TypingIndicator } from "./TypingIndicator"
import Link from "next/link"

const INITIAL_MESSAGE = `¡Hola! 👋 Soy tu **asistente laboral**. Pregúntame sobre el **CCT**, **Estatutos**, vacaciones, aguinaldo o cualquier duda laboral.`

const HELP_HINT = `Puedo ayudarte con el Contrato Colectivo, Estatutos SNTSS, prestaciones, vacaciones, aguinaldo, incapacidades y normativa laboral. Escribe tu pregunta como si me la contaras.`

export function ChatAssistant() {
  const { messages, input, setInput, loading, send, inputRef } = useChat([{ role: "assistant", content: INITIAL_MESSAGE }])
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(messages.length)

  useEffect(() => {
    // Autoscroll solo si ya estaba cerca del final (no interfiere si lee histórico)
    const el = scrollRef.current
    if (!el) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      return
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    const grew = messages.length > prevLenRef.current
    prevLenRef.current = messages.length
    if (grew && !nearBottom && messages.length > 2) return
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "0.65rem",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Sparkle size={22} color="white" weight="duotone" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Asistente laboral</h1>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "999px", padding: "0.15rem 0.5rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              CCT · Estatutos
            </span>
          </div>
          <details style={{ marginTop: "0.2rem" }}>
            <summary style={{ fontSize: "0.75rem", color: "var(--primary)", cursor: "pointer", fontWeight: 600, listStyle: "none" }}>¿Qué puedo consultar? ▾</summary>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.35rem 0 0", lineHeight: 1.5 }}>{HELP_HINT}</p>
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
              Respuestas orientativas con IA; verifica con las fuentes oficiales.{" "}
              <Link href="/informacion-y-fuentes" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                Información y fuentes
              </Link>
            </p>
          </details>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "0.875rem", marginBottom: "0.625rem",
          display: "flex", flexDirection: "column", gap: "0.625rem",
        } as React.CSSProperties}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} onChip={(t) => send(t)} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <ChatSuggestions onSelect={(text) => send(text)} />
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        className="chat-composer"
        style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexShrink: 0 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            disabled={loading}
            placeholder="Escribe tu pregunta..."
            rows={1}
            style={{
              width: "100%", minHeight: 44, maxHeight: 110, resize: "none",
              padding: "0.7rem 0.85rem", borderRadius: "0.75rem",
              border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)",
              fontSize: "16px", fontFamily: "inherit", lineHeight: 1.4, outline: "none",
            }}
            aria-label="Mensaje"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          loading={loading}
          size="md"
          aria-label="Enviar pregunta"
          style={{ height: 44, width: 44, padding: 0, borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, flexShrink: 0 }}
        >
          <PaperPlaneRight size={20} weight="bold" />
        </Button>
      </form>
    </div>
  )
}
