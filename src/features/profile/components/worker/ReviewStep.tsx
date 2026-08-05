"use client"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerProfileDraft } from "@/shared/domain/worker"

interface ReviewStepProps {
  draft: WorkerProfileDraft
  method: "manual" | "payslip"
  onEdit: () => void
  onContinue: () => void
  onBack: () => void
}

export function ReviewStep({ draft, method, onEdit, onContinue, onBack }: ReviewStepProps) {
  const sourceLabel = method === "payslip" ? "Detectado desde tarjetón" : "Capturado manualmente"
  const sourceIcon = method === "payslip" ? "📄" : "✏"

  const fields = [
    { label: "Categoría", value: draft.identity.categoria },
    { label: "Antigüedad", value: draft.situation.effectiveSeniorityDate },
    { label: "Jornada", value: draft.situation.workdayHours ? `${draft.situation.workdayHours}h` : null },
    { label: "Adscripción", value: draft.identity.adscripcion },
    { label: "Matrícula", value: draft.identity.matricula },
    { label: "Turno", value: draft.situation.shift },
    { label: "Tipo de contratación", value: draft.situation.employmentType },
  ].filter((f) => f.value)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Revisa tus datos</h2>
      {fields.map((f) => (
        <div key={f.label} style={{ padding: "0.625rem", background: "var(--accent)", borderRadius: "var(--radius)" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{f.label}</div>
          <div style={{ fontSize: "0.9375rem" }}>{f.value}</div>
          <div style={{ fontSize: "0.75rem", color: method === "payslip" ? "#16a34a" : "var(--muted)" }}>{sourceIcon} {sourceLabel}</div>
        </div>
      ))}
      {fields.length === 0 && <p style={{ color: "var(--muted)" }}>No se detectaron datos para revisar.</p>}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onEdit}>Editar</Button>
          <Button onClick={onContinue}>Continuar</Button>
        </div>
      </div>
    </div>
  )
}
