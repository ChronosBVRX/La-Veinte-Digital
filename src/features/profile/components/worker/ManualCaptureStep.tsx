"use client"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerProfileDraft, JornadaHoras, WorkerFieldName } from "@/shared/domain/worker"
import { FIELD_REQUIREMENTS } from "@/shared/domain/worker"

interface Props { draft: WorkerProfileDraft; onChange: (d: WorkerProfileDraft) => void; onContinue: () => void; onBack: () => void }

function addField(draft: WorkerProfileDraft, field: WorkerFieldName): WorkerProfileDraft {
  return { ...draft, confirmedFields: [...new Set([...draft.confirmedFields, field])] }
}

export function ManualCaptureStep({ draft, onChange, onContinue, onBack }: Props) {
  const field = (f: string) => FIELD_REQUIREMENTS.find((r) => r.field === f)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Datos básicos</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Categoría</label>
          <Input
            value={draft.identity.categoria ?? ""}
            onChange={(e) => onChange(addField({ ...draft, identity: { ...draft.identity, categoria: e.target.value || null } }, "categoria"))}
            placeholder="Ej: TÉCNICO RADIÓLOGO 80"
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>{field("categoria")?.whyMessage}</p>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Antigüedad (fecha de ingreso al IMSS)</label>
          <Input
            type="date"
            value={draft.situation.effectiveSeniorityDate ?? ""}
            onChange={(e) => onChange(addField({ ...draft, situation: { ...draft.situation, effectiveSeniorityDate: e.target.value || null } }, "effectiveSeniorityDate"))}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>{field("effectiveSeniorityDate")?.whyMessage}</p>
        </div>
        <fieldset style={{ border: "none", padding: 0 }}>
          <legend style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Jornada (horas al día)</legend>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {([6, 6.5, 8, 12] as JornadaHoras[]).map((h) => (
              <label key={h} style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <input
                  type="radio"
                  name="workdayHours"
                  checked={draft.situation.workdayHours === h}
                  onChange={() => onChange(addField({ ...draft, situation: { ...draft.situation, workdayHours: h } }, "workdayHours"))}
                />
                {h}h
              </label>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>{field("workdayHours")?.whyMessage}</p>
        </fieldset>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Adscripción (opcional)</label>
          <Input
            value={draft.identity.adscripcion ?? ""}
            onChange={(e) => onChange(addField({ ...draft, identity: { ...draft.identity, adscripcion: e.target.value || null } }, "adscripcion"))}
            placeholder="Ej: HGZ 32"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Matrícula (opcional)</label>
          <Input
            value={draft.identity.matricula ?? ""}
            onChange={(e) => onChange(addField({ ...draft, identity: { ...draft.identity, matricula: e.target.value || null } }, "matricula"))}
            placeholder="Ej: 12345678"
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <Button onClick={onContinue} disabled={!draft.identity.categoria?.trim()}>Continuar</Button>
      </div>
    </div>
  )
}
