"use client"

import { useState } from "react"
import { Clock, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select, Textarea } from "@/shared/components/ui/Input"
import { FormField } from "@/shared/components/ui/FormField"
import { Checkbox } from "@/shared/components/ui/Checkbox"
import { Modal } from "@/shared/components/ui/Modal"
import type {
  AffectedShift,
  CommitmentDetails,
  CommitmentType,
  SportModality,
  WorkerCommitment,
} from "../types"
import {
  AFFECTED_SHIFT_LABELS,
  COMMITMENT_TYPE_ICONS,
  COMMITMENT_TYPE_LABELS,
  SPORT_MODALITY_LABELS,
} from "../types"

interface CommitmentFormProps {
  open: boolean
  onClose: () => void
  onSave: (c: Omit<WorkerCommitment, "id" | "createdAt">) => void
  userId: string
}

type Step = "type" | "details" | "reminder"

const TYPES: { key: CommitmentType; label: string; icon: string; desc: string }[] = [
  { key: "overtime", label: "Tiempo extra", icon: "⏱", desc: "Registra el horario y quién lo autorizó" },
  { key: "sport", label: "Deporte", icon: "🏃", desc: "Anota cómo y cuándo usarás tu tiempo" },
  { key: "falta_injustificada", label: "Falta injustificada", icon: "🚫", desc: "Guarda la incidencia y el turno afectado" },
  { key: "no_pagado", label: "Reclamación pendiente", icon: "📋", desc: "Programa el próximo seguimiento de tu trámite" },
]

const DEFAULT_REMINDER = { dayBefore: true, hoursBefore: true, atStart: false }

function plusOneHour(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000)
}

