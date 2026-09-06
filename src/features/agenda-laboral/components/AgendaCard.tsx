"use client"

import { useState } from "react"
import { Plus, Clock, MapPin, User, ArrowCounterClockwise } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { CommitmentForm } from "./CommitmentForm"
import type { WorkerCommitment } from "../types"
import { COMMITMENT_TYPE_LABELS, COMMITMENT_TYPE_ICONS } from "../types"
import {
  getTodayLocalDateString,
  formatLocalTime,
  formatHumanCommitmentDate,
  isCommitmentInProgress,
  getCommitmentDisplayTitle,
} from "../lib/commitment-calendar"

interface AgendaCardProps {
  userId: string
  commitments: WorkerCommitment[]
  selectedDate?: string
  onDateChange?: (date: string) => void
  onCommitmentsChange: () => void
  onAdd: (c: Omit<WorkerCommitment, "id" | "createdAt">) => void | Promise<void>
}

export function AgendaCard({
  userId,
  commitments,
  selectedDate,
  onDateChange,
  onCommitmentsChange,
  onAdd,
}: AgendaCardProps) {
  const [showForm, setShowForm] = useState(false)
  const todayStr = getTodayLocalDateString()
  const activeDate = selectedDate || todayStr
  const isViewingToday = activeDate === todayStr

  const now = new Date()

  return (
    <>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              {isViewingToday ? "Compromisos e incidencias" : `Compromisos · ${formatHumanCommitmentDate(`${activeDate}T12:00:00`)}`}
            </span>
            {!isViewingToday && onDateChange && (
              <button
                onClick={() => onDateChange(todayStr)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  background: "rgba(96, 165, 250, 0.12)",
                  color: "var(--primary)",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "0.15rem 0.5rem",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ArrowCounterClockwise size={11} weight="bold" /> Volver a hoy
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            leadingIcon={<Plus size={16} weight="bold" />}
          >
            Registrar
          </Button>
        </div>

        {commitments.length === 0 ? (
          <div style={{
            padding: "var(--space-6)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              {isViewingToday
                ? "No tienes compromisos ni incidencias para hoy."
                : "No tienes compromisos ni incidencias para este día."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} weight="bold" /> Registrar compromiso
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {commitments.map((c) => {
              const inProgress = isCommitmentInProgress(c, now)
              const hasEnded = new Date(c.endAt).getTime() <= now.getTime()
              const title = getCommitmentDisplayTitle(c)
              const icon = COMMITMENT_TYPE_ICONS[c.type] ?? "📌"
              const typeLabel = COMMITMENT_TYPE_LABELS[c.type] ?? "Compromiso"

              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: "var(--card)",
                    border: inProgress ? "1.5px solid var(--brand-cyan)" : "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    opacity: hasEnded ? 0.75 : 1,
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
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.125rem",
                    }}>
                      <span style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        color: inProgress ? "#0891b2" : "var(--brand-cyan)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        {formatHumanCommitmentDate(c.startAt, now).toUpperCase()}
                      </span>
                      {inProgress && (
                        <span style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "0.05rem 0.35rem",
                          borderRadius: "4px",
                          textTransform: "uppercase",
                        }}>
                          En curso
                        </span>
                      )}
                      {hasEnded && (
                        <span style={{
                          color: "var(--muted)",
                          fontSize: "0.625rem",
                          fontWeight: 500,
                        }}>
                          (Finalizado)
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      marginBottom: "0.125rem",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}>
                      {title}
                      {c.title && c.title !== typeLabel && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontWeight: 400, marginLeft: "0.35rem" }}>
                          ({typeLabel})
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.25rem 0.75rem",
                      fontSize: "var(--text-xs)",
                      color: "var(--muted)",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={12} style={{ flexShrink: 0 }} /> {formatLocalTime(c.startAt)}–{formatLocalTime(c.endAt)}
                      </span>
                      {c.substituteWorkerName && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                          <User size={12} style={{ flexShrink: 0 }} /> Cubres a {c.substituteWorkerName}
                        </span>
                      )}
                      {c.service && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                          <MapPin size={12} style={{ flexShrink: 0 }} /> {c.service}
                        </span>
                      )}
                      {c.workplace && !c.service && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                          <MapPin size={12} style={{ flexShrink: 0 }} /> {c.workplace}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p style={{ fontSize: "0.625rem", color: "var(--muted)", margin: "0.5rem 0 0", textAlign: "center" }}>
          Tus compromisos se guardan en tu cuenta y aparecen en tu calendario.
        </p>
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
