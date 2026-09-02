"use client"

import { useState, useCallback, type CSSProperties } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { calculateCompletedYears, determineVacationRegime } from "../domain/entitlement"
import { isCycleClosed } from "../domain/continuity"
import { validateAnticipation } from "../domain/validation"
import { institutionalToday } from "@/shared/lib/dates"
import { buildSimulationResult } from "../domain/simulation"
import type {
  WorkerProfile, VacationSimulationInput, VacationSimulationResult,
  ContractType, VacationRegime, WorkScheduleType,
} from "../domain/types"

type Step =
  | "welcome"
  | "profile-confirm"
  | "tarjeton-data"
  | "work-schedule"
  | "radiation"
  | "regime-info"
  | "continuity"
  | "inclusion-options"
  | "calendar"
  | "result"
  | "save"

interface WizardState {
  step: Step
  profile: WorkerProfile
  continuityMark: number
  nextPeriodNumber: number
  dueDate: string
  expiredVacationPeriods: number
  enjoyedVacationDays: number
  totalYearVacationDays: number
  periodToEnjoy: number
  selectedInclusionMark: number
  selectedStartDate: string
  regime: VacationRegime
  result: VacationSimulationResult | null
  loading: boolean
  error: string
  calendarMonth: number
}

const CONTRACT_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "BASE", label: "Base" },
  { value: "CONFIANZA_B", label: "Confianza B" },
  { value: "CONFIANZA", label: "Confianza" },
  { value: "CONFIANZA_A_ESTATUTO", label: "Confianza A (Estatuto)" },
  { value: "TEMPORAL", label: "Temporal" },
  { value: "SUSTITUTO", label: "Sustituto" },
  { value: "MEDICO_RESIDENTE", label: "Médico Residente" },
  { value: "BECADO", label: "Becado" },
  { value: "OTRO", label: "Otro" },
]

const SCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: "ORDINARY", label: "Trabajo entre semana" },
  { value: "ACCUMULATED_WEEKEND_DAY", label: "Trabajo principalmente sábado y domingo" },
  { value: "ACCUMULATED_NIGHT", label: "Trabajo tres noches alternadas" },
  { value: "ROTATING", label: "Mis días cambian" },
  { value: "CUSTOM", label: "Otro horario" },
]

const CONTAINER: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "1rem",
}

const HEADER: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "var(--fg)",
  marginBottom: "0.5rem",
}

const SUBTITLE: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.875rem",
  marginBottom: "1.5rem",
}

const FIELD_GROUP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginBottom: "1.5rem",
}

const BUTTON_ROW: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  justifyContent: "space-between",
  marginTop: "1.5rem",
}

const DISCLAIMER: CSSProperties = {
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.75rem 1rem",
  fontSize: "0.8rem",
  color: "var(--muted)",
  marginTop: "1.5rem",
  textAlign: "center",
}

const WARN_BOX: CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: "var(--radius)",
  padding: "0.75rem 1rem",
  fontSize: "0.85rem",
  color: "#92400e",
  marginBottom: "1rem",
}

const REVIEW_BOX: CSSProperties = {
  background: "#fee2e2",
  border: "1px solid #ef4444",
  borderRadius: "var(--radius)",
  padding: "0.75rem 1rem",
  fontSize: "0.85rem",
  color: "#991b1b",
  marginBottom: "1rem",
}

const STEP_INDICATOR: CSSProperties = {
  display: "flex",
  gap: "0.375rem",
  marginBottom: "1.5rem",
  justifyContent: "center",
}

const DOT: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "var(--border)",
  transition: "background 0.3s ease",
}

const DOT_ACTIVE: CSSProperties = { ...DOT, background: "var(--primary)" }
const DOT_DONE: CSSProperties = { ...DOT, background: "var(--success, #22c55e)" }

