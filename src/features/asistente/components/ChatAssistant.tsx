"use client"

import { useEffect, useRef } from "react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { Sparkle, PaperPlaneRight } from "@phosphor-icons/react"
import { useChat } from "../hooks/useChat"
import { ChatMessage } from "./ChatMessage"
import { ChatSuggestions } from "./ChatSuggestions"
import { TypingIndicator } from "./TypingIndicator"

const INITIAL_MESSAGE = `¡Hola! 👋 Soy tu **asistente laboral**, aquí para acompañarte.

Estoy para ayudarte a entender tus derechos y darte orientación sobre qué puedes hacer ante una situación en tu trabajo.

Puedes contarme qué te pasa con tus propias palabras, o preguntarme directamente sobre el **Contrato Colectivo**, los **Estatutos** o cualquier duda laboral.`

export function ChatAssistant() {
  const { messages, input, setInput, loading, send, inputRef } = useChat([{ role: "assistant", content: INITIAL_MESSAGE }])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  return (
    <div style={{ height: "calc(100dvh - var(--nav-height) - 3rem)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Sparkle size={24} color="white" weight="duotone" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Asistente laboral</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.125rem 0 0", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            Consulta información del CCT, Estatutos y normativa disponible.
          </p>
        </div>
      </div>

      <div style={{
        flex: 1, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem",
        display: "flex", flexDirection: "column", gap: "0.75rem",
      }}>
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
        style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
      >
        <div style={{ flex: 1 }}>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Pregunta sobre tus derechos laborales, CCT o Estatutos..."
            style={{ borderRadius: "0.75rem" }}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          loading={loading}
          size="md"
          aria-label="Enviar pregunta"
          style={{ height: 44, width: 44, padding: 0, borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44 }}
        >
          <PaperPlaneRight size={20} weight="bold" />
        </Button>
      </form>
    </div>
  )
}
