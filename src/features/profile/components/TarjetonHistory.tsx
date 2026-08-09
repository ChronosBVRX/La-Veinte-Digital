"use client"

import { useState, useCallback } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Spinner } from "@/shared/components/ui/Spinner"
import { EmptyState } from "@/shared/components/feedback/EmptyState"
import { Receipt, Trash, Warning } from "@phosphor-icons/react"

interface PayslipEntry {
  id: string
  period_raw: string | null
  extraction_method: string
  global_confidence: number
  created_at: string
  employee_name: string | null
  total_earnings: number | null
  total_net: number | null
}

interface Props {
  entries: PayslipEntry[]
}

export function TarjetonHistory({ entries: initial }: Props) {
  const [entries, setEntries] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("¿Eliminar este tarjetón importado?")) return
    setDeleting(id)
    try {
      const res = await fetch("/api/tarjeton/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id))
      }
    } catch {
      // silently handle
    } finally {
      setDeleting(null)
    }
  }, [])

  if (entries.length === 0) {
    return (
      <div style={{ marginTop: "1.5rem" }}>
        <EmptyState
          icon={<Receipt size={24} />}
          title="Sin tarjetones importados"
          description="Importa tu tarjetón del IMSS para ver tu historial aquí."
        />
      </div>
    )
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
        Tarjetones importados ({entries.length})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {entries.map((e) => (
          <Card key={e.id} padding="0.875rem">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    {e.employee_name ?? "Tarjetón"}
                  </span>
                  {e.global_confidence < 0.85 && (
                    <Warning size={14} weight="fill" color="var(--state-warning-fg)" />
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {e.period_raw ?? "Sin periodo"} · {e.extraction_method === "native_text" ? "Texto nativo" : "OCR"}
                  {e.total_net != null && ` · Neto: $${e.total_net.toLocaleString()}`}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  {new Date(e.created_at).toLocaleDateString("es-MX", {
                    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(e.id)}
                loading={deleting === e.id}
                style={{ flexShrink: 0, color: "var(--error)" }}
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
