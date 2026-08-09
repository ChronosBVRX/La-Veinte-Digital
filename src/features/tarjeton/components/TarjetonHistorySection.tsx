"use client"

import { useState, useCallback } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { CheckCircle, Trash } from "@phosphor-icons/react"

interface PreviousImport {
  id: string
  periodRaw: string | null
  extractionMethod: string
  globalConfidence: number
  createdAt: string
  employeeName: string | null
  totalNet: number | null
}

export function TarjetonHistorySection({ imports: initial }: { imports: PreviousImport[] }) {
  const [imports, setImports] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("¿Eliminar este tarjetón?")) return
    setDeleting(id)
    try {
      const res = await fetch("/api/tarjeton/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setImports((prev) => prev.filter((i) => i.id !== id))
      }
    } catch { /* silently handle */ }
    finally { setDeleting(null) }
  }, [])

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(imp.id)}
                loading={deleting === imp.id}
                style={{ flexShrink: 0, color: "var(--error)", padding: "0 0.25rem" }}
              >
                <Trash size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
