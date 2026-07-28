"use client"

export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: "0.875rem" }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border)",
        borderTopColor: "var(--primary)", animation: "spin 0.6s linear infinite",
        margin: "0 auto 0.5rem",
      }} />
      {text ?? "Cargando..."}
    </div>
  )
}
