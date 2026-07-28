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
  const chat = useChat([{ role: "assistant", content: INITIAL_MESSAGE }])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.messages, chat.loading])

  return (
    <div style={{ height: "calc(100dvh - 56px - 3rem)", display: "flex", flexDirection: "column" }}>
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
        {chat.messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {chat.loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {chat.messages.length <= 1 && (
        <ChatSuggestions onSelect={(text) => chat.send(text)} />
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); chat.send() }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          ref={chat.inputRef}
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          disabled={chat.loading}
          placeholder="Pregunta sobre el CCT o Estatutos del SNTSS..."
          style={{
            flex: 1, padding: "0.625rem 1rem",
            border: "1px solid var(--border)", borderRadius: "0.75rem",
            fontSize: "0.875rem", outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={chat.loading || !chat.input.trim()}
          style={{
            width: 42, height: 42,
            background: chat.loading || !chat.input.trim() ? "var(--border)" : "var(--primary)",
            color: "var(--primary-fg)", border: "none",
            borderRadius: "0.75rem", cursor: chat.loading || !chat.input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
