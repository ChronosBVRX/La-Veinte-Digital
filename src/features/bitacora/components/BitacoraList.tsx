"use client"

import { Badge } from "@/shared/components/ui/Badge"
import { Button } from "@/shared/components/ui/Button"
import { Trash2 } from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type BitacoraEntry = Tables<"bitacora_entries">

const TYPE_COLORS: Record<string, "warning" | "error" | "info" | "success" | "default"> = {
  "Tiempo Extra": "warning",
  "Guardia Festiva": "info",
  "TxT (Sustitución)": "info",
  "Falta Injustificada": "error",
  "Incapacidad": "error",
  "Pases de salida/entrada": "default",
  "Vacaciones": "success",
  "No pagado (Reclamación en proceso)": "error",
}

interface BitacoraListProps {
  entries: BitacoraEntry[]
  onDelete: (id: string) => void
  deletingId: string | null
}

function groupByMonth(entries: BitacoraEntry[]) {
  const groups: Record<string, BitacoraEntry[]> = {}
  for (const e of entries) {
    const month = e.entry_date.slice(0, 7)
    if (!groups[month]) groups[month] = []
    groups[month].push(e)
  }
  return groups
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-")
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

export function BitacoraList({ entries, onDelete, deletingId }: BitacoraListProps) {
  const groups = groupByMonth(entries)

  if (entries.length === 0) {
    return (
      <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.875rem", padding: "2rem 0" }}>
        No hay registros aún
      </p>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {Object.entries(groups).map(([ym, items]) => (
        <div key={ym}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {formatMonth(ym)}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {items.map((entry) => (
              <div key={entry.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.625rem 0.75rem",
                background: "var(--bg)", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Badge variant={TYPE_COLORS[entry.entry_type] ?? "default"}>
                      {entry.entry_type}
                    </Badge>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {formatDate(entry.entry_date)}
                    </span>
                  </div>
                  {entry.description && (
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--fg)", lineHeight: 1.4 }}>
                      {entry.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={deletingId === entry.id}
                  onClick={() => onDelete(entry.id)}
                  style={{ color: "var(--muted)", flexShrink: 0 }}
                  aria-label="Eliminar registro"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
