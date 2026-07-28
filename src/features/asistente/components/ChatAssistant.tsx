"use client"

import { useEffect, useRef } from "react"
import { MessageSquare, Send } from "lucide-react"
import { useChat } from "../hooks/useChat"
import { ChatMessage } from "./ChatMessage"
import { ChatSuggestions } from "./ChatSuggestions"
import { TypingIndicator } from "./TypingIndicator"

const INITIAL_MESSAGE = `¡Hola! 👋 Soy tu **Asistente SNTSS**, tu aliado en temas laborales del IMSS.

Tengo acceso al **Contrato Colectivo de Trabajo** y a los **Estatutos del SNTSS** para orientarte sobre tus derechos, prestaciones y obligaciones.

¿En qué puedo ayudarte hoy? Puedes preguntarme sobre:
- 📅 **Vacaciones, aguinaldo y prestaciones**
- ⚖️ **Derechos y obligaciones laborales**
- 🏛️ **Estructura y funciones del sindicato**
- 📋 **Clausulas específicas del CCT**
- 🗳️ **Asambleas, elecciones y comités**`

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
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <MessageSquare size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Asistente SNTSS</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            CCT + Estatutos del Sindicato
          </p>
        </div>
      </div>

      <div style={{
        flex: 1, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem",
        display: "flex", flexDirection: "column", gap: "0.75rem",
      }}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <ChatSuggestions onSelect={(text) => send(text)} />
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Pregunta sobre el CCT o Estatutos del SNTSS..."
          style={{
            flex: 1, padding: "0.625rem 1rem",
            border: "1px solid var(--border)", borderRadius: "0.75rem",
            fontSize: "0.875rem", outline: "none",
            transition: "border-color var(--transition), box-shadow var(--transition)",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            width: 42, height: 42,
            background: loading || !input.trim() ? "var(--border)" : "var(--primary)",
            color: "var(--primary-fg)", border: "none",
            borderRadius: "0.75rem", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background var(--transition)",
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
