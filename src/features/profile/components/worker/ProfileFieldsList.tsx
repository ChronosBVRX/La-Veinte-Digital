"use client"
import type { WorkerProfile, FieldRequirement, WorkerFieldName, WorkerFieldSource } from "@/shared/domain/worker"
import { ProfileFieldRow } from "./ProfileFieldRow"

export function ProfileFieldsList({ profile, requirements }: { profile: WorkerProfile; requirements: readonly FieldRequirement[] }) {
  const allFields: Array<{ field: WorkerFieldName; value: string | null; source?: WorkerFieldSource }> = [
    { field: "categoria" as WorkerFieldName, value: profile.identity.categoria ?? null, source: profile.sources.categoria },
    { field: "effectiveSeniorityDate" as WorkerFieldName, value: profile.situation.effectiveSeniorityDate ?? null, source: profile.sources.effectiveSeniorityDate },
    { field: "workdayHours" as WorkerFieldName, value: profile.situation.workdayHours ? `${profile.situation.workdayHours}h` : null, source: profile.sources.workdayHours },
    { field: "matricula" as WorkerFieldName, value: profile.identity.matricula ?? null, source: profile.sources.matricula },
    { field: "adscripcion" as WorkerFieldName, value: profile.identity.adscripcion ?? null, source: profile.sources.adscripcion },
    { field: "employmentType" as WorkerFieldName, value: profile.situation.employmentType ?? null, source: profile.sources.employmentType },
    { field: "shift" as WorkerFieldName, value: profile.situation.shift ?? null, source: profile.sources.shift },
  ].filter((f) => f.value)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Tus datos laborales</h3>
      {allFields.map((f) => (
        <ProfileFieldRow key={f.field} field={f.field} value={f.value!} source={f.source} requirements={requirements} />
      ))}
    </div>
  )
}
