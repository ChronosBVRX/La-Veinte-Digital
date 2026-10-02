"use client"

import { useState, useMemo, type CSSProperties } from "react"
import Link from "next/link"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { useLiveWorkerContext } from "@/shared/hooks/useLiveWorkerContext"
import { createClient } from "@/lib/supabase/client"
import { insertCommitment } from "@/features/agenda-laboral/services/commitments-supabase"
import {
  calculateVacationReturn,
  type VacationPeriodSelection,
  type DayClassification,
} from "@/features/vacations/domain/return-calculator"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

interface Props {
  initialContext?: WorkerContext | null
}

const CONTAINER: CSSProperties = {
  maxWidth: "860px",
  margin: "0 auto",
  padding: "1rem",
  boxSizing: "border-box",
  width: "100%",
}

const HEADER_TITLE: CSSProperties = {
  fontSize: "clamp(1.4rem, 5vw, 1.85rem)",
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.25,
  color: "var(--fg)",
}

const SUBTITLE: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.875rem",
  margin: "0.35rem 0 1.5rem",
  lineHeight: 1.5,
}

const SECTION_TITLE: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--fg)",
  marginBottom: "0.75rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
}

const FORM_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
  gap: "1rem",
  marginBottom: "1rem",
}

const FIELD_LABEL: CSSProperties = {
  display: "block",
  fontSize: "0.825rem",
  fontWeight: 600,
  color: "var(--fg)",
  marginBottom: "0.35rem",
}

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
  fontSize: "0.9rem",
  boxSizing: "border-box",
}

const PILL_BUTTON = (active: boolean): CSSProperties => ({
  padding: "0.45rem 0.75rem",
  borderRadius: "9999px",
  border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
  background: active ? "var(--primary)" : "var(--card)",
  color: active ? "var(--primary-fg)" : "var(--fg)",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
})

const CHIP_STYLE = (classification: DayClassification): CSSProperties => {
  switch (classification) {
    case "VACATION_DAY":
      return {
        background: "rgba(34, 197, 94, 0.12)",
        border: "1px solid rgba(34, 197, 94, 0.35)",
        color: "#166534",
      }
    case "WEEKLY_REST":
      return {
        background: "rgba(100, 116, 139, 0.1)",
        border: "1px solid rgba(100, 116, 139, 0.25)",
        color: "#334155",
      }
    case "MANDATORY_REST":
      return {
        background: "rgba(245, 158, 11, 0.15)",
        border: "1px solid rgba(245, 158, 11, 0.4)",
        color: "#92400e",
      }
    case "RETURN_TO_WORK":
      return {
        background: "var(--primary)",
        border: "1.5px solid var(--primary)",
        color: "var(--primary-fg)",
        fontWeight: 700,
      }
    default:
      return {
        background: "var(--accent)",
        border: "1px solid var(--border)",
        color: "var(--fg)",
      }
  }
}

