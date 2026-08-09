"use client"

import { Card } from "@/shared/components/ui/Card"
import { CheckCircle } from "@phosphor-icons/react"

interface PreviousImport {
  id: string
  periodRaw: string | null
  extractionMethod: string
  globalConfidence: number
  createdAt: string
  employeeName: string | null
  totalNet: number | null
}

export function TarjetonHistorySection({ imports }: { imports: PreviousImport[] }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
        Tarjetones importados ({imports.length})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {imports.map((imp) => (
          <Card key={imp.id} padding="0.75rem 1rem">
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <CheckCircle size={18} weight="fill" color="var(--state-success-fg)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {imp.periodRaw ?? "Sin periodo"}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                  {imp.employeeName ?? "Trabajador"} · {imp.extractionMethod === "native_text" ? "Texto nativo" : "OCR"}
                  {imp.totalNet != null && ` · Neto $${imp.totalNet.toLocaleString()}`}
                </div>
              </div>
              <span style={{ fontSize: "0.6875rem", color: "var(--muted)", flexShrink: 0 }}>
                {new Date(imp.createdAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
