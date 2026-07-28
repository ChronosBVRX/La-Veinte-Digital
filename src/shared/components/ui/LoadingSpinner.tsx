"use client"

export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: "0.875rem" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid var(--border)",
        borderTopColor: "var(--primary)",
        borderBottomColor: "var(--primary)",
        animation: "spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        margin: "0 auto 0.75rem",
      }} />
      {text && <span>{text}</span>}
    </div>
  )
}
