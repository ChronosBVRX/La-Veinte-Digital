"use client"

import { useState } from "react"
import Markdown from "react-markdown"
import { Bot, User } from "lucide-react"
import type { BotMessage } from "../services/bot"

interface ChatMessageProps {
  message: BotMessage
  onChip?: (text: string) => void
}

/** Punto 8: traducción clara del estado de vigencia. */
const VALIDITY_LABELS: Record<string, { label: string; color: string }> = {
  CURRENT: { label: "Vigente", color: "#16a34a" },
  PENDING_REVIEW: { label: "Vigencia en revisión", color: "#b45309" },
  HISTORICAL: { label: "Versión histórica", color: "#64748b" },
  SUPERSEDED: { label: "Sustituida", color: "#b45309" },
  UNKNOWN: { label: "Normativa vigente", color: "#64748b" },
}

/** Punto 7: número de fuentes visibles inicialmente (2-4). */
const FUENTES_INICIALES = 3

export function ChatMessage({ message, onChip }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const fuentes = !isUser ? (message.fuentes ?? []) : []
  const visibles = mostrarTodas ? fuentes : fuentes.slice(0, FUENTES_INICIALES)
  const chips = !isUser ? (message.chips ?? []) : []

  const avatarGradient = isUser
    ? "linear-gradient(135deg, #3b82f6, #2563eb)"
    : "linear-gradient(135deg, var(--primary), #6366f1)"

  const tipoLabel = (tipo?: string, numero?: string) =>
    numero ? `${tipo === "articulo" ? "Artículo" : tipo === "clausula" ? "Cláusula" : ""} ${numero}` : ""

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

        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.625rem" }}>
            {chips.map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChip?.(chip)}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.78rem",
                  color: "var(--primary)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {fuentes.length > 0 && (
          <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.375rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginBottom: "0.25rem" }}>
              📄 Fuentes consultadas
            </div>
            <ul style={{ listStyle: "none", margin: "0 0 0", padding: 0, display: "grid", gap: "0.3125rem" }}>
              {visibles.map((f, i) => {
                const vinfo = VALIDITY_LABELS[f.validity ?? ""] ?? VALIDITY_LABELS.UNKNOWN
                const advertencia = f.advertenciaVigencia ?? vinfo?.label
                const numero = tipoLabel(f.tipo, f.numero)
                return (
                  <li key={f.id ?? i} style={{ fontSize: "0.75rem", lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 600 }}>{f.documento}</span>
                    {numero ? ` — ${numero}` : ""}
                    {f.paginaInicio != null ? ` · pág. ${f.paginaInicio}` : ""}
                    {advertencia && <span style={{ color: vinfo?.color ?? "var(--muted)" }}> · {advertencia}</span>}
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
            {fuentes.length > FUENTES_INICIALES && (
              <button
                type="button"
                onClick={() => setMostrarTodas((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.25rem 0 0",
                  color: "var(--primary)",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {mostrarTodas ? "▲ Ocultar fuentes" : `Ver todas las fuentes (${fuentes.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
