"use client"

import { useState } from "react"
import { Plus, CaretRight, Clock, MapPin, User } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { SectionCard } from "@/shared/components/ui/SectionCard"
import { CommitmentForm } from "./CommitmentForm"
import type { WorkerCommitment } from "../types"
import { COMMITMENT_TYPE_LABELS, COMMITMENT_TYPE_ICONS } from "../types"

interface AgendaCardProps {
  userId: string
  commitments: WorkerCommitment[]
  onCommitmentsChange: () => void
  onAdd: (c: Omit<WorkerCommitment, "id" | "createdAt">) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return "HOY"
  if (d.toDateString() === tomorrow.toDateString()) return "MAÑANA"

  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function AgendaCard({ userId, commitments, onCommitmentsChange, onAdd }: AgendaCardProps) {
  const [showForm, setShowForm] = useState(false)

  const upcoming = commitments.filter((c) => c.status === "active" && new Date(c.startAt) > new Date()).slice(0, 3)

  return (
    <>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}>
          <span style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Mi agenda laboral
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            leadingIcon={<Plus size={14} />}
          >
            Agregar compromiso
          </Button>
        </div>

        {upcoming.length === 0 ? (
          <div style={{
            padding: "var(--space-6)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0 0 0.5rem" }}>
              No tienes turnos extra ni sustituciones próximas.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Agregar TxT o tiempo extra
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcoming.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{
                  fontSize: "1.25rem",
                  width: 28,
                  display: "flex",
                  justifyContent: "center",
                  flexShrink: 0,
                  lineHeight: 1,
                }}>
                  {COMMITMENT_TYPE_ICONS[c.type]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "var(--brand-cyan)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.125rem",
                  }}>
                    {formatDate(c.startAt)}
                  </div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "0.125rem" }}>
                    {COMMITMENT_TYPE_LABELS[c.type]}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.75rem", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={12} /> {formatTime(c.startAt)}–{formatTime(c.endAt)}
                    </span>
                    {c.substituteWorkerName && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <User size={12} /> Cubres a {c.substituteWorkerName}
                      </span>
                    )}
                    {c.service && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <MapPin size={12} /> {c.service}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <CommitmentForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={(c) => { onAdd(c); onCommitmentsChange() }}
          userId={userId}
        />
      )}
    </>
  )
}
