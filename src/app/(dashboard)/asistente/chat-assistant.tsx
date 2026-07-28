"use client"

import { useRef, useState, useEffect } from "react"
import Markdown from "react-markdown"
import { Send, Bot, User, MessageSquare, Scale, BookOpen, Sparkles } from "lucide-react"
import { consultarBot, type BotMessage } from "@/lib/services/bot"

const INITIAL_MESSAGE = `¡Hola! 👋 Soy tu **Asistente SNTSS**, tu aliado en temas laborales del IMSS.

Tengo acceso al **Contrato Colectivo de Trabajo** y a los **Estatutos del SNTSS** para orientarte sobre tus derechos, prestaciones y obligaciones.

¿En qué puedo ayudarte hoy? Puedes preguntarme sobre:
- 📅 **Vacaciones, aguinaldo y prestaciones**
- ⚖️ **Derechos y obligaciones laborales**
- 🏛️ **Estructura y funciones del sindicato**
- 📋 **Clausulas específicas del CCT**
- 🗳️ **Asambleas, elecciones y comités**`

const SUGGESTIONS = [
  { icon: Scale, text: "¿Cuáles son mis derechos laborales?" },
  { icon: BookOpen, text: "Háblame de mis vacaciones" },
  { icon: Sparkles, text: "¿Qué dice el CCT sobre aguinaldo?" },
]

export function ChatAssistant() {
  const [messages, setMessages] = useState<BotMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: BotMessage = { role: "user", content: msg }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput("")
    setLoading(true)

    try {
      const respuesta = await consultarBot(updatedHistory)
      setMessages((prev) => [...prev, { role: "assistant", content: respuesta }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ No pude conectar con el servidor. Verifica que el servicio esté activo e intenta de nuevo.",
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ height: "calc(100dvh - 56px - 3rem)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
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

      {/* Messages area */}
      <div style={{
        flex: 1, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem",
        display: "flex", flexDirection: "column", gap: "0.75rem",
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
              gap: "0.5rem",
              maxWidth: "85%",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: msg.role === "user"
                ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                : "linear-gradient(135deg, var(--primary), #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: "0.125rem",
            }}>
              {msg.role === "user"
                ? <User size={16} color="white" />
                : <Bot size={16} color="white" />
              }
            </div>

            {/* Message bubble */}
            <div style={{
              background: msg.role === "user" ? "var(--primary)" : "var(--accent)",
              color: msg.role === "user" ? "var(--primary-fg)" : "var(--fg)",
              borderRadius: msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
              padding: "0.625rem 0.875rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}>
              <div className="chat-markdown" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                <Markdown
                  components={{
                    strong: ({ children }) => <strong style={{ color: msg.role === "user" ? "inherit" : "var(--primary)" }}>{children}</strong>,
                    ul: ({ children }) => <ul style={{ margin: "0.375rem 0", paddingLeft: "1.25rem" }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: "0.375rem 0", paddingLeft: "1.25rem" }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginBottom: "0.25rem" }}>{children}</li>,
                    p: ({ children }) => <p style={{ margin: "0.375rem 0" }}>{children}</p>,
                  }}
                >
                  {msg.content}
                </Markdown>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", maxWidth: "85%" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, var(--primary), #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={16} color="white" />
            </div>
            <div style={{
              background: "var(--accent)", borderRadius: "1rem 1rem 1rem 0.25rem",
              padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.35rem",
            }}>
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)", animationDelay: "0s" }} />
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)", animationDelay: "0.15s" }} />
              <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)", animationDelay: "0.3s" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (show only on first message) */}
      {messages.length <= 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s.text)}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.4rem 0.75rem", borderRadius: "1rem",
                border: "1px solid var(--border)", background: "var(--card)",
                color: "var(--fg)", fontSize: "0.8rem", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--accent)" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)" }}
            >
              <s.icon size={14} />
              {s.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
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
            transition: "background 0.15s",
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
