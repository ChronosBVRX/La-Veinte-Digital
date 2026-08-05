"use client"
import type { WorkerFieldName, WorkerFieldSource, FieldRequirement } from "@/shared/domain/worker"

const SOURCE_LABELS: Record<string, { text: string; color: string }> = {
  payslip_confirmed: { text: "✓ Confirmado desde tarjetón", color: "#16a34a" },
  manual: { text: "✏ Capturado manualmente", color: "#2563eb" },
  calculated: { text: "⚡ Calculado", color: "#6b7280" },
  inferred: { text: "⚠ Inferido", color: "#d97706" },
}

export function ProfileFieldRow({ field, value, source, requirements }: { field: WorkerFieldName; value: string; source?: WorkerFieldSource; requirements: readonly FieldRequirement[] }) {
  const req = requirements.find((r) => r.field === field)
  const srcInfo = source ? SOURCE_LABELS[source] : null
  const label = { categoria: "Categoría", effectiveSeniorityDate: "Antigüedad", workdayHours: "Jornada", matricula: "Matrícula", adscripcion: "Adscripción", employmentType: "Contratación", shift: "Turno" }[field] ?? field

  return (
    <div style={{ background: "var(--accent)", borderRadius: "var(--radius)", padding: "0.625rem 0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{label}</div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{value}</div>
        </div>
      </div>
      <div style={{ marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        {srcInfo && <span style={{ fontSize: "0.75rem", color: srcInfo.color, fontWeight: 500 }}>{srcInfo.text}</span>}
        {req && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{req.whyMessage}</span>}
      </div>
    </div>
  )
}
