"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import { createClient } from "@/lib/supabase/client"
import { deriveWorkdayHoursFromCategoryName } from "../lib/types"
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
    ooad: profile?.ooad ?? "",
    region: profile?.region ?? "",
    unitCode: profile?.unitCode ?? "",
    serviceCode: profile?.serviceCode ?? "",
    positionCode: profile?.positionCode ?? "",
    seniorityYears: String(profile?.displayedSeniorityAtLastPayslip?.years ?? ""),
    seniorityMonths: String(profile?.displayedSeniorityAtLastPayslip?.months ?? ""),
    seniorityDays: String(profile?.displayedSeniorityAtLastPayslip?.days ?? ""),
    seniorityRefDate: profile?.displayedSeniorityAtLastPayslip?.referenceDate ?? "",
  })
  const [conditions, setConditions] = useState<OccupationalCondition[]>(
    profile?.occupationalConditions ?? []
  )
  const [saved, setSaved] = useState(false)
  const prefillRef = useRef(false)

  useEffect(() => {
    if (profile || prefillRef.current) return
    prefillRef.current = true

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from("profiles")
        .select("categoria")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!data?.categoria) return
          const cat = data.categoria.replace(/\s+/g, " ").trim()
          setForm((prev) => ({ ...prev, categoryName: cat }))
          const hours = deriveWorkdayHoursFromCategoryName(cat)
          if (hours) {
            setForm((prev) => ({ ...prev, workdayHours: String(hours) }))
          }
        })
    })
  }, [profile])

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCondition(type: OccupationalCondition["type"]) {
    setConditions((prev) => {
      const exists = prev.find((c) => c.type === type)
      if (exists) return prev.filter((c) => c.type !== type)
      return [...prev, { type, enabled: true, permanentExposure: type === "radiation_non_medical" }]
    })
  }

  function setPermanentExposure(value: boolean) {
    setConditions((prev) =>
      prev.map((c) => c.type === "radiation_non_medical" ? { ...c, permanentExposure: value } : c)
    )
  }

  function buildProfile(): EmployeePayrollProfile {
    const sy = parseInt(form.seniorityYears) || 0
    const sm = parseInt(form.seniorityMonths) || 0
    const sd = parseInt(form.seniorityDays) || 0
    return {
      id: profile?.id ?? crypto.randomUUID?.() ?? `${Date.now()}`,
      userId: profile?.userId ?? "",
      consentGiven: profile?.consentGiven ?? false,
      consentDate: profile?.consentDate ?? new Date().toISOString(),
      categoryId: form.categoryId || undefined,
      categoryName: form.categoryName || undefined,
      employmentType: form.employmentType,
      workdayHours: parseFloat(form.workdayHours) as JornadaHoras,
      shift: form.shift,
      ooad: form.ooad || undefined,
      region: form.region || undefined,
      unitCode: form.unitCode || undefined,
      serviceCode: form.serviceCode || undefined,
      positionCode: form.positionCode || undefined,
      occupationalConditions: conditions,
      facts: profile?.facts ?? [],
      siapConceptMarks: profile?.siapConceptMarks ?? [],
      recurringConcepts: profile?.recurringConcepts ?? [],
      displayedSeniorityAtLastPayslip: (sy || sm || sd) && form.seniorityRefDate
        ? { years: sy, months: sm, days: sd, referenceDate: form.seniorityRefDate }
        : undefined,
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
    { value: "6", label: "6 horas" },
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
          Tus datos laborales están listos.
        </p>
      </Card>
    )
  }

  return (
    <Card padding="1.5rem">
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{
          display: "flex", gap: "0.375rem", alignItems: "center", marginBottom: "0.75rem",
        }}>
          {[1, 2, 3, 4].map((s) => (
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
          Paso {step} de 4
        </p>
      </div>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Categoría y contratación</h3>
          <Input
            label="Categoría (nombre o código)"
            value={form.categoryName}
            onChange={(e) => handleChange("categoryName", e.target.value)}
            placeholder="Ej: TÉCNICO RADIÓLOGO 80"
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
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Unidad y adscripción</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Opcional. Ayuda a determinar conceptos específicos.
          </p>
          <Input
            label="OOAD (Órgano de Operación Administrativa)"
            value={form.ooad}
            onChange={(e) => handleChange("ooad", e.target.value)}
            placeholder="Ej: CDMX Norte"
          />
          <Input
            label="Región"
            value={form.region}
            onChange={(e) => handleChange("region", e.target.value)}
            placeholder="Ej: Ciudad de México"
          />
          <Input
            label="Código de unidad"
            value={form.unitCode}
            onChange={(e) => handleChange("unitCode", e.target.value)}
          />
          <Input
            label="Código de servicio"
            value={form.serviceCode}
            onChange={(e) => handleChange("serviceCode", e.target.value)}
          />
          <Input
            label="Código de puesto"
            value={form.positionCode}
            onChange={(e) => handleChange("positionCode", e.target.value)}
          />
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Antigüedad reflejada en tu último tarjetón</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Captura los años, meses y días que aparecen en tu último
            recibo de nómina. A partir de eso, el simulador calculará automáticamente
            tu antigüedad actual.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <Input
              label="Años"
              type="number"
              min="0"
              value={form.seniorityYears}
              onChange={(e) => handleChange("seniorityYears", e.target.value)}
              placeholder="0"
            />
            <Input
              label="Meses"
              type="number"
              min="0"
              max="11"
              value={form.seniorityMonths}
              onChange={(e) => handleChange("seniorityMonths", e.target.value)}
              placeholder="0"
            />
            <Input
              label="Días"
              type="number"
              min="0"
              max="30"
              value={form.seniorityDays}
              onChange={(e) => handleChange("seniorityDays", e.target.value)}
              placeholder="0"
            />
          </div>
          <Input
            label="Fecha del tarjetón (periodo que muestra esa antigüedad)"
            type="date"
            value={form.seniorityRefDate}
            onChange={(e) => handleChange("seniorityRefDate", e.target.value)}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
            Ejemplo: si tu tarjetón de la primera quincena de enero 2025 mostraba
            10 años 3 meses 15 días, captura eso y la fecha 2025-01-15.
          </p>
        </div>
      )}

      {step === 4 && (
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
              <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>Emanaciones Radiactivas no Médicas</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Exposición constante y permanente</div>
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
              Exposición constante y permanente
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
              <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>Enfermería</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Personal de enfermería</div>
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
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Siguiente</Button>
        ) : (
          <Button onClick={handleSave}>Guardar perfil</Button>
        )}
      </div>
    </Card>
  )
}
