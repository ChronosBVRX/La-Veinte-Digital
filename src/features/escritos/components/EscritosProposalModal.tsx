"use client"

import { useEffect } from "react"
import { Button } from "@/shared/components/ui/Button"

interface EscritosProposalModalProps {
  open: boolean
  tituloAccion: string
  textoAnterior: string
  textoPropuesto: string
  onApply: () => void
  onDiscard: () => void
}

export function EscritosProposalModal({
  open,
  tituloAccion,
  textoAnterior,
  textoPropuesto,
  onApply,
  onDiscard,
}: EscritosProposalModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onDiscard()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onDiscard])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDiscard()
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "1rem",
          maxWidth: 680,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              id="proposal-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}
            >
              Propuesta de mejora: {tituloAccion}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
              Revisa la propuesta antes de aplicarla. Tu redacción manual no se reemplazará sin tu confirmación.
            </p>
          </div>
          <button
            onClick={onDiscard}
            aria-label="Cerrar propuesta"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.25rem",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.35rem" }}>
              Texto propuesto por la IA:
            </div>
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--primary)",
                borderRadius: "0.5rem",
                padding: "1rem",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "var(--fg)",
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-serif, Georgia, serif)",
              }}
            >
              {textoPropuesto}
            </div>
          </div>

          <details style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver texto anterior para comparar</summary>
            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                background: "var(--accent)",
                borderRadius: "0.375rem",
                whiteSpace: "pre-wrap",
                fontSize: "0.8125rem",
              }}
            >
              {textoAnterior}
            </div>
          </details>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            background: "var(--card)",
          }}
        >
          <Button variant="secondary" onClick={onDiscard}>
            Descartar propuesta
          </Button>
          <Button variant="primary" onClick={onApply}>
            ✓ Aplicar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