export function CommitmentForm({ open, onClose, onSave, userId }: CommitmentFormProps) {
  const [step, setStep] = useState<Step>("type")
  const [type, setType] = useState<CommitmentType | null>(null)
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [workplace, setWorkplace] = useState("")
  const [service, setService] = useState("")
  const [authorizedBy, setAuthorizedBy] = useState("")
  const [activity, setActivity] = useState("")
  const [sportModality, setSportModality] = useState<SportModality | "">("")
  const [affectedShift, setAffectedShift] = useState<AffectedShift | "">("")
  const [claimSubject, setClaimSubject] = useState("")
  const [claimFiledDate, setClaimFiledDate] = useState("")
  const [claimReference, setClaimReference] = useState("")
  const [responsibleArea, setResponsibleArea] = useState("")
  const [notes, setNotes] = useState("")
  const [reminder, setReminder] = useState(DEFAULT_REMINDER)
  const [error, setError] = useState<string | null>(null)

  const resetDetails = () => {
    setDate("")
    setStartTime("")
    setEndTime("")
    setWorkplace("")
    setService("")
    setAuthorizedBy("")
    setActivity("")
    setSportModality("")
    setAffectedShift("")
    setClaimSubject("")
    setClaimFiledDate("")
    setClaimReference("")
    setResponsibleArea("")
    setNotes("")
    setError(null)
  }

  const reset = () => {
    setStep("type")
    setType(null)
    resetDetails()
    setReminder(DEFAULT_REMINDER)
  }

  const chooseType = (nextType: CommitmentType) => {
    if (type !== nextType) resetDetails()
    setType(nextType)
    setReminder(
      nextType === "no_pagado"
        ? { dayBefore: true, hoursBefore: false, atStart: true }
        : nextType === "falta_injustificada"
          ? { dayBefore: false, hoursBefore: false, atStart: false }
          : DEFAULT_REMINDER,
    )
    setStep("details")
  }

  const detailsComplete = (() => {
    if (!type || !date) return false
    if (type === "overtime") return Boolean(startTime && endTime)
    if (type === "sport") return Boolean(startTime && endTime && activity && sportModality)
    if (type === "falta_injustificada") return Boolean(affectedShift)
    if (type === "no_pagado") return Boolean(claimSubject && claimFiledDate && startTime)
    return false
  })()

  const handleSave = () => {
    if (!type || !detailsComplete) {
      setError("Completa los campos obligatorios para guardar el registro.")
      return
    }

    let start: Date
    let end: Date
    let title = COMMITMENT_TYPE_LABELS[type]
    let details: CommitmentDetails = {}

    if (type === "falta_injustificada") {
      start = new Date(`${date}T00:00:00`)
      end = new Date(`${date}T23:59:00`)
      details = { allDay: true, affectedShift: affectedShift || undefined }
    } else if (type === "no_pagado") {
      if (claimFiledDate > date) {
        setError("La fecha de seguimiento no puede ser anterior a la fecha en que presentaste la reclamación.")
        return
      }
      start = new Date(`${date}T${startTime}:00`)
      end = plusOneHour(start)
      title = claimSubject.trim()
      details = {
        claimFiledDate,
        claimReference: claimReference.trim() || undefined,
        responsibleArea: responsibleArea.trim() || undefined,
      }
    } else {
      start = new Date(`${date}T${startTime}:00`)
      end = new Date(`${date}T${endTime}:00`)

      if (end <= start) end.setDate(end.getDate() + 1)

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (durationHours > 23) {
        setError("La duración máxima es de 23 horas. Revisa las horas de inicio y término.")
        return
      }

      if (type === "overtime") {
        details = { authorizedBy: authorizedBy.trim() || undefined }
      } else if (type === "sport") {
        title = `Deporte: ${activity.trim()}`
        details = {
          activity: activity.trim(),
          sportModality: sportModality || undefined,
        }
      }
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Revisa la fecha y el horario antes de guardar.")
      return
    }

    onSave({
      userId,
      type,
      title,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      workplace: type === "overtime" || type === "sport" ? workplace.trim() : "",
      service: type === "overtime" || type === "falta_injustificada" ? service.trim() : "",
      substituteWorkerName: "",
      notes: notes.trim(),
      details,
      reminder,
      status: "active",
    })
    reset()
    onClose()
  }

  const isTimedWork = type === "overtime" || type === "sport"
  const isOvernight = isTimedWork && startTime && endTime
    ? (() => {
        const [sh, sm] = startTime.split(":").map(Number)
        const [eh, em] = endTime.split(":").map(Number)
        return (eh * 60 + em) <= (sh * 60 + sm)
      })()
    : false

  const hours = isTimedWork && startTime && endTime
    ? (() => {
        const [sh, sm] = startTime.split(":").map(Number)
        const [eh, em] = endTime.split(":").map(Number)
        let mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins <= 0) mins += 24 * 60
        return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""}`
      })()
    : null

  const continueFromDetails = () => {
    setError(null)
    if (!detailsComplete) {
      setError("Completa los campos obligatorios para continuar.")
      return
    }
    if (type === "falta_injustificada") {
      handleSave()
      return
    }
    setStep("reminder")
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Agregar a mi agenda" size="sm">
      {step === "type" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}>
            ¿Qué necesitas registrar?
          </p>
          {TYPES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => chooseType(item.key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)", background: "var(--card)",
                cursor: "pointer", textAlign: "left", width: "100%",
                fontFamily: "inherit", fontSize: "var(--text-sm)",
                transition: "border-color var(--transition)",
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>{item.desc}</div>
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

          {type === "no_pagado" && (
            <>
              <FormField label="¿Qué estás reclamando?" htmlFor="claimSubject" required hint="Ej. Pago de tiempo extra de la segunda quincena de agosto">
                <Input id="claimSubject" value={claimSubject} onChange={(event) => setClaimSubject(event.target.value)} placeholder="Concepto o asunto pendiente" />
              </FormField>
              <FormField label="Fecha en que presentaste la reclamación" htmlFor="claimFiledDate" required>
                <Input id="claimFiledDate" type="date" value={claimFiledDate} onChange={(event) => setClaimFiledDate(event.target.value)} />
              </FormField>
              <FormField label="Folio u oficio" htmlFor="claimReference" hint="Opcional, si te entregaron uno">
                <Input id="claimReference" value={claimReference} onChange={(event) => setClaimReference(event.target.value)} placeholder="Ej. OF-1234/2026" />
              </FormField>
              <FormField label="¿Con quién darás seguimiento?" htmlFor="responsibleArea">
                <Input id="responsibleArea" value={responsibleArea} onChange={(event) => setResponsibleArea(event.target.value)} placeholder="Ej. Personal, Nómina o representación sindical" />
              </FormField>
            </>
          )}

          {type === "sport" && (
            <>
              <FormField label="Actividad deportiva" htmlFor="activity" required>
                <Input id="activity" value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Ej. Gimnasio, fútbol o activación física" />
              </FormField>
              <FormField label="¿Cómo usarás el tiempo?" htmlFor="sportModality" required>
                <Select id="sportModality" value={sportModality} onChange={(event) => setSportModality(event.target.value as SportModality)} placeholder="Selecciona una opción">
                  {Object.entries(SPORT_MODALITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </FormField>
            </>
          )}

          <FormField
            label={type === "falta_injustificada" ? "Fecha de la falta" : type === "no_pagado" ? "Próxima fecha de seguimiento" : type === "overtime" ? "Fecha del tiempo extra" : "Fecha"}
            htmlFor="date"
            required
          >
            <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormField>

          {type === "falta_injustificada" && (
            <FormField label="Turno afectado" htmlFor="affectedShift" required>
              <Select id="affectedShift" value={affectedShift} onChange={(event) => setAffectedShift(event.target.value as AffectedShift)} placeholder="Selecciona tu turno">
                {Object.entries(AFFECTED_SHIFT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
          )}

          {(isTimedWork || type === "no_pagado") && (
            <div style={{ display: "grid", gridTemplateColumns: isTimedWork ? "repeat(auto-fit, minmax(min(100%, 120px), 1fr))" : "1fr", gap: "var(--space-3)", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              <FormField label={type === "no_pagado" ? "Hora para recordarte" : "Inicio"} htmlFor="startTime" required>
                <Input id="startTime" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </FormField>
              {isTimedWork && (
                <FormField label={isOvernight ? "Término (día siguiente)" : "Término"} htmlFor="endTime" required>
                  <Input id="endTime" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </FormField>
              )}
            </div>
          )}

          {hours && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--brand-cyan)", fontWeight: 600, textAlign: "center" }}>
              <Clock size={14} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
              {hours}{isOvernight ? " (termina al día siguiente)" : ""}
            </div>
          )}

          {type === "overtime" && (
            <>
              <FormField label="Área o servicio" htmlFor="service">
                <Input id="service" value={service} onChange={(event) => setService(event.target.value)} placeholder="Ej. Urgencias o Rayos X" />
              </FormField>
              <FormField label="Unidad o centro de trabajo" htmlFor="workplace">
                <Input id="workplace" value={workplace} onChange={(event) => setWorkplace(event.target.value)} placeholder="Ej. HGR 1 Charo" />
              </FormField>
              <FormField label="¿Quién autorizó el tiempo extra?" htmlFor="authorizedBy">
                <Input id="authorizedBy" value={authorizedBy} onChange={(event) => setAuthorizedBy(event.target.value)} placeholder="Nombre o cargo" />
              </FormField>
            </>
          )}

          {type === "sport" && (
            <FormField label="Lugar" htmlFor="workplace">
              <Input id="workplace" value={workplace} onChange={(event) => setWorkplace(event.target.value)} placeholder="Ej. Unidad deportiva o gimnasio" />
            </FormField>
          )}

          {type === "falta_injustificada" && (
            <>
              <FormField label="Área o servicio afectado" htmlFor="service">
                <Input id="service" value={service} onChange={(event) => setService(event.target.value)} placeholder="Ej. Urgencias o Rayos X" />
              </FormField>
              <FormField label="¿Qué ocurrió?" htmlFor="notes" hint="Anota lo necesario para recordar el contexto si después necesitas aclararlo">
                <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe brevemente la situación" />
              </FormField>
            </>
          )}

          {type !== "falta_injustificada" && (
            <FormField label={type === "no_pagado" ? "Último acuerdo o detalle" : "Notas"} htmlFor="notes" hint="Opcional">
              <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Agrega algún dato que te ayude después" />
            </FormField>
          )}

          {error && (
            <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--error)", textAlign: "center" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <Button variant="secondary" onClick={() => setStep("type")} leadingIcon={<CaretLeft size={14} />}>Volver</Button>
            <Button onClick={continueFromDetails} disabled={!detailsComplete} trailingIcon={type === "falta_injustificada" ? undefined : <CaretRight size={14} />}>
              {type === "falta_injustificada" ? "Guardar registro" : "Continuar"}
            </Button>
          </div>
        </div>
      )}

      {step === "reminder" && type && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: 0 }}>
            {type === "no_pagado" ? "¿Cuándo quieres que te recordemos dar seguimiento?" : "¿Cuándo quieres que te recordemos?"}
          </p>

          <Checkbox
            checked={reminder.dayBefore}
            onChange={(event) => setReminder({ ...reminder, dayBefore: event.target.checked })}
            label="Un día antes (19:00)"
          />
          <Checkbox
            checked={reminder.hoursBefore}
            onChange={(event) => setReminder({ ...reminder, hoursBefore: event.target.checked })}
            label={type === "no_pagado" ? "Dos horas antes del seguimiento" : "Dos horas antes del inicio"}
          />
          <Checkbox
            checked={reminder.atStart}
            onChange={(event) => setReminder({ ...reminder, atStart: event.target.checked })}
            label={type === "no_pagado" ? "A la hora del seguimiento" : "Al iniciar"}
          />

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", marginTop: "0.5rem" }}>
            <Button variant="secondary" onClick={() => setStep("details")} leadingIcon={<CaretLeft size={14} />}>Volver</Button>
            <Button onClick={handleSave}>
              {type === "no_pagado" ? "Guardar seguimiento" : "Guardar y recordarme"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
