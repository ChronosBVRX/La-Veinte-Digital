"use client"

import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"

export interface Difference {
  key: keyof ConfirmTarjetonRequest["profileUpdates"]
  label: string
  current: string | null | undefined
  detected: string | null | undefined
}

export function buildDifferences(
  parsed: ParsedImssTarjeton,
  profile: TarjetonProfileSnapshot | null,
): Difference[] {
  if (!profile) return []
  const differences: Difference[] = []
  const emp = parsed.employee

  if (profile.fullName && emp.fullName && profile.fullName.trim().toUpperCase() !== emp.fullName.trim().toUpperCase()) {
    differences.push({ key: "fullName", label: "Nombre", current: profile.fullName, detected: emp.fullName })
  }
  if (profile.matricula && emp.employeeNumber && profile.matricula.trim() !== emp.employeeNumber.trim()) {
    differences.push({ key: "matricula", label: "Matrícula", current: profile.matricula, detected: emp.employeeNumber })
  }
  if (profile.adscripcion && emp.assignmentName && profile.adscripcion.trim().toUpperCase() !== emp.assignmentName.trim().toUpperCase()) {
    differences.push({ key: "adscripcion", label: "Adscripción", current: profile.adscripcion, detected: emp.assignmentName })
  }
  if (profile.categoria && emp.categoryName && profile.categoria.trim().toUpperCase() !== emp.categoryName.trim().toUpperCase()) {
    differences.push({ key: "categoria", label: "Categoría", current: profile.categoria, detected: emp.categoryName })
  }
  if (profile.antiguedad && emp.seniority?.raw && profile.antiguedad.trim().toUpperCase() !== emp.seniority.raw.trim().toUpperCase()) {
    differences.push({ key: "antiguedad", label: "Antigüedad", current: profile.antiguedad, detected: emp.seniority.raw })
  }
  return differences
}

interface DifferencesProps {
  parsed: ParsedImssTarjeton
  profile: TarjetonProfileSnapshot | null
  updates: ConfirmTarjetonRequest["profileUpdates"]
  onToggle: (key: keyof ConfirmTarjetonRequest["profileUpdates"]) => void
}

export function Differences({ parsed, profile, updates, onToggle }: DifferencesProps) {
  const differences = buildDifferences(parsed, profile)
  if (differences.length === 0) {
    return (
      <Card padding="1rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Badge variant="success">Coinciden</Badge>
          <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Los datos del tarjetón coinciden con tu perfil.
          </span>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderColor: "var(--warning)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Badge variant="warning">Diferencias con tu perfil</Badge>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Marca qué datos deseas actualizar en tu perfil.
        </span>
      </div>
      {differences.map((d) => (
        <label
          key={d.key}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          <input
            type="checkbox"
            checked={updates[d.key] === true}
            onChange={() => onToggle(d.key)}
            style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              En tu perfil: <strong>{d.current}</strong>
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              En el tarjetón: <strong>{d.detected}</strong>
            </span>
          </span>
        </label>
      ))}
      {differences.some((d) => d.key === "matricula") && updates.matricula !== true && (
        <div style={{ fontSize: "0.8125rem", color: "var(--error)", background: "#fef2f2", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem" }}>
          La matrícula no coincide con tu perfil. Debes autorizar el cambio de forma explícita para continuar.
        </div>
      )}
    </Card>
  )
}
