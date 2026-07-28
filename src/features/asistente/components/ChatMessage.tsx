"use client"

import Markdown from "react-markdown"
import { Bot, User } from "lucide-react"
import type { BotMessage } from "../services/bot"

interface ChatMessageProps {
  message: BotMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

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
      </div>
    </div>
  )
}
