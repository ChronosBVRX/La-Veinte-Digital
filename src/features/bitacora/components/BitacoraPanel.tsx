"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Modal } from "@/shared/components/ui/Modal"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { BitacoraForm } from "./BitacoraForm"
import { BitacoraList } from "./BitacoraList"
import { Plus, ClipboardList } from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type BitacoraEntry = Tables<"bitacora_entries">

interface BitacoraPanelProps {
  userId: string
  initialEntries?: BitacoraEntry[]
}

const TYPE_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "Tiempo Extra", label: "Tiempo Extra" },
  { id: "Guardia Festiva", label: "Guardia Festiva" },
  { id: "TxT (Sustitución)", label: "TxT (Sustitución)" },
  { id: "Falta Injustificada", label: "Falta Injustificada" },
  { id: "Incapacidad", label: "Incapacidad" },
  { id: "Pases de salida/entrada", label: "Pases de salida/entrada" },
  { id: "Vacaciones", label: "Vacaciones" },
  { id: "No pagado (Reclamación en proceso)", label: "No pagado" },
]

export function BitacoraPanel({ userId, initialEntries = [] }: BitacoraPanelProps) {
  const [entries, setEntries] = useState<BitacoraEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("bitacora_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
    if (data) setEntries(data)
    setLoading(false)
  }, [userId])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    const supabase = createClient()
    const { error } = await supabase.from("bitacora_entries").delete().eq("id", id)
    if (error) {
      setDeleteError("No se pudo eliminar el registro. Intenta de nuevo.")
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== id))
    }
    setDeletingId(null)
  }

  const filtered = filter === "all" ? entries : entries.filter((e) => e.entry_type === filter)

  return (
    <Card padding="0">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 1.25rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ClipboardList size={16} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Mi agenda</span>
          <span style={{
            fontSize: "0.75rem", color: "var(--muted)",
            background: "var(--accent)", borderRadius: "9999px",
            padding: "0.125rem 0.5rem",
          }}>
            {entries.length}
          </span>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} />
          Nuevo
        </Button>
      </div>

      <div style={{ padding: "0.75rem 1.25rem 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: "0.375rem", overflowX: "auto", paddingBottom: "0.75rem" }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                background: filter === f.id ? "var(--primary)" : "var(--accent)",
                color: filter === f.id ? "var(--primary-fg)" : "var(--muted)",
                border: "none", borderRadius: "9999px",
                padding: "0.25rem 0.625rem",
                fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all var(--transition)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "1rem 1.25rem" }}>
        {deleteError && (
          <p style={{
            color: "#dc2626", fontSize: "0.8125rem", background: "#fef2f2",
            padding: "0.5rem 0.75rem", borderRadius: "0.375rem", margin: "0 0 0.75rem",
          }}>
            {deleteError}
          </p>
        )}
        {loading ? (
          <LoadingSpinner text="Cargando registros..." />
        ) : (
          <BitacoraList entries={filtered} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo registro" size="sm">
        <BitacoraForm userId={userId} onSuccess={() => { setShowForm(false); fetchEntries() }} />
      </Modal>
    </Card>
  )
}
