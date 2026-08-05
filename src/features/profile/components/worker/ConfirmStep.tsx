"use client"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerProfileDraft } from "@/shared/domain/worker"

export function ConfirmStep({ draft, onConfirm, onBack, loading }: { draft: WorkerProfileDraft; onConfirm: () => void; onBack: () => void; loading: boolean }) {
  const fields = [
    { label: "Categoría", value: draft.identity.categoria },
    { label: "Antigüedad", value: draft.situation.effectiveSeniorityDate },
    { label: "Jornada", value: draft.situation.workdayHours ? `${draft.situation.workdayHours}h` : null },
    { label: "Adscripción", value: draft.identity.adscripcion },
    { label: "Matrícula", value: draft.identity.matricula },
  ].filter((f) => f.value)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>¿Confirmas estos datos?</h2>
      {fields.map((f) => (
        <div key={f.label} style={{ fontSize: "0.9375rem" }}>
          <span style={{ color: "var(--muted)" }}>{f.label}:</span> <strong>{f.value}</strong>
        </div>
      ))}
      {fields.length === 0 && <p style={{ color: "var(--muted)" }}>No hay datos para confirmar.</p>}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <Button onClick={onConfirm} loading={loading}>Confirmar y guardar</Button>
      </div>
    </div>
  )
}
