"use client"

import { useState } from "react"
import { CalendarDots, Plus, Trash, Clock, MapPin, CheckCircle } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Select } from "@/shared/components/ui/Input"
import { requestCajaDate, cancelCajaDate } from "../services/caja-service"
import type { DateItem } from "@/lib/caja/models"

interface CajaDatesCardProps {
  dates: DateItem[]
  loading: boolean
  onRefresh: () => void
}

const DELEGACIONES = [
  { id: 1, label: "Delegación 1 (CDMX Norte)" },
  { id: 2, label: "Delegación 2 (CDMX Sur)" },
  { id: 3, label: "Delegación 3 (Jalisco)" },
  { id: 4, label: "Delegación 4 (Nuevo León)" },
  { id: 5, label: "Delegación 5 (Puebla)" },
  { id: 6, label: "Delegación 6 (Veracruz)" },
]

export function CajaDatesCard({ dates, loading, onRefresh }: CajaDatesCardProps) {
  const [delegacionId, setDelegacionId] = useState("1")
  const [submitting, setSubmitting] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleRequestDate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setSubmitting(true)
    try {
      await requestCajaDate(delegacionId)
      setSuccessMsg("Cita agendada correctamente.")
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al solicitar cita")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelDate = async (id: string | number) => {
    if (!confirm("¿Seguro que deseas cancelar esta cita?")) return
    setError(null)
    setSuccessMsg(null)
    setCancelingId(id)
    try {
      await cancelCajaDate(id)
      setSuccessMsg("Cita cancelada con éxito.")
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cancelar cita")
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <CalendarDots size={22} color="var(--primary)" weight="bold" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Citas de Atención Presencial
          </h2>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(34, 197, 94, 0.1)",
              borderRadius: "var(--radius-md)",
              color: "var(--success, #22c55e)",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <CheckCircle size={16} weight="fill" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Citas registradas */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.75rem" }}>
            Citas Agendadas ({dates.length})
          </div>

          {loading ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem" }}>
              Cargando citas...
            </div>
          ) : dates.length === 0 ? (
            <div
              style={{
                padding: "1.5rem",
                textAlign: "center",
                background: "var(--accent)",
                borderRadius: "var(--radius-md)",
                color: "var(--muted)",
                fontSize: "0.8125rem",
              }}
            >
              No tienes citas programadas en este momento.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {dates.map((d, idx) => {
                const dateId = d.id ?? idx
                return (
                  <div
                    key={dateId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      padding: "0.875rem 1rem",
                      background: "var(--accent)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      width: "100%",
                      boxSizing: "border-box",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, flexWrap: "wrap" }}>
                        <Clock size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>{d.fecha || "Fecha por confirmar"} {d.hora ? `· ${d.hora}` : ""}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        <MapPin size={14} style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>{d.delegacion || "Delegación SNTSS"}</span>
                        {d.estatus && <span>· Estado: {d.estatus}</span>}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelDate(dateId)}
                      loading={cancelingId === dateId}
                      leadingIcon={<Trash size={14} />}
                      style={{ flexShrink: 0 }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agendar nueva cita */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.75rem" }}>
            Solicitar Nueva Cita
          </div>

          <form onSubmit={handleRequestDate} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", width: "100%", boxSizing: "border-box" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0, width: "100%" }}>
              <Select
                label="Delegación Sindical"
                value={delegacionId}
                onChange={(e) => setDelegacionId(e.target.value)}
                disabled={submitting}
              >
                {DELEGACIONES.map((del) => (
                  <option key={del.id} value={del.id}>
                    {del.label}
                  </option>
                ))}
              </Select>
            </div>

            <Button type="submit" variant="primary" size="md" loading={submitting} leadingIcon={<Plus size={16} />} style={{ flex: "1 1 auto" }}>
              Agendar Cita
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