export function VacationWizard() {
  const [state, setState] = useState<WizardState>({
    step: "welcome",
    profile: {
      contractType: "BASE",
      effectiveSeniority: { years: 0, fortnights: 0, days: 0, precision: "APPROXIMATE" },
      weeklyRestDays: [5, 6],
      radiologicalExposure: false,
    },
    continuityMark: 0,
    nextPeriodNumber: 1,
    dueDate: "",
    expiredVacationPeriods: 0,
    enjoyedVacationDays: 0,
    totalYearVacationDays: 0,
    periodToEnjoy: 1,
    selectedInclusionMark: 0,
    selectedStartDate: "",
    regime: "SEMESTRAL",
    result: null,
    loading: false,
    error: "",
    calendarMonth: institutionalToday().getMonth(),
  })

  const updateState = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const goTo = useCallback((step: Step) => {
    updateState({ step, error: "" })
  }, [updateState])

  const setProfile = useCallback((partial: Partial<WorkerProfile>) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...partial } }))
  }, [])

  function determineRegime(): VacationRegime {
    const years = calculateCompletedYears(state.profile.effectiveSeniority)
    return determineVacationRegime(
      state.profile.contractType,
      years,
      state.profile.radiologicalExposure ?? false,
      false
    )
  }

  function handleRunSimulation() {
    setState((prev) => {
      try {
        const regime = prev.regime || determineRegime()
        const input: VacationSimulationInput = {
          workerProfile: prev.profile,
          regime,
          continuityMark: prev.continuityMark,
          nextPeriodNumber: prev.nextPeriodNumber,
          dueDate: prev.dueDate,
          expiredVacationPeriods: prev.expiredVacationPeriods,
          enjoyedVacationDays: prev.enjoyedVacationDays,
          totalYearVacationDays: prev.totalYearVacationDays,
          periodToEnjoy: prev.periodToEnjoy,
          calendarId: `manual-${institutionalToday().getFullYear()}`,
          selectedInclusionMark: prev.selectedInclusionMark,
          selectedStartDate: prev.selectedStartDate,
        }
        const result = buildSimulationResult(input)
        return { ...prev, result, loading: false, error: "" }
      } catch (e) {
        return { ...prev, error: e instanceof Error ? e.message : "Error desconocido", loading: false }
      }
    })
  }

  function renderStepIndicator(currentStep: Step) {
    const steps = ["welcome", "profile-confirm", "tarjeton-data", "work-schedule", "radiation", "continuity", "inclusion-options", "calendar", "result"]
    const currentIdx = steps.indexOf(currentStep)
    return (
      <div style={STEP_INDICATOR} aria-hidden>
        {steps.map((s, i) => (
          <div key={s} style={i === currentIdx ? DOT_ACTIVE : i < currentIdx ? DOT_DONE : DOT} />
        ))}
      </div>
    )
  }

  function renderWelcome() {
    return (
      <>
        {renderStepIndicator("welcome")}
        <h1 style={HEADER}>Simulador de Programación de Vacaciones</h1>
        <p style={SUBTITLE}>
          Este asistente te guiará paso a paso para conocer tus opciones de vacaciones
          y simular la mejor fecha para ti. No necesitas conocer términos técnicos:
          el sistema interpreta la normativa por ti.
        </p>
        <Card style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--fg)", lineHeight: 1.6 }}>
              El simulador utiliza tu perfil y la información de tu tarjetón para:
            </p>
            <ul style={{ fontSize: "0.85rem", color: "var(--muted)", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
              <li>Identificar el tipo de periodo que te corresponde</li>
              <li>Mostrar las opciones compatibles con tu situación</li>
              <li>Calcular fechas de inicio, término y reincorporación</li>
              <li>Excluir automáticamente tus descansos semanales y obligatorios</li>
              <li>Generar un resumen para guardar o compartir</li>
            </ul>
          </div>
        </Card>
        <div style={DISCLAIMER}>
          Este simulador es informativo. La programación definitiva debe ser autorizada
          y registrada por las áreas competentes del IMSS.
        </div>
        <div style={BUTTON_ROW}>
          <div />
          <Button onClick={() => goTo("profile-confirm")}>Comenzar</Button>
        </div>
      </>
    )
  }

  function renderProfileConfirm() {
    return (
      <>
        {renderStepIndicator("profile-confirm")}
        <h2 style={HEADER}>Datos de tu perfil</h2>
        <p style={SUBTITLE}>Confirmemos que tus datos son correctos. Puedes corregir cualquier dato aquí.</p>
        <Card padding="1.25rem">
          <div style={FIELD_GROUP}>
            <Input label="Nombre completo" value={state.profile.fullName || ""} onChange={(e) => setProfile({ fullName: e.target.value })} />
            <Input label="Matrícula" value={state.profile.matricula || ""} onChange={(e) => setProfile({ matricula: e.target.value })} />
            <Input label="Categoría" value={state.profile.category || ""} onChange={(e) => setProfile({ category: e.target.value })} />
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>Tipo de contratación</label>
              <select
                value={state.profile.contractType}
                onChange={(e) => setProfile({ contractType: e.target.value as ContractType })}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", fontSize: "0.875rem" }}
              >
                {CONTRACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 85px), 1fr))", gap: "0.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
              <Input label="Años de antigüedad" type="number" value={state.profile.effectiveSeniority.years} onChange={(e) => setProfile({ effectiveSeniority: { ...state.profile.effectiveSeniority, years: Number(e.target.value) } })} />
              <Input label="Quincenas" type="number" value={state.profile.effectiveSeniority.fortnights} onChange={(e) => setProfile({ effectiveSeniority: { ...state.profile.effectiveSeniority, fortnights: Number(e.target.value) } })} />
              <Input label="Días" type="number" value={state.profile.effectiveSeniority.days} onChange={(e) => setProfile({ effectiveSeniority: { ...state.profile.effectiveSeniority, days: Number(e.target.value) } })} />
            </div>
          </div>
        </Card>
        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("welcome")}>Atrás</Button>
          <Button onClick={() => goTo("tarjeton-data")}>Continuar</Button>
        </div>
      </>
    )
  }

  function renderTarjetonData() {
    return (
      <>
        {renderStepIndicator("tarjeton-data")}
        <h2 style={HEADER}>Datos de tu tarjetón</h2>
        <p style={SUBTITLE}>Estos datos los encuentras en tu tarjetón de vacaciones.</p>

        <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
          <div style={FIELD_GROUP}>
            <div style={{ background: "var(--accent)", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              En tu tarjetón busca la sección de vacaciones. Ahí aparecen los siguientes datos.
            </div>
            <Input
              label="Marca de continuidad actual"
              type="number"
              value={state.continuityMark}
              onChange={(e) => updateState({ continuityMark: Number(e.target.value) })}

            />
            <Input
              label="Número de periodo por disfrutar"
              type="number"
              value={state.nextPeriodNumber}
              onChange={(e) => updateState({ nextPeriodNumber: Number(e.target.value) })}
            />
            <Input
              label="Fecha de vencimiento (AAAA-MM-DD)"
              type="date"
              value={state.dueDate}
              onChange={(e) => updateState({ dueDate: e.target.value })}
            />
            <Input
              label="Periodos vencidos no disfrutados"
              type="number"
              value={state.expiredVacationPeriods}
              onChange={(e) => updateState({ expiredVacationPeriods: Number(e.target.value) })}
            />
          </div>
        </Card>

        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("profile-confirm")}>Atrás</Button>
          <Button onClick={() => goTo("work-schedule")} disabled={!state.dueDate}>Continuar</Button>
        </div>
      </>
    )
  }

  function renderWorkSchedule() {
    return (
      <>
        {renderStepIndicator("work-schedule")}
        <h2 style={HEADER}>¿Cómo trabajas normalmente?</h2>
        <p style={SUBTITLE}>Elige la opción que mejor describa tu horario habitual.</p>
        <Card padding="1.25rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {SCHEDULE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setProfile({
                    workScheduleType: opt.value as WorkScheduleType,
                    weeklyRestDays: opt.value === "ACCUMULATED_WEEKEND_DAY" ? [0, 1, 2, 3, 4] : state.profile.weeklyRestDays,
                  })
                  goTo("radiation")
                }}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${state.profile.workScheduleType === opt.value ? "var(--primary)" : "var(--border)"}`,
                  background: state.profile.workScheduleType === opt.value ? "var(--primary)" : "var(--card)",
                  color: state.profile.workScheduleType === opt.value ? "var(--primary-fg)" : "var(--fg)",
                  cursor: "pointer", textAlign: "left", fontSize: "0.9rem", fontWeight: 500,
                  transition: "all var(--transition)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Card>
        <div style={{ marginTop: "0.75rem" }}>
          <Button variant="ghost" onClick={() => goTo("tarjeton-data")}>Atrás</Button>
        </div>
      </>
    )
  }

  function renderRadiation() {
    return (
      <>
        {renderStepIndicator("radiation")}
        <h2 style={HEADER}>Exposición a emanaciones radiactivas</h2>
        <p style={SUBTITLE}>¿Laboras de manera constante y permanente en un área oficialmente reconocida con exposición a emanaciones radiactivas?</p>
        <Card padding="1.25rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Button onClick={() => { setProfile({ radiologicalExposure: true }); goTo("continuity") }}>Sí</Button>
            <Button variant="secondary" onClick={() => { setProfile({ radiologicalExposure: false }); goTo("continuity") }}>No</Button>
            <Button variant="ghost" onClick={() => { setProfile({ radiologicalExposure: "UNSURE" }); goTo("continuity") }}>
              No estoy seguro
            </Button>
          </div>
        </Card>
        {state.profile.radiologicalExposure === "UNSURE" && (
          <div style={WARN_BOX}>
            Puedes continuar con la simulación, pero esta condición debe confirmarse con
            Servicios de Personal para que sea válida.
          </div>
        )}
        <div style={{ marginTop: "0.75rem" }}>
          <Button variant="ghost" onClick={() => goTo("work-schedule")}>Atrás</Button>
        </div>
      </>
    )
  }

  function renderContinuity() {
    const closed = isCycleClosed("SEMESTRAL", state.continuityMark)
    return (
      <>
        {renderStepIndicator("continuity")}
        <h2 style={HEADER}>Estado de tus vacaciones</h2>
        <Card padding="1.25rem">
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1rem" }}>
            {closed
              ? "Tus periodos anteriores están completos. Puedes iniciar una nueva opción de programación."
              : state.continuityMark === 1
              ? "Tienes una primera parte pendiente de completar. Debes seleccionar la segunda parte."
              : state.continuityMark === 3
              ? "Tienes un periodo completo pendiente. Debes completarlo antes de iniciar otro."
              : state.continuityMark === 4
              ? "Debes completar tu segunda parte antes de iniciar un nuevo ciclo."
              : "Tu ciclo actual requiere completarse antes de iniciar nuevas opciones."
            }
          </p>
          <div style={DISCLAIMER}>
            Marca de continuidad detectada: {state.continuityMark}
          </div>
        </Card>
        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("radiation")}>Atrás</Button>
          <Button onClick={() => goTo("inclusion-options")}>Ver opciones disponibles</Button>
        </div>
      </>
    )
  }

  function renderInclusionOptions() {
    const closed = isCycleClosed("SEMESTRAL", state.continuityMark)
    const options: { mark: number; label: string; desc: string }[] = []

    if (closed) {
      options.push({ mark: 0, label: "Disfrutar el periodo de manera continua", desc: "Tomas todos tus días de vacaciones de una sola vez." })
      options.push({ mark: 1, label: "Dividirlo en dos partes semejantes", desc: "Primera parte de tus vacaciones. Después podrás programar la segunda." })
      options.push({ mark: 4, label: "Revisar una modalidad especial", desc: "Relacionada con el pago de prestaciones (primera parte)." })
    } else if (state.continuityMark === 1) {
      options.push({ mark: 1, label: "Completar la segunda parte", desc: "Primero debes completar la segunda parte de tus vacaciones." })
    } else if (state.continuityMark === 3) {
      options.push({ mark: 3, label: "Completar el periodo completo pendiente", desc: "Debes completar el periodo que está en proceso." })
    } else if (state.continuityMark === 4) {
      options.push({ mark: 9, label: "Completar la segunda parte (modalidad especial)", desc: "Finaliza tu ciclo actual con esta opción." })
    }

    return (
      <>
        {renderStepIndicator("inclusion-options")}
        <h2 style={HEADER}>¿Cómo deseas disfrutar tus vacaciones?</h2>
        <p style={SUBTITLE}>Selecciona la opción que prefieras.</p>
        <Card padding="1.25rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {options.map((opt) => (
              <button
                key={opt.mark}
                onClick={() => {
                  updateState({ selectedInclusionMark: opt.mark })
                  goTo("calendar")
                }}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  cursor: "pointer", textAlign: "left", fontSize: "0.9rem", fontWeight: 500,
                  transition: "all var(--transition)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{opt.label}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </Card>
        <div style={{ marginTop: "1rem" }}>
          <details style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer" }}>Ver detalles técnicos</summary>
            <p style={{ marginTop: "0.5rem" }}>
              Marca de inclusión: {state.selectedInclusionMark} | Continuidad: {state.continuityMark}
            </p>
          </details>
        </div>
        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("continuity")}>Atrás</Button>
        </div>
      </>
    )
  }

  function renderCalendar() {
    const year = institutionalToday().getFullYear()
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    const selectedMonth = state.calendarMonth

    const regime = state.regime || determineRegime()
    const dueDate = new Date(state.dueDate)
    const maxAnticipation = regime === "CUATRIMESTRAL" ? 105 : 120
    const earliestDate = new Date(dueDate)
    earliestDate.setDate(dueDate.getDate() - maxAnticipation)

    function isSelectable(day: number): boolean {
      const date = new Date(year, selectedMonth, day)
      return date >= earliestDate && date <= dueDate
    }

    function handleDayClick(day: number) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      if (isSelectable(day)) {
        updateState({ selectedStartDate: dateStr })
      }
    }

    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, selectedMonth, 1).getDay()

    const yearAnticipation = state.selectedStartDate && state.dueDate
      ? validateAnticipation(
          regime,
          state.dueDate,
          state.selectedStartDate,
          state.nextPeriodNumber <= 1 && state.expiredVacationPeriods === 0 && state.enjoyedVacationDays === 0,
          calculateCompletedYears(state.profile.effectiveSeniority)
        )
      : null

    return (
      <>
        {renderStepIndicator("calendar")}
        <h2 style={HEADER}>Elige tu fecha de inicio</h2>
        <p style={SUBTITLE}>
          Fecha más temprana disponible: {earliestDate.toLocaleDateString("es-MX")}
          {" | "}Vencimiento: {dueDate.toLocaleDateString("es-MX")}
        </p>

        <Card padding="1.25rem">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <Button variant="ghost" size="sm" onClick={() => updateState({ calendarMonth: state.calendarMonth === 0 ? 11 : state.calendarMonth - 1 })}>
              ←
            </Button>
            <span style={{ fontWeight: 600 }}>{months[selectedMonth]} {year}</span>
            <Button variant="ghost" size="sm" onClick={() => updateState({ calendarMonth: state.calendarMonth === 11 ? 0 : state.calendarMonth + 1 })}>
              →
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
              <div key={d} style={{ fontSize: "0.75rem", color: "var(--muted)", padding: "0.25rem" }}>{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const selectable = isSelectable(day)
              const isSelected = state.selectedStartDate === `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              return (
                <button
                  key={day}
                  disabled={!selectable}
                  onClick={() => handleDayClick(day)}
                  aria-label={`${day} de ${months[selectedMonth]} de ${year}`}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: isSelected ? "var(--primary)" : selectable ? "var(--card)" : "var(--accent)",
                    color: isSelected ? "var(--primary-fg)" : selectable ? "var(--fg)" : "var(--muted)",
                    cursor: selectable ? "pointer" : "not-allowed",
                    fontWeight: isSelected ? 700 : 400,
                    fontSize: "0.85rem",
                    opacity: selectable ? 1 : 0.4,
                    minWidth: 36,
                    minHeight: 36,
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {yearAnticipation && state.selectedStartDate && (
            <div style={{
              marginTop: "1rem", padding: "0.75rem",
              background: yearAnticipation.allowed ? "#f0fdf4" : "#fef3c7",
              borderRadius: "var(--radius)",
              fontSize: "0.85rem",
              color: yearAnticipation.allowed ? "#166534" : "#92400e",
            }}>
              {yearAnticipation.friendlyMessage}
            </div>
          )}
        </Card>

        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("inclusion-options")}>Atrás</Button>
          <Button onClick={() => {
            handleRunSimulation()
            setTimeout(() => goTo("result"), 50)
          }} disabled={!state.selectedStartDate}>
            Ver resultado
          </Button>
        </div>
      </>
    )
  }

  function renderResult() {
    const r = state.result
    if (!r) return null

    return (
      <>
        {renderStepIndicator("result")}
        <h2 style={HEADER}>Tu propuesta de vacaciones</h2>
        <p style={SUBTITLE}>Revisa los detalles de tu simulación.</p>

        {r.requiresNormativeReview && (
          <div style={REVIEW_BOX}>
            Esta combinación requiere validación con Servicios de Personal debido a una diferencia entre las fuentes normativas.
          </div>
        )}

        {r.requiresSpecialProcess && (
          <div style={WARN_BOX}>
            Esta propuesta no puede programarse directamente: requiere un proceso especial o la autorización de las áreas competentes antes de registrar las fechas.
          </div>
        )}

        {r.warnings.map((w, i) => (
          <div key={i} style={WARN_BOX}>{w}</div>
        ))}

        <Card padding="1.25rem" style={{ marginBottom: "1rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "0.75rem", fontSize: "0.9rem", width: "100%", minWidth: 0 }}>
            <ResultItem label="Régimen" value={getRegimeLabel(r.regime)} />
            <ResultItem label="Periodo" value={`#${r.periodNumber}`} />
            <ResultItem label="Inicio" value={r.startDate || "—"} />
            <ResultItem label="Término" value={r.endDate || "—"} />
            <ResultItem label="Reincorporación" value={r.returnDate || "—"} />
            <ResultItem label="Unidades" value={r.unitsUsed !== undefined ? `${r.unitsUsed} ${getUnitLabel(r.unitType)}` : "—"} />
            <ResultItem label="Vencimiento" value={r.dueDate} />
            <ResultItem label="Anticipación" value={`${r.anticipationDays} días`} />
          </div>
        </Card>

        <details style={{ marginBottom: "1rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "var(--muted)" }}>
            Ver detalles técnicos y fundamento
          </summary>
          <Card padding="1.25rem" style={{ marginTop: "0.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "0.5rem", fontSize: "0.8rem", width: "100%", minWidth: 0 }}>
              <ResultItem label="Continuidad original" value={String(r.originalContinuityMark)} />
              <ResultItem label="Inclusión propuesta" value={String(r.proposedInclusionMark)} />
              <ResultItem label="Continuidad resultante" value={r.resultingContinuityMark !== undefined ? String(r.resultingContinuityMark) : "—"} />
              <ResultItem label="UPO afectado" value={r.affectedUPO !== undefined ? String(r.affectedUPO) : "—"} />
              <ResultItem label="Versión calendario" value={r.calendarVersion} />
            </div>
            {r.traces.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Reglas aplicadas:</p>
                {r.traces.map((t, i) => (
                  <div key={i} style={{
                    padding: "0.375rem 0.5rem",
                    background: t.result === "APPLIED" ? "#f0fdf4" : t.result === "BLOCKED" ? "#fef2f2" : t.result === "WARNING" ? "#fef3c7" : "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    marginBottom: "0.25rem",
                    color: t.result === "APPLIED" ? "#166534" : t.result === "BLOCKED" ? "#991b1b" : "#92400e",
                  }}>
                    <strong>{t.ruleCode}:</strong> {t.explanation}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </details>

        <div style={DISCLAIMER}>
          Este simulador es informativo. La programación definitiva debe ser autorizada
          y registrada por las áreas competentes del IMSS.
        </div>

        <div style={BUTTON_ROW}>
          <Button variant="ghost" onClick={() => goTo("calendar")}>Atrás</Button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="secondary" onClick={() => {
              const text = generateSummaryText(r)
              navigator.clipboard.writeText(text)
            }}>
              Copiar resumen
            </Button>
            <Button onClick={() => goTo("welcome")}>Nueva simulación</Button>
          </div>
        </div>
      </>
    )
  }

  if (state.loading) {
    return (
      <div style={CONTAINER}>
        <LoadingSpinner text="Calculando tus opciones de vacaciones..." />
      </div>
    )
  }

  return (
    <div style={CONTAINER}>
      {state.error && (
        <div style={REVIEW_BOX}>
          {state.error}
        </div>
      )}

      {state.step === "welcome" && renderWelcome()}
      {state.step === "profile-confirm" && renderProfileConfirm()}
      {state.step === "tarjeton-data" && renderTarjetonData()}
      {state.step === "work-schedule" && renderWorkSchedule()}
      {state.step === "radiation" && renderRadiation()}
      {state.step === "continuity" && renderContinuity()}
      {state.step === "inclusion-options" && renderInclusionOptions()}
      {state.step === "calendar" && renderCalendar()}
      {state.step === "result" && renderResult()}
    </div>
  )
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function getRegimeLabel(r: VacationRegime): string {
  switch (r) {
    case "SEMESTRAL": return "Semestral"
    case "CUATRIMESTRAL": return "Cuatrimestral (Radiación)"
    case "EXTRAORDINARIO_V20": return "Extraordinario (20+ años)"
    case "ESTATUTO": return "Confianza A (Estatuto)"
  }
}

function getUnitLabel(unit: "WORKDAY" | "JOURNEY" | "VELADA"): string {
  switch (unit) {
    case "WORKDAY": return "días hábiles"
    case "JOURNEY": return "jornadas"
    case "VELADA": return "veladas"
  }
}

function generateSummaryText(r: VacationSimulationResult): string {
  return `PROPUESTA DE VACACIONES
Régimen: ${getRegimeLabel(r.regime)}
Periodo: #${r.periodNumber}
Inicio: ${r.startDate || "—"}
Término: ${r.endDate || "—"}
Reincorporación: ${r.returnDate || "—"}
Unidades: ${r.unitsUsed !== undefined ? `${r.unitsUsed} ${getUnitLabel(r.unitType)}` : "—"}
Vencimiento: ${r.dueDate}
Anticipación: ${r.anticipationDays} días
${r.requiresNormativeReview ? "\nRequiere validación con Servicios de Personal." : ""}
\n--- Generado por Simulador de Vacaciones IMSS ---`
}
