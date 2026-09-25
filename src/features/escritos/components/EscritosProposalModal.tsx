"use client"

import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog"

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
  if (!isOpen) return null

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onDiscard}
      title={title}
      description={description}
      size="lg"
      sheetHeight="large"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onDiscard}>
            Descartar cambios
          </Button>
          <Button variant="primary" onClick={onAccept}>
            Aplicar propuesta
          </Button>
        </div>
      }
    >
      {/* Comparación visual */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "0.75rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
            Texto actual:
          </div>
          <Card
            padding="0.875rem"
            style={{
              background: "var(--accent)",
              maxHeight: "250px",
              overflowY: "auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.875rem",
                color: "var(--muted)",
                lineHeight: 1.6,
                overflowWrap: "break-word",
              }}
            >
              {originalText}
            </div>
          </Card>
        </div>

        <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem" }}>
            ✨ Propuesta sugerida:
          </div>
          <Card
            padding="0.875rem"
            style={{
              border: "1.5px solid var(--primary)",
              maxHeight: "250px",
              overflowY: "auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.875rem",
                color: "var(--fg)",
                lineHeight: 1.6,
                overflowWrap: "break-word",
              }}
            >
              {proposedText}
            </div>
          </Card>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
