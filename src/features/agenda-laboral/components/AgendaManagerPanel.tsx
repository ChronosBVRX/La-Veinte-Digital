"use client"

import { useState, useMemo } from "react"
import { Plus, Clock, MapPin, User, Trash, CalendarBlank } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Alert } from "@/shared/components/ui/Alert"
import { CommitmentForm } from "./CommitmentForm"
import { useCommitments } from "../hooks/useCommitments"
import type { WorkerCommitment, CommitmentType } from "../types"
import { COMMITMENT_TYPES, COMMITMENT_TYPE_LABELS, COMMITMENT_TYPE_ICONS } from "../types"
import type { CommitmentRow } from "../services/commitments-supabase"

interface AgendaManagerPanelProps {
  userId: string
  initialCommitments?: CommitmentRow[]
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Hoy"
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
}

export function AgendaManagerPanel({ userId, initialCommitments }: AgendaManagerPanelProps) {
  const { commitments, fetchError, migration, retryMigration, add, remove } = useCommitments(userId, initialCommitments)
  const [filter, setFilter] = useState<CommitmentType | "all">("all")
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    await remove(id)
    setDeletingId(null)
  }

  const filtered = useMemo(
    () => commitments
      .filter((c) => filter === "all" || c.type === filter)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [commitments, filter]
  )

  const groups = useMemo(() => {
    const map = new Map<string, WorkerCommitment[]>()
    for (const c of filtered) {
      const d = new Date(c.startAt)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <Card padding="0">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem clamp(0.75rem, 3vw, 1.25rem)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Registros</span>
          <span style={{
            fontSize: "0.75rem", color: "var(--muted)",
            background: "var(--accent)", borderRadius: "9999px",
            padding: "0.125rem 0.5rem",
          }}>
            {filtered.length}
          </span>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} />
          Nuevo
        </Button>
      </div>

      <div style={{ padding: "0.75rem clamp(0.75rem, 3vw, 1.25rem) 0", borderBottom: "1px solid var(--border)", maxWidth: "100%", boxSizing: "border-box" }}>
        <div style={{
          display: "flex",
          gap: "0.375rem",
          overflowX: "auto",
          paddingBottom: "0.75rem",
          maxWidth: "100%",
          boxSizing: "border-box",
          WebkitOverflowScrolling: "touch",
        }}>
          <button
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            style={{
              background: filter === "all" ? "var(--primary)" : "var(--accent)",
              color: filter === "all" ? "var(--primary-fg)" : "var(--muted)",
              border: "none", borderRadius: "9999px",
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem", fontWeight: 500,
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              flexShrink: 0,
              transition: "all var(--transition)",
            }}
          >
            Todas
          </button>
          {COMMITMENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              aria-pressed={filter === t}
              style={{
                background: filter === t ? "var(--primary)" : "var(--accent)",
                color: filter === t ? "var(--primary-fg)" : "var(--muted)",
                border: "none", borderRadius: "9999px",
                padding: "0.25rem 0.625rem",
                fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                flexShrink: 0,
                transition: "all var(--transition)",
              }}
            >
              {COMMITMENT_TYPE_ICONS[t]} {COMMITMENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "1rem clamp(0.75rem, 3vw, 1.25rem)", maxWidth: "100%", boxSizing: "border-box" }}>
        {deleteError && (
          <div style={{ marginBottom: "0.75rem" }}>
            <Alert variant="error">{deleteError}</Alert>
          </div>
        )}
        {fetchError && (
          <div style={{ marginBottom: "0.75rem" }}>
            <Alert variant="warning">No pudimos actualizar tu agenda. Revisa tu conexión.</Alert>
          </div>
        )}
        {migration === "failed" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <Alert
              variant="warning"
              title="Migración pendiente"
              action={<Button variant="outline" size="sm" onClick={retryMigration}>Reintentar</Button>}
            >
              No se pudieron migrar todos tus compromisos anteriores.
            </Alert>
          </div>
        )}

        {!fetchError && filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <CalendarBlank size={28} style={{ color: "var(--muted)", margin: "0 auto 0.5rem" }} />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}>
              No hay registros aún
            </p>
            <Button variant="outline" size="sm" style={{ marginTop: "0.75rem" }} onClick={() => setShowForm(true)}>
              Agregar el primero
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
            {groups.map(([key, items]) => {
              const [y, m] = key.split("-").map(Number)
              return (
                <div key={key} style={{ minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                  <p style={{
                    fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)",
                    margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {MONTH_NAMES[m]} {y}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                    {items.map((c) => (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "flex-start", gap: "0.75rem",
                        padding: "0.625rem 0.75rem",
                        background: "var(--bg)", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        maxWidth: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}>
                        <span style={{ fontSize: "1.125rem", lineHeight: 1.4, flexShrink: 0 }}>
                          {COMMITMENT_TYPE_ICONS[c.type]}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem 0.5rem", flexWrap: "wrap", minWidth: 0 }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                              {c.title !== COMMITMENT_TYPE_LABELS[c.type] ? c.title : COMMITMENT_TYPE_LABELS[c.type]}
                            </span>
                            {c.title !== COMMITMENT_TYPE_LABELS[c.type] && (
                              <span style={{ fontSize: "0.6875rem", color: "var(--brand-cyan)", fontWeight: 600, flexShrink: 0 }}>
                                {COMMITMENT_TYPE_LABELS[c.type]}
                              </span>
                            )}
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                              {formatDayLabel(c.startAt)} · {formatTime(c.startAt)}–{formatTime(c.endAt)}
                            </span>
                          </div>
                          {(c.substituteWorkerName || c.service || c.workplace || c.notes) && (
                            <div style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                              {c.substituteWorkerName && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginRight: "0.75rem", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                                  <User size={12} style={{ flexShrink: 0 }} /> Cubres a {c.substituteWorkerName}
                                </span>
                              )}
                              {c.service && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginRight: "0.75rem", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                                  <MapPin size={12} style={{ flexShrink: 0 }} /> {c.service}
                                </span>
                              )}
                              {c.workplace && <span style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{c.workplace}</span>}
                              {c.notes && <div style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{c.notes}</div>}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                          style={{ color: "var(--muted)", flexShrink: 0 }}
                          aria-label="Eliminar registro"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {groups.length > 0 && (
              <p style={{
                display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", textAlign: "center",
                gap: "0.25rem", fontSize: "0.6875rem", color: "var(--muted)", margin: 0,
                overflowWrap: "anywhere", wordBreak: "break-word"
              }}>
                <Clock size={11} style={{ flexShrink: 0 }} />
                <span>Todo lo que registras aparece también en tu inicio y en tu calendario</span>
              </p>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <CommitmentForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={(c) => { add(c) }}
          userId={userId}
        />
      )}
    </Card>
  )
}
