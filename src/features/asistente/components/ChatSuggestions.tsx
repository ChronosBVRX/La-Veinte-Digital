"use client"

import { Scale, BookOpen, Sparkles, type LucideIcon } from "lucide-react"

const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Scale, text: "¿Cuáles son mis derechos laborales?" },
  { icon: BookOpen, text: "Háblame de mis vacaciones" },
  { icon: Sparkles, text: "¿Qué dice el CCT sobre aguinaldo?" },
]

interface ChatSuggestionsProps {
  onSelect: (text: string) => void
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="chat-suggestions-scroll" style={{ marginBottom: "0.5rem" }} aria-label="Sugerencias">
      {SUGGESTIONS.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.text)}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.45rem 0.75rem", borderRadius: "999px",
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--fg)", fontSize: "0.78rem", cursor: "pointer",
            transition: "all 0.15s", minHeight: 32, flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--accent)" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)" }}
        >
          <s.icon size={14} />
          {s.text}
        </button>
      ))}
    </div>
  )
}
