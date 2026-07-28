"use client"

export function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", maxWidth: "85%" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--primary), #6366f1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{
        background: "var(--accent)", borderRadius: "1rem 1rem 1rem 0.25rem",
        padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.35rem",
      }}>
        <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)" }} />
        <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)", animationDelay: "0.15s" }} />
        <span className="typing-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--muted)", animationDelay: "0.3s" }} />
      </div>
    </div>
  )
}