export function VacationReturnCalculator({ initialContext }: Props) {
  const liveContext = useLiveWorkerContext(initialContext)

  // 1. Detección inicial de datos del tarjetón o valores predeterminados
  const defaultSeniority = useMemo(() => {
    const years = liveContext?.employment?.effectiveSeniorityDate
      ? Math.max(1, Math.min(40, Number(liveContext.employment.effectiveSeniorityDate.slice(0, 4)) || 5))
      : liveContext?.vacations?.daysInYear
        ? Math.max(1, liveContext.vacations.daysInYear - 15)
        : 5
    return years
  }, [liveContext])

  const [startDate, setStartDate] = useState<string>(() => {
    // Por defecto, proponer el próximo lunes o dentro de 7 días
    const d = new Date()
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  })

  const [seniorityYears, setSeniorityYears] = useState<number>(defaultSeniority)
  const [periodSelection, setPeriodSelection] = useState<VacationPeriodSelection>("FIRST_PERIOD")
  const [customDays, setCustomDays] = useState<number>(10)
  const [daysOnAccount, setDaysOnAccount] = useState<number>(0)
  const [weeklyRestPreset, setWeeklyRestPreset] = useState<"SAT_SUN" | "SUN_MON" | "FRI_SAT" | "CUSTOM">("SAT_SUN")
  const [weeklyRestDays, setWeeklyRestDays] = useState<number[]>([5, 6]) // Sáb (5) y Dom (6)

  // Estados de acciones
  const [copied, setCopied] = useState<boolean>(false)
  const [savingAgenda, setSavingAgenda] = useState<boolean>(false)
  const [agendaSavedSuccess, setAgendaSavedSuccess] = useState<boolean>(false)
  const [agendaError, setAgendaError] = useState<string | null>(null)

  // Manejo de cambios en el preset de descansos semanales
  const handleRestPresetChange = (preset: "SAT_SUN" | "SUN_MON" | "FRI_SAT" | "CUSTOM") => {
    setWeeklyRestPreset(preset)
    if (preset === "SAT_SUN") setWeeklyRestDays([5, 6])
    else if (preset === "SUN_MON") setWeeklyRestDays([6, 0])
    else if (preset === "FRI_SAT") setWeeklyRestDays([4, 5])
  }

  const toggleRestDay = (dayIndex: number) => {
    setWeeklyRestPreset("CUSTOM")
    setWeeklyRestDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex)
      } else {
        return [...prev, dayIndex].sort((a, b) => a - b)
      }
    })
  }

  // Ejecución del cálculo en tiempo real
  const result = useMemo(() => {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
    return calculateVacationReturn({
      startDate,
      seniorityYears,
      periodSelection,
      customEntitlementDays: customDays,
      daysOnAccount,
      weeklyRestDays,
    })
  }, [startDate, seniorityYears, periodSelection, customDays, daysOnAccount, weeklyRestDays])

  const handleCopyText = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.copyableText)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback manual si clipboard API no está disponible
    }
  }

  const handleSaveToAgenda = async () => {
    if (!result || !result.startDate || !result.lastVacationDate) return
    setSavingAgenda(true)
    setAgendaError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAgendaError("Inicia sesión para registrar tus vacaciones en la agenda.")
        setSavingAgenda(false)
        return
      }

      const title = `Vacaciones IMSS (${result.netVacationDays} días hábiles) — Reanudación: ${result.returnDayName} ${result.formattedReturnDate}`
      const startAt = `${result.startDate}T00:00:00.000Z`
      const endAt = `${result.lastVacationDate}T23:59:59.000Z`

      const inserted = await insertCommitment({
        user_id: user.id,
        type: "vacaciones",
        title,
        start_at: startAt,
        end_at: endAt,
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: false,
        reminder_at_start: true,
        details: {
          allDay: true,
          vacationUnits: result.netVacationDays,
          daysOnAccount: result.daysOnAccount,
          returnToWorkDate: result.returnToWorkDate,
          returnDayName: result.returnDayName,
          totalCalendarDays: result.totalCalendarDays,
        },
      })

      if (inserted) {
        setAgendaSavedSuccess(true)
      } else {
        setAgendaError("No fue posible guardar el registro en la agenda.")
      }
    } catch (e) {
      setAgendaError(e instanceof Error ? e.message : "Error al registrar en la agenda")
    } finally {
      setSavingAgenda(false)
    }
  }

  const daysOfWeekLabels = [
    { idx: 0, label: "Lun" },
    { idx: 1, label: "Mar" },
    { idx: 2, label: "Mié" },
    { idx: 3, label: "Jue" },
    { idx: 4, label: "Vie" },
    { idx: 5, label: "Sáb" },
    { idx: 6, label: "Dom" },
  ]

  return (
    <div style={CONTAINER}>
      {/* Encabezado */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span
            style={{
              padding: "0.2rem 0.55rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "rgba(37,99,235,0.1)",
              color: "var(--primary)",
            }}
          >
            Cláusula 47 y 46 CCT
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>• Reanudación de Labores</span>
        </div>
        <h1 style={HEADER_TITLE}>Calculadora de Fecha de Regreso de Vacaciones</h1>
        <p style={SUBTITLE}>
          Evita errores y deducciones: calcula el día exacto en que te presentas a laborar considerando tu antigüedad, descansos semanales, festivos de ley y días a cuenta de vacaciones.
        </p>
      </div>

      {/* Tarjeta de Entrada de Datos */}
      <Card padding="1.25rem" style={{ marginBottom: "1.5rem" }}>
        <div style={SECTION_TITLE}>
          ⚙️ 1. Datos para tu programación
        </div>

        <div style={FORM_GRID}>
          {/* Fecha de Inicio */}
          <div>
            <label style={FIELD_LABEL}>Fecha de inicio de vacaciones:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={INPUT_STYLE}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem", display: "block" }}>
              Primer día hábil en que dejas de laborar
            </span>
          </div>

          {/* Antigüedad Efectiva */}
          <div>
            <label style={FIELD_LABEL}>
              Antigüedad cumplida en el IMSS: ({seniorityYears} {seniorityYears === 1 ? "año" : "años"})
            </label>
            <select
              value={seniorityYears}
              onChange={(e) => setSeniorityYears(Number(e.target.value))}
              style={INPUT_STYLE}
            >
              <option value={1}>1 año cumplido (16 días anuales)</option>
              <option value={2}>2 años cumplidos (17 días anuales)</option>
              <option value={3}>3 años cumplidos (18 días anuales)</option>
              <option value={4}>4 años cumplidos (19 días anuales)</option>
              <option value={5}>5 o más años cumplidos (20 días anuales)</option>
            </select>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem", display: "block" }}>
              Rige tu derecho vacacional conforme a la Cláusula 47
            </span>
          </div>
        </div>

        {/* Selección de Periodo */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={FIELD_LABEL}>¿Qué periodo vas a solicitar?</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
            <button
              type="button"
              onClick={() => setPeriodSelection("FIRST_PERIOD")}
              style={PILL_BUTTON(periodSelection === "FIRST_PERIOD")}
            >
              Primer Periodo ({Math.floor(result?.baseAnnualDays ? result.baseAnnualDays / 2 : 10)} días)
            </button>
            <button
              type="button"
              onClick={() => setPeriodSelection("SECOND_PERIOD")}
              style={PILL_BUTTON(periodSelection === "SECOND_PERIOD")}
            >
              Segundo Periodo ({Math.ceil(result?.baseAnnualDays ? result.baseAnnualDays / 2 : 10)} días)
            </button>
            <button
              type="button"
              onClick={() => setPeriodSelection("FULL_CYCLE")}
              style={PILL_BUTTON(periodSelection === "FULL_CYCLE")}
            >
              Periodo Continuo / Marca 0 ({result?.baseAnnualDays ?? 20} días)
            </button>
            <button
              type="button"
              onClick={() => setPeriodSelection("CUSTOM")}
              style={PILL_BUTTON(periodSelection === "CUSTOM")}
            >
              Personalizado
            </button>
          </div>

          {periodSelection === "CUSTOM" && (
            <div style={{ marginTop: "0.75rem", maxWidth: "240px" }}>
              <label style={FIELD_LABEL}>Días hábiles del periodo:</label>
              <input
                type="number"
                min={1}
                max={40}
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                style={INPUT_STYLE}
              />
            </div>
          )}
        </div>

        {/* Días a cuenta de vacaciones */}
        <div style={{ marginBottom: "1.25rem", background: "rgba(0,0,0,0.02)", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <label style={{ ...FIELD_LABEL, margin: 0 }}>
              ¿Tienes días a cuenta de vacaciones tomados previamente?
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="number"
                min={0}
                max={30}
                value={daysOnAccount}
                onChange={(e) => setDaysOnAccount(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...INPUT_STYLE, width: "80px", textAlign: "center" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>días</span>
            </div>
          </div>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
            Si solicitaste permisos con antelación o días a cuenta de este periodo, se restan de tus días a disfrutar ({result?.grossPeriodDays ?? 10} - {daysOnAccount} = <strong>{result?.netVacationDays ?? 10} días hábiles efectivos</strong>).
          </p>
        </div>

        {/* Descansos Semanales */}
        <div>
          <label style={FIELD_LABEL}>Tus días de descanso semanal:</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => handleRestPresetChange("SAT_SUN")}
              style={PILL_BUTTON(weeklyRestPreset === "SAT_SUN")}
            >
              Sábado y Domingo (Estándar)
            </button>
            <button
              type="button"
              onClick={() => handleRestPresetChange("SUN_MON")}
              style={PILL_BUTTON(weeklyRestPreset === "SUN_MON")}
            >
              Domingo y Lunes
            </button>
            <button
              type="button"
              onClick={() => handleRestPresetChange("FRI_SAT")}
              style={PILL_BUTTON(weeklyRestPreset === "FRI_SAT")}
            >
              Viernes y Sábado
            </button>
            <button
              type="button"
              onClick={() => handleRestPresetChange("CUSTOM")}
              style={PILL_BUTTON(weeklyRestPreset === "CUSTOM")}
            >
              Otro rol de descanso
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {daysOfWeekLabels.map((d) => {
              const isSelected = weeklyRestDays.includes(d.idx)
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() => toggleRestDay(d.idx)}
                  style={{
                    padding: "0.35rem 0.65rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1.5px solid ${isSelected ? "#3b82f6" : "var(--border)"}`,
                    background: isSelected ? "rgba(59, 130, 246, 0.12)" : "var(--card)",
                    color: isSelected ? "#1d4ed8" : "var(--muted)",
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {d.label} {isSelected ? "✓" : ""}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem", display: "block" }}>
            Los días seleccionados no consumen días de vacaciones y alargan tu descanso.
          </span>
        </div>
      </Card>

      {/* RESULTADO HERO: FECHA DE REGRESO */}
      {result && (
        <Card
          padding="1.5rem"
          style={{
            marginBottom: "1.5rem",
            background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(34,197,94,0.08) 100%)",
            border: "2px solid #22c55e",
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
            🏢 Fecha Oficial de Reanudación de Labores
          </div>
          <div style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", fontWeight: 800, color: "#166534", margin: "0.25rem 0 0.5rem" }}>
            {result.returnDayName} {result.formattedReturnDate}
          </div>
          <div style={{ fontSize: "0.95rem", color: "var(--fg)", lineHeight: 1.5, fontWeight: 500 }}>
            Ese día te presentas a trabajar al inicio de tu turno habitual.
          </div>

          {/* Métricas clave */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
              gap: "0.75rem",
              marginTop: "1.25rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Último día de vacaciones:</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                {result.lastVacationDayName} {result.formattedLastVacationDate}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Días hábiles disfrutados:</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                {result.netVacationDays} días hábiles
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Descanso continuo total:</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--primary)" }}>
                {result.totalCalendarDays} días naturales
              </div>
            </div>
          </div>

          {/* Días a cuenta descontados si aplican */}
          {result.daysOnAccount > 0 && (
            <div style={{ marginTop: "0.75rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#92400e" }}>
              ℹ️ Se descontaron <strong>{result.daysOnAccount} días</strong> por concepto de permisos / días a cuenta de vacaciones previamente ejercidos.
            </div>
          )}

          {/* Festivos oficiales detectados en el periodo */}
          {result.mandatoryHolidaysInPeriod.length > 0 && (
            <div style={{ marginTop: "0.75rem", background: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(37, 99, 235, 0.25)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#1e40af" }}>
              🎉 <strong>Descansos obligatorios que alargaron tus vacaciones:</strong>{" "}
              {result.mandatoryHolidaysInPeriod.map((h) => `${h.title} (${h.date})`).join(", ")}.
            </div>
          )}
        </Card>
      )}

      {/* LÍNEA DE TIEMPO / DESGLOSE DÍA POR DÍA */}
      {result && result.timeline.length > 0 && (
        <Card padding="1.25rem" style={{ marginBottom: "1.5rem" }}>
          <div style={SECTION_TITLE}>
            📅 2. Desglose día por día de tu periodo
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 1rem" }}>
            Revisa cómo se clasifica cada día del calendario durante tu ausencia:
          </p>

          {/* Leyenda */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem", fontSize: "0.75rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "rgba(34, 197, 94, 0.6)" }} />
              Vacaciones (Hábiles)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "rgba(100, 116, 139, 0.6)" }} />
              Descanso Semanal
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "rgba(245, 158, 11, 0.8)" }} />
              Festivo CCT Cl. 46
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--primary)" }} />
              Día de Regreso
            </span>
          </div>

          {/* Rejilla de días */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
              gap: "0.5rem",
              width: "100%",
            }}
          >
            {result.timeline.map((item) => (
              <div
                key={item.date}
                style={{
                  ...CHIP_STYLE(item.classification),
                  borderRadius: "var(--radius-sm)",
                  padding: "0.5rem",
                  fontSize: "0.78rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "55px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                    {item.dayOfWeekName} {item.dayNumber}
                  </div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                    {item.date}
                  </div>
                </div>
                <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {item.classification === "VACATION_DAY" && "🌴 Vacaciones"}
                  {item.classification === "WEEKLY_REST" && "💤 Descanso"}
                  {item.classification === "MANDATORY_REST" && `⭐ ${item.holidayTitle || "Festivo"}`}
                  {item.classification === "RETURN_TO_WORK" && "🏢 ¡Regresas!"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ACCIONES: COPIAR Y GUARDAR EN AGENDA */}
      {result && (
        <Card padding="1.25rem" style={{ marginBottom: "1.5rem" }}>
          <div style={SECTION_TITLE}>
            📋 3. Acciones con tu cálculo
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Button
              variant="primary"
              onClick={handleCopyText}
              disabled={copied}
            >
              {copied ? "✓ ¡Copiado al portapapeles!" : "📋 Copiar datos para formato de solicitud"}
            </Button>

            <Button
              variant="secondary"
              onClick={handleSaveToAgenda}
              loading={savingAgenda}
              disabled={agendaSavedSuccess}
            >
              {agendaSavedSuccess ? "✓ Guardado en tu Agenda Laboral" : "🗓️ Guardar en mi Agenda Laboral"}
            </Button>
          </div>

          {agendaSavedSuccess && (
            <div style={{ background: "#dcfce7", border: "1px solid #22c55e", color: "#166534", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              ✓ Se creó el recordatorio en tu Agenda Laboral para avisarte el día anterior al inicio y recordarte la fecha exacta de regreso.
            </div>
          )}

          {agendaError && (
            <div style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              ⚠️ {agendaError}
            </div>
          )}

          {/* Texto de Copia Previsualizado */}
          <div style={{ background: "var(--accent)", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginBottom: "0.35rem" }}>
              Texto preparado para tu formato o jefatura de personal:
            </div>
            <pre style={{ margin: 0, fontSize: "0.78rem", color: "var(--fg)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5 }}>
              {result.copyableText}
            </pre>
          </div>
        </Card>
      )}

      {/* Enlace al Programador Anual de Vacaciones */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link
          href="/vacaciones"
          style={{
            fontSize: "0.85rem",
            color: "var(--primary)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Ir al Asesor y Programador Anual de Vacaciones 2027
        </Link>
      </div>
    </div>
  )
}
