"use client"

import { useState, useEffect, useCallback } from "react"
import { Clock, CaretLeft, CaretRight, CalendarBlank, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select, Textarea } from "@/shared/components/ui/Input"
import { FormField } from "@/shared/components/ui/FormField"
import { Checkbox } from "@/shared/components/ui/Checkbox"
import { Modal } from "@/shared/components/ui/Modal"
import type {
  AffectedShift,
  ClaimStatus,
  CommitmentDetails,
  CommitmentType,
  ReminderPriority,
  ReminderRecurrence,
  TxtPaidStatus,
  WorkerCommitment,
} from "../types"
import {
  AFFECTED_SHIFT_LABELS,
  CLAIM_STATUS_LABELS,
  COMMITMENT_TYPE_ICONS,
  COMMITMENT_TYPE_LABELS,
  REMINDER_PRIORITY_LABELS,
  REMINDER_RECURRENCE_LABELS,
  TXT_PAID_STATUS_LABELS,
} from "../types"
import { getFortnightInfo, calculateFaltaDescuento } from "../lib/falta-calculo"

interface CommitmentFormProps {
  open: boolean
  onClose: () => void
  onSave: (c: Omit<WorkerCommitment, "id" | "createdAt">) => void
  userId: string
}

type Step = "type" | "details" | "reminder"

