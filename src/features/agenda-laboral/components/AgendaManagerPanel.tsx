"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Clock, MapPin, User, Trash, CalendarBlank, WarningCircle } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Alert } from "@/shared/components/ui/Alert"
import { CommitmentForm } from "./CommitmentForm"
import { useCommitments } from "../hooks/useCommitments"
import type { WorkerCommitment, CommitmentType } from "../types"
import { PRIMARY_COMMITMENT_TYPES, COMMITMENT_TYPE_LABELS, COMMITMENT_TYPE_ICONS } from "../types"
import type { CommitmentRow } from "../services/commitments-supabase"
import { getCommitmentDetailLines, getCommitmentScheduleLabel } from "../lib/commitment-calendar"
import { groupOvertimeByFortnight, summarizeClaims } from "../lib/payroll-schedule"

interface AgendaManagerPanelProps {
  userId: string
  initialCommitments?: CommitmentRow[]
  targetDate?: string
  targetCommitmentId?: string
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Hoy"
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
}

export function AgendaManagerPanel({ userId, initialCommitments, targetCommitmentId }: AgendaManagerPanelProps) {
  const { commitments, fetchError, migration, retryMigration, add, remove } = useCommitments(userId, initialCommitments)
  const [filter, setFilter] = useState<CommitmentType | "all">("all")
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (targetCommitmentId && typeof document !== "undefined") {
      const el = document.getElementById(`commitment-${targetCommitmentId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [targetCommitmentId, commitments])

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

  const overtimeSummaries = useMemo(
    () => groupOvertimeByFortnight(commitments),
    [commitments]
  )

  const claimsSummary = useMemo(
    () => summarizeClaims(commitments),
    [commitments]
  )

  const renderCommitmentItem = (c: WorkerCommitment) => {
    const isTarget = targetCommitmentId === c.id
    const specificDetails = getCommitmentDetailLines(c)
    return (
      <div
        key={c.id}
        id={`commitment-${c.id}`}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.625rem 0.75rem",
          background: isTarget ? "rgba(6, 182, 212, 0.08)" : "var(--bg)",
          borderRadius: "var(--radius-sm)",
          border: isTarget ? "1.5px solid var(--brand-cyan)" : "1px solid var(--border)",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
        }}
      >
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
              {formatDayLabel(c.startAt)} · {getCommitmentScheduleLabel(c)}
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
          {specificDetails.length > 0 && (
            <div style={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", gap: "0.25rem 0.75rem", fontSize: "0.75rem", color: "var(--muted)" }}>
              {specificDetails.map((detail) => <span key={detail}>{detail}</span>)}
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
    )
  }

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
          {PRIMARY_COMMITMENT_TYPES.map((t) => (
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

        {/* Resumen ejecutivo en vista 'all' */}
        {filter === "all" && (overtimeSummaries.length > 0 || claimsSummary.pendingCount > 0) && (
          <div style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
            padding: "0.5rem 0.75rem",
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            fontSize: "0.75rem",
            alignItems: "center",
          }}>
            {overtimeSummaries.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("overtime")}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--fg)",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  marginRight: "0.75rem",
                }}
              >
                <span>⏱️ <strong>Tiempo Extra:</strong> {overtimeSummaries[0].totalHours} hrs en {overtimeSummaries[0].fortnightNumber}ª Qna (~${overtimeSummaries[0].totalEstimatedEarnings.toLocaleString("es-MX", { minimumFractionDigits: 2 })})</span>
              </button>
            )}
            {claimsSummary.pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter("no_pagado")}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--fg)",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>📋 <strong>Reclamaciones:</strong> {claimsSummary.pendingCount} en seguimiento{claimsSummary.totalClaimedAmount > 0 ? ` (~$${claimsSummary.totalClaimedAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })})` : ""}</span>
              </button>
            )}
          </div>
        )}

        {/* Banner destacado para Reclamaciones Pendientes */}
        {filter === "no_pagado" && claimsSummary.items.length > 0 && (
          <div style={{
            padding: "0.875rem 1rem",
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--fg)" }}>
                📋 Resumen de Reclamaciones y Adeudos
              </span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "var(--radius-pill)",
                  background: "rgba(37, 99, 235, 0.1)",
                  color: "var(--primary)",
                }}>
                  {claimsSummary.pendingCount} en seguimiento
                </span>
                {claimsSummary.totalClaimedAmount > 0 && (
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "var(--radius-pill)",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#047857",
                  }}>
                    ~${claimsSummary.totalClaimedAmount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} estimado
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
              Ciclo resolutorio de 45 días (3 quincenas) con contestación por escrito en un plazo máximo de 15 días (Cláusula 8 del CCT).
            </div>
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
        ) : filter === "overtime" ? (
          /* Vista por Quincena para Tiempo Extra */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
            {overtimeSummaries.map((summary) => (
              <div key={summary.periodKey} style={{ minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                <div style={{
                  padding: "0.875rem 1rem",
                  background: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--fg)" }}>
                      ⏱️ {summary.fortnightLabel}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "var(--radius-pill)",
                        background: summary.exceedsLimit20h ? "rgba(239, 68, 68, 0.12)" : "rgba(37, 99, 235, 0.1)",
                        color: summary.exceedsLimit20h ? "#b91c1c" : "var(--primary)",
                      }}>
                        {summary.totalHours} hrs acumuladas
                      </span>
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "var(--radius-pill)",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#047857",
                      }}>
                        ~${summary.totalEstimatedEarnings.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
                    <span>
                      <strong>Cobro en nómina (SIAP): </strong>{summary.paymentSchedule.targetFortnightLabel}
                    </span>
                    <span>
                      <strong>Día de dispersión bancaria: </strong>{summary.paymentSchedule.formattedPaymentDate}
                    </span>
                  </div>

                  {summary.exceedsLimit20h ? (
                    <div style={{
                      padding: "0.45rem 0.65rem",
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem",
                      color: "#b45309",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.35rem",
                    }}>
                      <WarningCircle size={15} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                      <span>
                        <strong>Tope excedido (Proc. 1A74-003-031):</strong> Has acumulado más de 20 hrs ordinarias en la quincena. Tramita tu oficio o minuta de justificación ante la jefatura antes del corte de interactivo para evitar rechazo en el SIAP.
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                      Margen ordinario: {summary.totalHours} de 20 hrs permitidas en la quincena (Proc. 1A74-003-031).
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                  {summary.items.map((c) => renderCommitmentItem(c))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Vista por Grupos Mensuales para el resto de tipos */
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
                    {items.map((c) => renderCommitmentItem(c))}
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
