"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"

interface EscritosProposalModalProps {
  isOpen: boolean
  title: string
  description?: string
  originalText: string
  proposedText: string
  onAccept: () => void
  onDiscard: () => void
}

export function EscritosProposalModal({
  isOpen,
  title,
  description,
  originalText,
  proposedText,
  onAccept,
  onDiscard,
}: EscritosProposalModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    modalRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDiscard()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onDiscard])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-title"
      ref={modalRef}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "0.75rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: "1rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          maxWidth: "720px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <h3 id="proposal-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)" }}>
              {title}
            </h3>
            {description && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onDiscard}
            aria-label="Descartar propuesta"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "var(--muted)",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Comparación visual */}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "0.75rem", marginBottom: "1.25rem", width: "100%", boxSizing: "border-box" }}>
          <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
              Texto actual:
            </div>
            <Card padding="0.875rem" style={{ background: "var(--accent)", maxHeight: "250px", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6, overflowWrap: "break-word" }}>
                {originalText}
              </div>
            </Card>
          </div>

          <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem" }}>
              ✨ Propuesta sugerida:
            </div>
            <Card padding="0.875rem" style={{ border: "1.5px solid var(--primary)", maxHeight: "250px", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", color: "var(--fg)", lineHeight: 1.6, overflowWrap: "break-word" }}>
                {proposedText}
              </div>
            </Card>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onDiscard}>
            Descartar cambios
          </Button>
          <Button variant="primary" onClick={onAccept}>
            Aplicar propuesta
          </Button>
        </div>
      </div>
    </div>
  )
}
