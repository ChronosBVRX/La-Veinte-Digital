"use client"

import { useState } from "react"
import { X, Clock, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { FormField } from "@/shared/components/ui/FormField"
import { Checkbox } from "@/shared/components/ui/Checkbox"
import { Modal } from "@/shared/components/ui/Modal"
import type { WorkerCommitment, CommitmentType } from "../types"
import { COMMITMENT_TYPE_LABELS, COMMITMENT_TYPE_ICONS } from "../types"

interface CommitmentFormProps {
  open: boolean
  onClose: () => void
  onSave: (c: Omit<WorkerCommitment, "id" | "createdAt">) => void
  userId: string
}

type Step = "type" | "details" | "reminder"

export function CommitmentForm({ open, onClose, onSave, userId }: CommitmentFormProps) {
  const [step, setStep] = useState<Step>("type")
  const [type, setType] = useState<CommitmentType | null>(null)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [workplace, setWorkplace] = useState("")
  const [service, setService] = useState("")
  const [substituteName, setSubstituteName] = useState("")
  const [notes, setNotes] = useState("")
  const [reminder, setReminder] = useState({ dayBefore: true, hoursBefore: true, atStart: false })

  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("type")
    setType(null)
    setTitle("")
    setDate("")
    setStartTime("")
    setEndTime("")
    setWorkplace("")
    setService("")
    setSubstituteName("")
    setNotes("")
    setReminder({ dayBefore: true, hoursBefore: true, atStart: false })
    setError(null)
  }

  const handleSave = () => {
    if (!type || !date || !startTime || !endTime) return

    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(`${date}T${endTime}:00`)

    if (end <= start) {
      end.setDate(end.getDate() + 1)
    }

    const durationMs = end.getTime() - start.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)

    if (durationHours > 23) {
      setError("La duración máxima es de 23 horas. Revisa las horas de entrada y salida.")
      return
    }

    const startAt = start.toISOString()
    const endAt = end.toISOString()

    onSave({
      userId,
      type,
      title: title || COMMITMENT_TYPE_LABELS[type],
      startAt,
      endAt,
      workplace,
      service,
      substituteWorkerName: substituteName,
      notes,
      reminder,
      status: "active",
    })
    reset()
    onClose()
  }

  const isOvernight = startTime && endTime
    ? (() => {
        const [sh, sm] = startTime.split(":").map(Number)
        const [eh, em] = endTime.split(":").map(Number)
        return (eh * 60 + em) <= (sh * 60 + sm)
      })()
    : false

  const hours = startTime && endTime
    ? (() => {
        const [sh, sm] = startTime.split(":").map(Number)
        const [eh, em] = endTime.split(":").map(Number)
        let mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins <= 0) mins += 24 * 60
        return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""}`
      })()
    : null

  const TYPES: { key: CommitmentType; label: string; icon: string; desc: string }[] = [
    { key: "txt_substitution", label: "Sustitución TxT", icon: "🔄", desc: "Cubrir el turno de otro compañero" },
    { key: "overtime", label: "Tiempo extra", icon: "⏱", desc: "Horas adicionales fuera de tu jornada" },
    { key: "shift_change", label: "Cambio de turno", icon: "🔀", desc: "Turno distinto a tu jornada habitual" },
    { key: "other", label: "Otro compromiso", icon: "📌", desc: "Guardia, capacitación, reunión, etc." },
  ]

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Agregar compromiso" size="sm">
      {step === "type" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}>
            ¿Qué vas a realizar?
          </p>
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => { setType(t.key); setStep("details") }}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)", background: "var(--card)",
                cursor: "pointer", textAlign: "left", width: "100%",
                fontFamily: "inherit", fontSize: "var(--text-sm)",
                transition: "border-color var(--transition)",
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>{t.desc}</div>
              </div>
              <CaretRight size={16} color="var(--muted)" />
            </button>
          ))}
        </div>
      )}

      {step === "details" && type && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--muted)" }}>
            {COMMITMENT_TYPE_ICONS[type]} {COMMITMENT_TYPE_LABELS[type]}
          </div>

          {type === "txt_substitution" && (
            <FormField label="¿A quién vas a cubrir?" htmlFor="substitute" required>
              <Input id="substitute" value={substituteName} onChange={(e) => setSubstituteName(e.target.value)} placeholder="Nombre del trabajador" />
            </FormField>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="Fecha" htmlFor="date" required>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="Entrada" htmlFor="startTime" required>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </FormField>
            <FormField label={isOvernight ? "Salida (día siguiente)" : "Salida"} htmlFor="endTime" required>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </FormField>
          </div>

          {hours && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--brand-cyan)", fontWeight: 600, textAlign: "center" }}>
              <Clock size={14} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
              {hours}{isOvernight ? " (turno nocturno)" : ""}
            </div>
          )}

          {error && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--error)", textAlign: "center" }}>
              {error}
            </div>
          )}

          <FormField label="Área o servicio" htmlFor="service">
            <Input id="service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Ej: Urgencias, Rayos X" />
          </FormField>

          {type === "txt_substitution" && (
            <FormField label="Lugar de trabajo" htmlFor="workplace">
              <Input id="workplace" value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="Ej: HGR 1 Charo" />
            </FormField>
          )}

          <FormField label="Notas (opcional)" htmlFor="notes">
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algún detalle adicional" />
          </FormField>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <Button variant="secondary" onClick={() => setStep("type")} leadingIcon={<CaretLeft size={14} />}>Volver</Button>
            <Button onClick={() => setStep("reminder")} trailingIcon={<CaretRight size={14} />}>Continuar</Button>
          </div>
        </div>
      )}

      {step === "reminder" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: 0 }}>
            ¿Cuándo quieres que te recordemos?
          </p>

          <Checkbox
            checked={reminder.dayBefore}
            onChange={(e) => setReminder({ ...reminder, dayBefore: e.target.checked })}
            label="Un día antes (19:00)"
          />
          <Checkbox
            checked={reminder.hoursBefore}
            onChange={(e) => setReminder({ ...reminder, hoursBefore: e.target.checked })}
            label="Dos horas antes del inicio"
          />
          <Checkbox
            checked={reminder.atStart}
            onChange={(e) => setReminder({ ...reminder, atStart: e.target.checked })}
            label="Al iniciar el turno"
          />

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", marginTop: "0.5rem" }}>
            <Button variant="secondary" onClick={() => setStep("details")} leadingIcon={<CaretLeft size={14} />}>Volver</Button>
            <Button onClick={handleSave} disabled={!date || !startTime || !endTime}>
              Guardar y recordarme
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