const TYPES: { key: CommitmentType; label: string; icon: string; desc: string }[] = [
  { key: "overtime", label: "Tiempo extra", icon: "⏱", desc: "Turno, horario y persona que autorizó" },
  { key: "falta_injustificada", label: "Falta injustificada", icon: "🚫", desc: "Turno, quincena afectada y descuento estimado" },
  { key: "no_pagado", label: "Reclamación pendiente", icon: "📋", desc: "Asunto, folio, área y fecha/hora de seguimiento" },
  { key: "txt_substitution", label: "TxT", icon: "🔄", desc: "Sustitución, turno, horario y estatus de pago" },
  { key: "general_reminder", label: "Recordatorio general", icon: "🔔", desc: "Título, descripción, prioridad y recordatorio" },
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
  const [affectedShift, setAffectedShift] = useState<AffectedShift | "">("")
  const [claimSubject, setClaimSubject] = useState("")
  const [claimFiledDate, setClaimFiledDate] = useState("")
  const [claimReference, setClaimReference] = useState("")
  const [responsibleArea, setResponsibleArea] = useState("")
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("pendiente")
  const [substituteWorkerName, setSubstituteWorkerName] = useState("")
  const [paidStatus, setPaidStatus] = useState<TxtPaidStatus>("pendiente")
  const [generalTitle, setGeneralTitle] = useState("")
  const [allDay, setAllDay] = useState(false)
  const [reminderDate, setReminderDate] = useState("")
  const [reminderTime, setReminderTime] = useState("")
  const [priority, setPriority] = useState<ReminderPriority>("normal")
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notes, setNotes] = useState("")
  const [reminder, setReminder] = useState(DEFAULT_REMINDER)
  const [error, setError] = useState<string | null>(null)

  // Sueldo base para el cálculo de falta injustificada
  const [baseSalary, setBaseSalary] = useState<number | null>(null)
  const [salaryLoaded, setSalaryLoaded] = useState(false)

  useEffect(() => {
    if (type === "falta_injustificada" && !salaryLoaded) {
      let isMounted = true
      fetch("/api/calculator-prefill?calculator=tiempo-extra")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return
          const val = data?.fields?.concepto002?.value
          if (typeof val === "number" && val > 0) {
            setBaseSalary(val)
          }
          setSalaryLoaded(true)
        })
        .catch(() => {
          if (isMounted) setSalaryLoaded(true)
        })
      return () => {
        isMounted = false
      }
    }
  }, [type, salaryLoaded])

  const resetDetails = () => {
    setDate("")
    setStartTime("")
    setEndTime("")
    setWorkplace("")
    setService("")
    setAuthorizedBy("")
    setAffectedShift("")
    setClaimSubject("")
    setClaimFiledDate("")
    setClaimReference("")
    setResponsibleArea("")
    setClaimStatus("pendiente")
    setSubstituteWorkerName("")
    setPaidStatus("pendiente")
    setGeneralTitle("")
    setAllDay(false)
    setReminderDate("")
    setReminderTime("")
    setPriority("normal")
    setRecurrence("none")
    setNotificationsEnabled(true)
    setNotes("")
    setError(null)
  }

  const reset = () => {
    setStep("type")
    setType(null)
    resetDetails()
    setReminder(DEFAULT_REMINDER)
  }

  // Cierre estable: protección adicional para no entregar al Modal una
  // identidad nueva de onClose en cada render del formulario. El arreglo
  // principal vive en el Modal compartido (no reinicializa foco por renders).
  const handleClose = useCallback(() => {
    reset()
    onClose()
    // reset() solo invoca setters estables de useState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

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

  // Validación de completitud según tipo
  const detailsComplete = (() => {
    if (!type || !date) return false
    if (type === "overtime") return Boolean(startTime && endTime && affectedShift && authorizedBy.trim())
    if (type === "falta_injustificada") return Boolean(affectedShift)
    if (type === "no_pagado") return Boolean(claimSubject.trim() && claimFiledDate && startTime)
    if (type === "txt_substitution") return Boolean(substituteWorkerName.trim() && affectedShift && startTime && endTime)
    if (type === "general_reminder") return Boolean(generalTitle.trim() && (allDay || startTime))
    return false
  })()

  // Cálculos reactivos de falta injustificada
  const fortnightInfo = date && type === "falta_injustificada" ? getFortnightInfo(date) : null
  const faltaDeduction = type === "falta_injustificada" ? calculateFaltaDescuento({ baseSalaryFortnightly: baseSalary }) : null

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
      details = {
        allDay: true,
        affectedShift: affectedShift || undefined,
        shift: affectedShift || undefined,
        affectedFortnight: fortnightInfo ? `${fortnightInfo.fortnightNumber}ª quincena` : undefined,
        fortnightLabel: fortnightInfo?.label,
        baseSalaryUsed: faltaDeduction?.baseSalaryUsed,
        dailySalary: faltaDeduction?.dailySalary,
        estimatedDeduction: faltaDeduction?.estimatedDeduction,
        deductionFormula: faltaDeduction?.formula,
        calculationStatus: faltaDeduction?.status,
        missingDataReason: faltaDeduction?.missingDataReason,
      }
    } else if (type === "no_pagado") {
      if (claimFiledDate > date) {
        setError("La fecha de seguimiento no puede ser anterior a la fecha en que presentaste la solicitud.")
        return
      }
      start = new Date(`${date}T${startTime}:00`)
      end = plusOneHour(start)
      title = claimSubject.trim()
      details = {
        claimFiledDate,
        claimReference: claimReference.trim() || undefined,
        responsibleArea: responsibleArea.trim() || undefined,
        claimStatus,
      }
    } else if (type === "general_reminder") {
      title = generalTitle.trim()
      if (allDay) {
        start = new Date(`${date}T00:00:00`)
        end = new Date(`${date}T23:59:00`)
      } else {
        start = new Date(`${date}T${startTime}:00`)
        end = endTime ? new Date(`${date}T${endTime}:00`) : plusOneHour(start)
        if (end <= start) end.setDate(end.getDate() + 1)
      }

      let scheduledReminderAt: string | undefined
      if (reminderDate && reminderTime) {
        scheduledReminderAt = `${reminderDate}T${reminderTime}:00`
      } else if (reminderTime) {
        scheduledReminderAt = `${date}T${reminderTime}:00`
      }

      details = {
        allDay,
        priority,
        recurrence,
        notificationsEnabled,
        location: workplace.trim() || undefined,
        reminderAt: scheduledReminderAt,
      }
    } else if (type === "txt_substitution") {
      start = new Date(`${date}T${startTime}:00`)
      end = new Date(`${date}T${endTime}:00`)
      if (end <= start) end.setDate(end.getDate() + 1)

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (durationHours > 24) {
        setError("La duración de la sustitución no puede exceder 24 horas.")
        return
      }

      title = `TxT: ${substituteWorkerName.trim()}`
      details = {
        shift: affectedShift || undefined,
        affectedShift: affectedShift || undefined,
        paidStatus,
      }
    } else {
      // overtime
      start = new Date(`${date}T${startTime}:00`)
      end = new Date(`${date}T${endTime}:00`)
      if (end <= start) end.setDate(end.getDate() + 1)

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (durationHours > 24) {
        setError("La duración máxima es de 24 horas. Revisa las horas de inicio y término.")
        return
      }

      details = {
        shift: affectedShift || undefined,
        affectedShift: affectedShift || undefined,
        authorizedBy: authorizedBy.trim(),
      }
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Revisa la fecha y el horario antes de guardar.")
      return
    }

    const effectiveReminder =
      type === "falta_injustificada"
        ? { dayBefore: false, hoursBefore: false, atStart: false }
        : type === "general_reminder"
          ? {
              dayBefore: notificationsEnabled,
              hoursBefore: false,
              atStart: notificationsEnabled && !details.reminderAt,
            }
          : type === "no_pagado"
            ? { dayBefore: true, hoursBefore: false, atStart: true }
            : reminder

    onSave({
      userId,
      type,
      title,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      workplace: workplace.trim(),
      service: service.trim(),
      substituteWorkerName: substituteWorkerName.trim(),
      notes: notes.trim(),
      details,
      reminder: effectiveReminder,
      status: "active",
    })
    reset()
    onClose()
  }

  const isTimedWork = type === "overtime" || type === "txt_substitution" || (type === "general_reminder" && !allDay && startTime && endTime)
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
    <Modal open={open} onClose={handleClose} title="Agregar a mi agenda" size="sm">
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

          {/* 1. TIEMPO EXTRA */}
          {type === "overtime" && (
            <>
              <FormField label="Fecha del tiempo extra" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>

              <FormField label="Turno" htmlFor="affectedShift" required>
                <Select id="affectedShift" value={affectedShift} onChange={(e) => setAffectedShift(e.target.value as AffectedShift)} placeholder="Selecciona el turno">
                  {Object.entries(AFFECTED_SHIFT_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </Select>
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <FormField label="Hora de inicio" htmlFor="startTime" required>
                  <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </FormField>
                <FormField label={isOvernight ? "Hora de término (+1 día)" : "Hora de término"} htmlFor="endTime" required>
                  <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </FormField>
              </div>

              {hours && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--brand-cyan)", fontWeight: 600, textAlign: "center" }}>
                  <Clock size={14} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
                  {hours}{isOvernight ? " (termina al día siguiente)" : ""}
                </div>
              )}

              <FormField label="Persona que autorizó" htmlFor="authorizedBy" required hint="Nombre o cargo de quien autorizó el tiempo extra">
                <Input id="authorizedBy" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} placeholder="Ej. Jefatura de Servicio" />
              </FormField>

              <FormField label="Observaciones" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anota detalles relevantes si lo requieres" />
              </FormField>
            </>
          )}

          {/* 2. FALTA INJUSTIFICADA */}
          {type === "falta_injustificada" && (
            <>
              <FormField label="Fecha de la falta" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>

              <FormField label="Turno afectado" htmlFor="affectedShift" required>
                <Select id="affectedShift" value={affectedShift} onChange={(e) => setAffectedShift(e.target.value as AffectedShift)} placeholder="Selecciona el turno">
                  {Object.entries(AFFECTED_SHIFT_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Servicio o área" htmlFor="service">
                <Input id="service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Ej. Urgencias, Rayos X, Archivo" />
              </FormField>

              {/* Panel informativo de cálculo automático */}
              {date && (
                <div style={{
                  padding: "0.875rem",
                  background: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  fontSize: "var(--text-xs)",
                }}>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--fg)" }}>
                    <CalendarBlank size={16} />
                    <span>Cálculo de impacto en nómina</span>
                  </div>

                  <div>
                    <span style={{ color: "var(--muted)" }}>Quincena afectada: </span>
                    <strong style={{ color: "var(--fg)" }}>{fortnightInfo?.label}</strong>
                  </div>

                  {faltaDeduction?.status === "calculated" ? (
                    <>
                      <div>
                        <span style={{ color: "var(--muted)" }}>Salario base utilizado: </span>
                        <strong style={{ color: "var(--fg)" }}>${faltaDeduction.baseSalaryUsed?.toLocaleString("es-MX", { minimumFractionDigits: 2 })} quincenal</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--muted)" }}>Fórmula: </span>
                        <span style={{ fontFamily: "monospace", color: "var(--fg)" }}>{faltaDeduction.formula}</span>
                      </div>
                      <div style={{ marginTop: "0.25rem", padding: "0.35rem 0.5rem", background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", borderRadius: "var(--radius-sm)", fontWeight: 600 }}>
                        Descuento estimado: ${faltaDeduction.estimatedDeduction?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: "0.25rem", padding: "0.5rem", background: "rgba(245, 158, 11, 0.1)", color: "#b45309", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "flex-start", gap: "0.35rem" }}>
                      <WarningCircle size={16} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                      <div>
                        <strong>Pendiente de calcular:</strong> {faltaDeduction?.missingDataReason}
                        <div style={{ marginTop: "0.2rem", fontSize: "0.6875rem", color: "var(--muted)" }}>
                          Puedes consultar tu tarjetón en tu perfil para que el cálculo se realice automáticamente.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <FormField label="Motivo u observaciones" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe brevemente la situación" />
              </FormField>
            </>
          )}

          {/* 3. RECLAMACIÓN PENDIENTE */}
          {type === "no_pagado" && (
            <>
              <FormField label="¿Qué estás reclamando?" htmlFor="claimSubject" required hint="Ej. Pago de tiempo extra o guardia festiva">
                <Input id="claimSubject" value={claimSubject} onChange={(e) => setClaimSubject(e.target.value)} placeholder="Concepto o trámite reclamado" />
              </FormField>

              <FormField label="Fecha de la solicitud" htmlFor="claimFiledDate" required>
                <Input id="claimFiledDate" type="date" value={claimFiledDate} onChange={(e) => setClaimFiledDate(e.target.value)} />
              </FormField>

              <FormField label="Folio" htmlFor="claimReference" hint="Opcional si cuentas con folio u oficio">
                <Input id="claimReference" value={claimReference} onChange={(e) => setClaimReference(e.target.value)} placeholder="Ej. OF-2026/089" />
              </FormField>

              <FormField label="Persona, área o departamento con quien se da seguimiento" htmlFor="responsibleArea">
                <Input id="responsibleArea" value={responsibleArea} onChange={(e) => setResponsibleArea(e.target.value)} placeholder="Ej. Delegación sindical, Personal o Nóminas" />
              </FormField>

              <FormField label="Fecha para volver a recordarlo" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>

              <FormField label="Hora del recordatorio" htmlFor="startTime" required>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </FormField>

              <FormField label="Estado de la reclamación" htmlFor="claimStatus">
                <Select id="claimStatus" value={claimStatus} onChange={(e) => setClaimStatus(e.target.value as ClaimStatus)}>
                  {Object.entries(CLAIM_STATUS_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Notas" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Últimos acuerdos o detalles" />
              </FormField>
            </>
          )}

          {/* 4. TXT */}
          {type === "txt_substitution" && (
            <>
              <FormField label="Fecha de la sustitución" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>

              <FormField label="Persona a quien vas a sustituir" htmlFor="substituteWorkerName" required>
                <Input id="substituteWorkerName" value={substituteWorkerName} onChange={(e) => setSubstituteWorkerName(e.target.value)} placeholder="Nombre del compañero" />
              </FormField>

              <FormField label="Turno" htmlFor="affectedShift" required>
                <Select id="affectedShift" value={affectedShift} onChange={(e) => setAffectedShift(e.target.value as AffectedShift)} placeholder="Selecciona el turno">
                  {Object.entries(AFFECTED_SHIFT_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </Select>
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <FormField label="Hora de inicio" htmlFor="startTime" required>
                  <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </FormField>
                <FormField label={isOvernight ? "Hora de término (+1 día)" : "Hora de término"} htmlFor="endTime" required>
                  <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </FormField>
              </div>

              {hours && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--brand-cyan)", fontWeight: 600, textAlign: "center" }}>
                  <Clock size={14} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
                  {hours}{isOvernight ? " (termina al día siguiente)" : ""}
                </div>
              )}

              <FormField label="¿Ya se pagó?" htmlFor="paidStatus" required>
                <Select id="paidStatus" value={paidStatus} onChange={(e) => setPaidStatus(e.target.value as TxtPaidStatus)}>
                  {Object.entries(TXT_PAID_STATUS_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Área de servicio" htmlFor="service">
                <Input id="service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Ej. Medicina Interna o Terapia" />
              </FormField>

              <FormField label="Lugar de adscripción" htmlFor="workplace">
                <Input id="workplace" value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="Ej. HGZ 83 Camelinas" />
              </FormField>

              <FormField label="Observaciones" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre la sustitución" />
              </FormField>
            </>
          )}

          {/* 5. RECORDATORIO GENERAL */}
          {type === "general_reminder" && (
            <>
              <FormField label="Título" htmlFor="generalTitle" required>
                <Input id="generalTitle" value={generalTitle} onChange={(e) => setGeneralTitle(e.target.value)} placeholder="Ej. Trámite de gafete, reunión o entrega" />
              </FormField>

              <FormField label="Descripción" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles o instrucciones del recordatorio" />
              </FormField>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <Checkbox
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  label="Evento de todo el día"
                />
              </div>

              <FormField label="Fecha del evento" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>

              {!allDay && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <FormField label="Hora de inicio" htmlFor="startTime" required>
                    <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </FormField>
                  <FormField label="Hora de término" htmlFor="endTime">
                    <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </FormField>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Configuración de aviso
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <FormField label="Fecha recordatorio" htmlFor="reminderDate">
                    <Input id="reminderDate" type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
                  </FormField>
                  <FormField label="Hora recordatorio" htmlFor="reminderTime">
                    <Input id="reminderTime" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                  </FormField>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Checkbox
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    label="Activar notificación en la fecha/hora configurada"
                  />
                </div>
              </div>

              <FormField label="Ubicación" htmlFor="workplace" hint="Opcional">
                <Input id="workplace" value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="Ej. Auditorio, Jefatura o Dirección" />
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <FormField label="Prioridad" htmlFor="priority">
                  <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as ReminderPriority)}>
                    {Object.entries(REMINDER_PRIORITY_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Repetición" htmlFor="recurrence">
                  <Select id="recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value as ReminderRecurrence)}>
                    {Object.entries(REMINDER_RECURRENCE_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </>
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
            {type === "no_pagado"
              ? "¿Cuándo quieres que te recordemos dar seguimiento?"
              : type === "general_reminder"
                ? "¿Deseas recordatorios adicionales para este evento?"
                : "¿Cuándo quieres que te recordemos?"}
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
              {type === "no_pagado" ? "Guardar seguimiento" : "Guardar y programar"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
