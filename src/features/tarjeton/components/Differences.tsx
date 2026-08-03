"use client"

import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { Checkbox } from "@/shared/components/ui/Checkbox"

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
  if (emp.categoryName && (profile.categoria ?? "").trim().toUpperCase() !== emp.categoryName.trim().toUpperCase()) {
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
          <Badge variant="success">Datos correctos</Badge>
          <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Los datos que se pueden importar coinciden con tu perfil.
          </span>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderColor: "var(--warning)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <Badge variant="warning">Revisa estos datos</Badge>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Marca solamente los datos que deseas actualizar en tu perfil.
        </span>
      </div>
      {differences.map((d) => (
        <Checkbox
          key={d.key}
          checked={updates[d.key] === true}
          onChange={() => onToggle(d.key)}
          style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", cursor: "pointer", fontSize: "0.875rem" }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              Guardado en tu perfil: <strong>{d.current}</strong>
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              Detectado en el tarjetón: <strong>{d.detected}</strong>
            </span>
            {d.key === "categoria" && parsed.employee.categoryCode && (
              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                Clave del puesto: {parsed.employee.categoryCode}
              </span>
            )}
          </span>
        </Checkbox>
      ))}
      {differences.some((d) => d.key === "matricula") && updates.matricula !== true && (
        <div style={{ fontSize: "0.8125rem", color: "var(--error)", background: "#fef2f2", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem" }}>
          La matrícula es diferente. Para continuar, revisa el número y autoriza el cambio marcando la casilla.
        </div>
      )}
    </Card>
  )
}
