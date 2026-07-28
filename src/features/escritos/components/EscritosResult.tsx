"use client"

import { FileText, Copy } from "lucide-react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"

interface EscritosResultProps {
  resultado: string
  onCopy: () => void
}

export function EscritosResult({ resultado, onCopy }: EscritosResultProps) {
  return (
    <Card padding="1.5rem">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FileText size={18} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Escrito Generado</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={onCopy}>
          <Copy size={14} /> Copiar
        </Button>
      </div>
      <div
        style={{
          whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: 1.7,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          padding: "1.5rem", background: "var(--bg)", borderRadius: "0.375rem",
          border: "1px solid var(--border)",
        }}
      >
        {resultado}
      </div>
    </Card>
  )
}
