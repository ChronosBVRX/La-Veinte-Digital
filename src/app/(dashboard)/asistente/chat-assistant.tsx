"use client"

import { useRef, useState } from "react"
import { consultarBot, type BotMessage } from "@/lib/services/bot"

export function ChatAssistant() {
  const [messages, setMessages] = useState<BotMessage[]>([
    { role: "assistant", content: "¡Hola! Soy tu asistente experto en los **Estatutos del SNTSS**. Pregúntame lo que necesites sobre derechos sindicales, estructura del sindicato, asambleas, elecciones y más." },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: BotMessage = { role: "user", content: input.trim() }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput("")
    setLoading(true)

    try {
      const respuesta = await consultarBot(updatedHistory)
      setMessages((prev) => [...prev, { role: "assistant", content: respuesta }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: no pude conectar con el servidor. Asegúrate de que el bot esté corriendo.` }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  return (
    <div style={{ height: "calc(100dvh - 56px - 3rem)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Asistente SNTSS</h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
          Consulta los Estatutos del Sindicato Nacional de Trabajadores del Seguro Social
        </p>
      </div>

      <div style={{
        flex: 1, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem",
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              background: msg.role === "user" ? "var(--primary)" : "var(--accent)",
              color: msg.role === "user" ? "var(--primary-fg)" : "var(--fg)",
              borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.role !== "user" && (
              <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem", opacity: 0.8 }}>
                Bot SNTSS
              </div>
            )}
            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>{msg.content}</p>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", maxWidth: "80%", background: "var(--accent)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>Escribiendo...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Pregunta sobre los estatutos del SNTSS..."
          style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "0.5rem 1rem", background: "var(--primary)", color: "var(--primary-fg)",
            border: "none", borderRadius: "0.375rem", fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
