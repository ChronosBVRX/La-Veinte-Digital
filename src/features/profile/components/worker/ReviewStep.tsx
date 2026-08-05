"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import type { WorkerProfileDraft, WorkerFieldName } from "@/shared/domain/worker"
import type { DetectedField } from "./payslip-adapter"
import { FIELD_REQUIREMENTS } from "@/shared/domain/worker"

interface ReviewStepProps {
  draft: WorkerProfileDraft
  method: "manual" | "payslip"
  detectedFields: DetectedField[]
  requiresConfirmation: WorkerFieldName[]
  warnings: string[]
  /** Valor anterior del perfil si existe (para mostrar diffs) */
  previousValues?: Partial<Record<WorkerFieldName, string | null>>
  onDraftChange: (d: WorkerProfileDraft) => void
  onEdit: () => void
  onContinue: () => void
  onBack: () => void
}

const FIELD_NAMES: Record<string, string> = {
  matricula: "Matrícula", adscripcion: "Adscripción", categoria: "Categoría",
  workdayHours: "Jornada", effectiveSeniorityDate: "Antigüedad", shift: "Turno",
  employmentType: "Tipo de contratación",
}

export function ReviewStep({
  draft, method, detectedFields, requiresConfirmation, warnings,
  previousValues, onDraftChange, onEdit, onContinue, onBack,
}: ReviewStepProps) {
  const [editingField, setEditingField] = useState<WorkerFieldName | null>(null)
  const [editValue, setEditValue] = useState("")

  const sourceLabel = method === "payslip" ? "Detectado desde tarjetón" : "Capturado manualmente"

  const isSelected = (f: WorkerFieldName) => draft.confirmedFields.includes(f)

  const toggle = (f: WorkerFieldName) => {
    const next = isSelected(f)
      ? draft.confirmedFields.filter((x) => x !== f)
      : [...draft.confirmedFields, f]
    const updated = { ...draft, confirmedFields: next }
    if (!next.includes(f)) {
      if (["matricula", "adscripcion", "categoria"].includes(f)) updated.identity = { ...updated.identity, [f]: null }
      if (["workdayHours", "shift", "effectiveSeniorityDate", "employmentType"].includes(f)) updated.situation = { ...updated.situation, [f]: null }
    }
    onDraftChange(updated)
  }

  const startEdit = (f: WorkerFieldName, value: string | null) => {
    setEditingField(f)
    setEditValue(value ?? "")
  }

  const saveEdit = () => {
    if (!editingField) return
    const updated = { ...draft }
    const v = editValue.trim() || null
    if (["matricula", "adscripcion", "categoria"].includes(editingField)) {
      updated.identity = { ...updated.identity, [editingField]: v }
    }
    if (["workdayHours", "shift", "effectiveSeniorityDate", "employmentType"].includes(editingField)) {
      updated.situation = { ...updated.situation, [editingField]: v }
    }
    onDraftChange(updated)
    setEditingField(null)
  }

  const getFieldValue = (f: WorkerFieldName): string | null => {
    if (["matricula", "adscripcion", "categoria"].includes(f)) return draft.identity[f as keyof typeof draft.identity] ?? null
    if (f === "workdayHours") return draft.situation.workdayHours ? `${draft.situation.workdayHours}h` : null
    return draft.situation[f as keyof typeof draft.situation] as string | null ?? null
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Revisa tus datos</h2>

      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: "0.8125rem", background: "#fffbeb", border: "1px solid #fde68a", padding: "0.5rem", borderRadius: "0.25rem", color: "#92400e" }}>{w}</div>
      ))}

      {detectedFields.map((df) => {
        const selected = isSelected(df.field)
        const needsConfirmation = requiresConfirmation.includes(df.field)
        const prev = previousValues?.[df.field]
        const req = FIELD_REQUIREMENTS.find((r) => r.field === df.field)

        return (
          <div key={df.field} style={{
            padding: "0.625rem", borderRadius: "var(--radius)",
            border: `1px solid ${needsConfirmation ? "#fde68a" : "var(--border)"}`,
            background: selected ? "var(--accent)" : "transparent",
            opacity: needsConfirmation ? 0.9 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(df.field)}
                disabled={needsConfirmation}
                aria-label={`Incluir ${FIELD_NAMES[df.field] ?? df.field}`}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{FIELD_NAMES[df.field] ?? df.field}</div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                  {editingField === df.field ? (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <Input type={df.field === "effectiveSeniorityDate" ? "date" : "text"} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      <Button size="sm" onClick={saveEdit}>Guardar</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingField(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <>{getFieldValue(df.field) ?? <span style={{ color: "var(--muted)" }}>—</span>}</>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", color: method === "payslip" ? "#16a34a" : "var(--muted)" }}>
                    {sourceLabel}
                    {df.confidence != null && ` · ${Math.round(df.confidence * 100)}% confianza`}
                  </span>
                  {prev && prev !== getFieldValue(df.field) && (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Anterior: {prev}</span>
                  )}
                  {needsConfirmation && (
                    <span style={{ fontSize: "0.75rem", color: "#d97706" }}>Requiere confirmación manual</span>
                  )}
                  {req && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{req.whyMessage}</span>}
                </div>
              </div>
              {editingField !== df.field && (
                <Button variant="ghost" size="sm" onClick={() => startEdit(df.field, getFieldValue(df.field))}>Editar</Button>
              )}
            </div>
          </div>
        )
      })}

      {detectedFields.length === 0 && <p style={{ color: "var(--muted)" }}>No se detectaron datos para revisar.</p>}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <Button onClick={onContinue}>Continuar</Button>
      </div>
    </div>
  )
}
