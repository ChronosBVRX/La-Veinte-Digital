"use client"

import { useState } from "react"
import Markdown from "react-markdown"
import { Bot, User } from "lucide-react"
import type { BotMessage } from "../services/bot"

interface ChatMessageProps {
  message: BotMessage
}

const VALIDITY_LABELS: Record<string, string> = {
  CURRENT: "",
  PENDING_REVIEW: "⚠ vigencia por revisar",
  UNKNOWN: "vigencia sin confirmar",
  HISTORICAL: "histórico",
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [showFuentes, setShowFuentes] = useState(false)
  const fuentes = !isUser ? (message.fuentes ?? []) : []

  const avatarGradient = isUser
    ? "linear-gradient(135deg, #3b82f6, #2563eb)"
    : "linear-gradient(135deg, var(--primary), #6366f1)"

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start",
      gap: "0.5rem",
      maxWidth: "85%",
      alignSelf: isUser ? "flex-end" : "flex-start",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: avatarGradient, display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: "0.125rem",
      }}>
        {isUser ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
      </div>

      <div style={{
        background: isUser ? "var(--primary)" : "var(--accent)",
        color: isUser ? "var(--primary-fg)" : "var(--fg)",
        borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
        padding: "0.625rem 0.875rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}>
        <div className="chat-markdown" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
          <Markdown
            components={{
              strong: ({ children }) => <strong style={{ color: isUser ? "inherit" : "var(--primary)" }}>{children}</strong>,
              ul: ({ children }) => <ul style={{ margin: "0.375rem 0", paddingLeft: "1.25rem" }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: "0.375rem 0", paddingLeft: "1.25rem" }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: "0.25rem" }}>{children}</li>,
              p: ({ children }) => <p style={{ margin: "0.375rem 0" }}>{children}</p>,
            }}
          >
            {message.content}
          </Markdown>
        </div>

        {fuentes.length > 0 && (
          <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.375rem" }}>
            <button
              type="button"
              onClick={() => setShowFuentes((v) => !v)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--muted)",
                fontSize: "0.75rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              📄 Fuentes verificadas ({fuentes.length}) {showFuentes ? "▲" : "▼"}
            </button>
            {showFuentes && (
              <ul style={{ listStyle: "none", margin: "0.375rem 0 0", padding: 0, display: "grid", gap: "0.3125rem" }}>
                {fuentes.map((f, i) => {
                  const advertencia = f.advertenciaVigencia ?? VALIDITY_LABELS[f.validity ?? ""] ?? ""
                  return (
                    <li key={f.id ?? i} style={{ fontSize: "0.75rem", lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600 }}>{f.documento}</span>
                      {f.numero ? ` — ${f.tipo === "articulo" ? "Artículo" : f.tipo === "clausula" ? "Cláusula" : ""} ${f.numero}` : ""}
                      {f.paginaInicio != null ? ` · pág. ${f.paginaInicio}` : ""}
                      {advertencia && <span style={{ color: "#b45309" }}> · {advertencia}</span>}
                      {f.sourceUrl && (
                        <>
                          {" "}
                          <a
                            href={f.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--primary)" }}
                          >
                            [Ver fuente]
                          </a>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
