"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import type {
  EmployeePayrollProfile,
  OccupationalCondition,
  JornadaHoras,
  EmploymentType,
  Shift,
} from "../lib/types"

interface NominaProfileWizardProps {
  profile: EmployeePayrollProfile | null
  onSave: (profile: EmployeePayrollProfile) => void
}

export function NominaProfileWizard({ profile, onSave }: NominaProfileWizardProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    categoryId: profile?.categoryId ?? "",
    categoryName: profile?.categoryName ?? "",
    employmentType: (profile?.employmentType ?? "base") as EmploymentType,
    workdayHours: String(profile?.workdayHours ?? "8") as string,
    shift: (profile?.shift ?? "matutino") as Shift,
    institutionalEntryDate: profile?.institutionalEntryDate ?? "",
    effectiveSeniorityDate: profile?.effectiveSeniorityDate ?? "",
  })
  const [conditions, setConditions] = useState<OccupationalCondition[]>(
    profile?.occupationalConditions ?? []
  )
  const [saved, setSaved] = useState(false)

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCondition(type: OccupationalCondition["type"]) {
    setConditions((prev) => {
      const exists = prev.find((c) => c.type === type)
      if (exists) {
        return prev.filter((c) => c.type !== type)
      }
      return [...prev, { type, enabled: true, permanentExposure: type === "radiation_non_medical" }]
    })
  }

  function setPermanentExposure(value: boolean) {
    setConditions((prev) =>
      prev.map((c) =>
        c.type === "radiation_non_medical" ? { ...c, permanentExposure: value } : c
      )
    )
  }

  function buildProfile(): EmployeePayrollProfile {
    return {
      id: profile?.id ?? crypto.randomUUID?.() ?? `${Date.now()}`,
      userId: profile?.userId ?? "",
      consentGiven: true,
      consentDate: profile?.consentDate ?? new Date().toISOString(),
      categoryId: form.categoryId || undefined,
      categoryName: form.categoryName || undefined,
      employmentType: form.employmentType,
      workdayHours: parseFloat(form.workdayHours) as JornadaHoras,
      shift: form.shift,
      institutionalEntryDate: form.institutionalEntryDate || undefined,
      effectiveSeniorityDate: form.effectiveSeniorityDate || undefined,
      occupationalConditions: conditions,
      recurringConceptOverrides: profile?.recurringConceptOverrides,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  function handleSave() {
    onSave(buildProfile())
    setSaved(true)
  }

  const employmentTypes: { value: EmploymentType; label: string }[] = [
    { value: "base", label: "Base" },
    { value: "sustituto", label: "Sustituto" },
    { value: "interino", label: "Interino" },
    { value: "obra_determinada", label: "Obra Determinada" },
    { value: "confianza", label: "Confianza" },
    { value: "otro", label: "Otro" },
  ]

  const shifts: { value: Shift; label: string }[] = [
    { value: "matutino", label: "Matutino" },
    { value: "vespertino", label: "Vespertino" },
    { value: "nocturno", label: "Nocturno" },
    { value: "jornada_acumulada", label: "Jornada Acumulada" },
    { value: "mixto", label: "Mixto" },
  ]

  const workdayOptions = [
    { value: "6.5", label: "6.5 horas" },
    { value: "8", label: "8 horas" },
    { value: "12", label: "12 horas" },
  ]

  if (saved) {
    return (
      <Card padding="1.5rem" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#10003;</div>
        <h3 style={{ margin: "0 0 0.25rem" }}>Perfil guardado</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          Tus datos laborales est&aacute;n listos. Ahora puedes generar tu proyecci&oacute;n de n&oacute;mina.
        </p>
      </Card>
    )
  }

  return (
    <Card padding="1.5rem">
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{
          display: "flex", gap: "0.375rem", alignItems: "center",
          marginBottom: "0.75rem",
        }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: "4px", borderRadius: "2px",
                background: s <= step ? "var(--primary)" : "var(--border)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
          Paso {step} de 3
        </p>
      </div>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Datos laborales</h3>
          <Input
            label="Categoría (nombre o código)"
            value={form.categoryName}
            onChange={(e) => handleChange("categoryName", e.target.value)}
            placeholder="Ej: ABOGADO 80"
          />
          <Select
            id="employmentType"
            label="Tipo de contratación"
            value={form.employmentType}
            onChange={(e) => handleChange("employmentType", e.target.value)}
          >
            {employmentTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Select
            id="workdayHours"
            label="Jornada (horas diarias)"
            value={form.workdayHours}
            onChange={(e) => handleChange("workdayHours", e.target.value)}
          >
            {workdayOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select
            id="shift"
            label="Turno"
            value={form.shift}
            onChange={(e) => handleChange("shift", e.target.value)}
          >
            {shifts.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Antigüedad</h3>
          <Input
            label="Fecha institucional de ingreso"
            type="date"
            value={form.institutionalEntryDate}
            onChange={(e) => handleChange("institutionalEntryDate", e.target.value)}
          />
          <Input
            label="Fecha efectiva de antigüedad"
            type="date"
            value={form.effectiveSeniorityDate}
            onChange={(e) => handleChange("effectiveSeniorityDate", e.target.value)}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
            La fecha efectiva es la que aparece en tu tarjet&oacute;n de n&oacute;mina
            como base para calcular antig&uuml;edad.
          </p>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Condiciones laborales</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Selecciona las condiciones que aplican a tu puesto.
          </p>

          <label style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.625rem", borderRadius: "var(--radius)",
            border: "1px solid var(--border)", cursor: "pointer",
            background: conditions.some((c) => c.type === "radiation_non_medical")
              ? "rgba(37,99,235,0.04)" : "transparent",
          }}>
            <input
              type="checkbox"
              checked={conditions.some((c) => c.type === "radiation_non_medical")}
              onChange={() => toggleCondition("radiation_non_medical")}
            />
            <div>
              <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>Emanaciones Radiactivas no M&eacute;dicas</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Exposici&oacute;n constante y permanente</div>
            </div>
          </label>

          {conditions.some((c) => c.type === "radiation_non_medical" && c.enabled) && (
            <label style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.5rem 0.625rem", fontSize: "0.8125rem",
            }}>
              <input
                type="checkbox"
                checked={conditions.some(
                  (c) => c.type === "radiation_non_medical" && c.permanentExposure
                )}
                onChange={(e) => setPermanentExposure(e.target.checked)}
              />
              Exposici&oacute;n constante y permanente
            </label>
          )}

          <label style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.625rem", borderRadius: "var(--radius)",
            border: "1px solid var(--border)", cursor: "pointer",
            background: conditions.some((c) => c.type === "nursing")
              ? "rgba(37,99,235,0.04)" : "transparent",
          }}>
            <input
              type="checkbox"
              checked={conditions.some((c) => c.type === "nursing")}
              onChange={() => toggleCondition("nursing")}
            />
            <div>
              <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>Enfermer&iacute;a</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Personal de enfermer&iacute;a</div>
            </div>
          </label>
        </div>
      )}

      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: "1.5rem", paddingTop: "1rem",
        borderTop: "1px solid var(--border)",
      }}>
        {step > 1 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Anterior
          </Button>
        ) : <div />}
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Siguiente</Button>
        ) : (
          <Button onClick={handleSave}>Guardar perfil</Button>
        )}
      </div>
    </Card>
  )
}
