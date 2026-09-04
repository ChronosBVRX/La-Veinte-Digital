"use client"

import { useState, useEffect, useMemo, type CSSProperties } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { createClient } from "@/lib/supabase/client"
import { prefillVacationSimulator } from "../domain/prefill"
import { formatMexicanDate } from "@/features/tarjeton/lib/imss-date-parser"
import { formatMexicanCurrency, calculateVacationPayment } from "../domain/payment-estimate"
import {
  getMarkGuidance,
  orderMarksByPriority,
  getIncompatibleReason,
  getVacationContinuityGuidance,
  type VacationPriority,
} from "../domain/option-guidance"
import { getRequiredPeriodCount, buildVacationPlan, type PlanSelectionStep } from "../domain/annual-plan"
import { getCompatibleInclusionMarks, applyInclusionMark } from "../domain/continuity"
import { getPublishedCalendar, getAllCalendars } from "../services/calendar-service"
import type { WorkerContext } from "@/shared/server/worker-context-builder"
import type {
  AnnualVacationCalendar,
  VacationPlanInput,
  VacationRole,
  VacationEntitlement,
} from "../domain/types"

type WizardStep =
  | "welcome"
  | "found"
  | "preference"
  | "planning"
  | "comparison"
  | "summary"

const CONTAINER: CSSProperties = {
  width: "100%",
  maxWidth: 760,
  minWidth: 0,
  boxSizing: "border-box",
  margin: "0 auto",
  padding: "1rem",
}

const HEADER: CSSProperties = {
  fontSize: "clamp(1.5rem, 7vw, 2rem)",
  lineHeight: 1.15,
  fontWeight: 700,
  color: "var(--fg)",
  marginBottom: "0.5rem",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "normal",
  maxWidth: "100%",
  minWidth: 0,
}

const SUBTITLE: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.875rem",
  marginBottom: "1.5rem",
  lineHeight: 1.5,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "normal",
  maxWidth: "100%",
  minWidth: 0,
}

const BUTTON_ROW: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  justifyContent: "space-between",
  marginTop: "1.5rem",
  flexWrap: "wrap",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
}

const INFO_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
  gap: "0.75rem",
  marginBottom: "1rem",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
}

const INFO_CARD: CSSProperties = {
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.75rem 1rem",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowWrap: "anywhere",
  wordBreak: "normal",
}

const ALERT_WARN: CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: "var(--radius)",
  padding: "0.75rem 1rem",
  color: "#92400e",
  fontSize: "0.85rem",
  marginBottom: "1rem",
  lineHeight: 1.4,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
}

const BADGE: CSSProperties = {
  display: "inline-block",
  padding: "0.2rem 0.6rem",
  borderRadius: "9999px",
  fontSize: "0.75rem",
  fontWeight: 600,
  background: "var(--primary)",
  color: "var(--primary-fg)",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
}

// Roles de respaldo estructural si el servidor aún no tiene publicado el calendario oficial 2027
const STRUCTURAL_ROLES_2027: VacationRole[] = [
  { id: "str-1", roleNumber: 1, startDate: "2027-01-16", endDate: "2027-01-31", roleGroup: "A", label: "Rol #1 (16 a 31 Ene)", enabled: true },
  { id: "str-2", roleNumber: 2, startDate: "2027-02-01", endDate: "2027-02-15", roleGroup: "B", label: "Rol #2 (01 a 15 Feb)", enabled: true },
  { id: "str-3", roleNumber: 3, startDate: "2027-02-16", endDate: "2027-02-28", roleGroup: "A", label: "Rol #3 (16 a 28 Feb)", enabled: true },
  { id: "str-4", roleNumber: 4, startDate: "2027-03-01", endDate: "2027-03-15", roleGroup: "B", label: "Rol #4 (01 a 15 Mar)", enabled: true },
  { id: "str-5", roleNumber: 5, startDate: "2027-03-16", endDate: "2027-03-31", roleGroup: "A", label: "Rol #5 (16 a 31 Mar)", enabled: true },
  { id: "str-6", roleNumber: 6, startDate: "2027-04-01", endDate: "2027-04-15", roleGroup: "B", label: "Rol #6 (01 a 15 Abr)", enabled: true },
  { id: "str-7", roleNumber: 7, startDate: "2027-04-16", endDate: "2027-04-30", roleGroup: "A", label: "Rol #7 (16 a 30 Abr)", enabled: true },
  { id: "str-8", roleNumber: 8, startDate: "2027-05-01", endDate: "2027-05-15", roleGroup: "B", label: "Rol #8 (01 a 15 May)", enabled: true },
  { id: "str-9", roleNumber: 9, startDate: "2027-05-16", endDate: "2027-05-31", roleGroup: "A", label: "Rol #9 (16 a 31 May)", enabled: true },
  { id: "str-10", roleNumber: 10, startDate: "2027-06-01", endDate: "2027-06-15", roleGroup: "B", label: "Rol #10 (01 a 15 Jun)", enabled: true },
  { id: "str-11", roleNumber: 11, startDate: "2027-06-16", endDate: "2027-06-30", roleGroup: "A", label: "Rol #11 (16 a 30 Jun)", enabled: true },
  { id: "str-12", roleNumber: 12, startDate: "2027-07-01", endDate: "2027-07-15", roleGroup: "B", label: "Rol #12 (01 a 15 Jul)", enabled: true },
  { id: "str-13", roleNumber: 13, startDate: "2027-07-16", endDate: "2027-07-31", roleGroup: "A", label: "Rol #13 (16 a 31 Jul)", enabled: true },
  { id: "str-14", roleNumber: 14, startDate: "2027-08-01", endDate: "2027-08-15", roleGroup: "B", label: "Rol #14 (01 a 15 Ago)", enabled: true },
  { id: "str-15", roleNumber: 15, startDate: "2027-08-16", endDate: "2027-08-31", roleGroup: "A", label: "Rol #15 (16 a 31 Ago)", enabled: true },
  { id: "str-16", roleNumber: 16, startDate: "2027-09-01", endDate: "2027-09-15", roleGroup: "B", label: "Rol #16 (01 a 15 Sep)", enabled: true },
  { id: "str-17", roleNumber: 17, startDate: "2027-09-16", endDate: "2027-09-30", roleGroup: "A", label: "Rol #17 (16 a 30 Sep)", enabled: true },
  { id: "str-18", roleNumber: 18, startDate: "2027-10-01", endDate: "2027-10-15", roleGroup: "B", label: "Rol #18 (01 a 15 Oct)", enabled: true },
  { id: "str-19", roleNumber: 19, startDate: "2027-10-16", endDate: "2027-10-31", roleGroup: "A", label: "Rol #19 (16 a 31 Oct)", enabled: true },
  { id: "str-20", roleNumber: 20, startDate: "2027-11-01", endDate: "2027-11-15", roleGroup: "B", label: "Rol #20 (01 a 15 Nov)", enabled: true },
  { id: "str-21", roleNumber: 21, startDate: "2027-11-16", endDate: "2027-11-30", roleGroup: "A", label: "Rol #21 (16 a 30 Nov)", enabled: true },
  { id: "str-22", roleNumber: 22, startDate: "2027-12-01", endDate: "2027-12-15", roleGroup: "B", label: "Rol #22 (01 a 15 Dic)", enabled: true },
  { id: "str-23", roleNumber: 23, startDate: "2027-12-16", endDate: "2027-12-31", roleGroup: "A", label: "Rol #23 (16 a 31 Dic)", enabled: true },
]

export function VacationWizard({ initialContext }: { initialContext?: WorkerContext | null }) {
  const [step, setStep] = useState<WizardStep>("welcome")
  const [priority, setPriority] = useState<VacationPriority>("COMPARE_ALL")
  const [activePeriodIdx, setActivePeriodIdx] = useState<number>(1)
  const [selections, setSelections] = useState<Record<number, PlanSelectionStep>>({})
  const [calendar, setCalendar] = useState<AnnualVacationCalendar | null>(null)
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(true)
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false)

  const supabase = createClient()

  // Carga del calendario oficial o borrador
  useEffect(() => {
    let active = true
    getPublishedCalendar(supabase, 2027)
      .then(async (pub) => {
        if (!active) return
        if (pub && pub.roles.length > 0) {
          setCalendar(pub)
        } else {
          const all = await getAllCalendars(supabase)
          const draft2027 = all.find((c) => c.year === 2027)
          if (draft2027 && draft2027.roles.length > 0) {
            setCalendar(draft2027)
          } else {
            setCalendar({
              id: "cal-2027-provisional",
              year: 2027,
              version: "1.0.0-provisional",
              sourceName: "Calendario Anual 2027 (Estructura Base Provisional)",
              status: "DRAFT",
              roles: STRUCTURAL_ROLES_2027,
            })
          }
        }
      })
      .catch((err) => {
        console.error("Error al cargar calendario 2027:", err)
        if (active) {
          setCalendar({
            id: "cal-2027-provisional",
            year: 2027,
            version: "1.0.0-provisional",
            sourceName: "Calendario Anual 2027 (Estructura Base Provisional)",
            status: "DRAFT",
            roles: STRUCTURAL_ROLES_2027,
          })
        }
      })
      .finally(() => {
        if (active) setLoadingCalendar(false)
      })

    return () => {
      active = false
    }
  }, [supabase])

  // Prefill desde el tarjetón / contexto
  const prefilled = useMemo(() => {
    return prefillVacationSimulator(initialContext || null)
  }, [initialContext])

  const effectiveSeniorityYears = prefilled.profile?.effectiveSeniority?.years ?? 0
  const rawDueDate = prefilled.dueDate
  const formattedDueDate = rawDueDate ? formatMexicanDate(rawDueDate) : null
  const initialContinuity = prefilled.continuityMark ?? 0
  const regime = prefilled.regime

  // Sueldo Mensual Integrado
  const smi = initialContext?.payroll?.integratedMonthlySalary ?? null
  const smiMeta = initialContext?.payroll?.integratedSalaryMeta
  const sourcePayslipPeriod = initialContext?.payroll?.latestPeriod ?? undefined
  const isReconstructedSmi = smiMeta?.origin === "RECONSTRUCTED"

  // Detección de derecho V20
  const twentyYearsOrMoreDays = initialContext?.vacations?.twentyYearsOrMoreDays ?? 0
  const hasConfirmedV20 = twentyYearsOrMoreDays > 0
  const hasSeniorityForV20 = effectiveSeniorityYears >= 20
  const hasV20 = hasConfirmedV20 || hasSeniorityForV20

  const requiredPeriodCount = getRequiredPeriodCount(regime, hasV20)

  // Derechos vacacionales
  const entitlements: VacationEntitlement[] = useMemo(() => {
    return initialContext?.vacations?.entitlements ?? [
      {
        id: "ord-1",
        kind: "ORDINARY" as const,
        periodNumber: 1,
        dueDate: rawDueDate,
        sourcePayslipPeriod: sourcePayslipPeriod || "",
        confirmed: Boolean(rawDueDate),
      },
      {
        id: "ord-2",
        kind: "ORDINARY" as const,
        periodNumber: 2,
        sourcePayslipPeriod: sourcePayslipPeriod || "",
        confirmed: false,
      },
    ]
  }, [initialContext, rawDueDate, sourcePayslipPeriod])

  const planInput: VacationPlanInput = useMemo(() => ({
    workerProfile: prefilled.profile,
    regime,
    initialContinuity,
    entitlements,
    calendar,
    integratedMonthlySalary: smi,
    sourcePayslipPeriod,
    isReconstructedSmi,
  }), [prefilled.profile, regime, initialContinuity, entitlements, calendar, smi, sourcePayslipPeriod, isReconstructedSmi])

  // Plan actual calculado
  const planResult = useMemo(() => {
    return buildVacationPlan(planInput, selections)
  }, [planInput, selections])

  function handleSelectMark(periodIdx: number, mark: number) {
    setSelections((prev) => ({
      ...prev,
      [periodIdx]: {
        ...prev[periodIdx],
        mark,
      },
    }))
  }

  function handleSelectRole(periodIdx: number, role: VacationRole) {
    setSelections((prev) => ({
      ...prev,
      [periodIdx]: {
        ...prev[periodIdx],
        role,
        startDate: role.startDate,
        endDate: role.endDate,
      },
    }))
  }

  // Marcas compatibles para el periodo activo
  const activePeriod = planResult.periods[activePeriodIdx - 1]
  const currentContinuityForActive = activePeriod?.continuityBefore ?? initialContinuity

  const allPossibleMarks = regime === "CUATRIMESTRAL"
    ? [0, 2, 5]
    : activePeriod?.kind === "V20"
      ? [0, 6, 7, 8]
      : [0, 1, 2, 3, 4, 9]

  const allowedMarks = useMemo(() => {
    if (activePeriod?.kind === "V20") {
      return [0, 6, 7, 8]
    }
    return getCompatibleInclusionMarks(regime, currentContinuityForActive)
  }, [regime, currentContinuityForActive, activePeriod?.kind])

  const orderedAllowedMarks = useMemo(() => {
    return orderMarksByPriority(allowedMarks, priority)
  }, [allowedMarks, priority])

  const disallowedMarks = allPossibleMarks.filter((m) => !allowedMarks.includes(m))

  // Orientación contextual de continuidad según régimen
  const continuityGuidance = useMemo(() => {
    return getVacationContinuityGuidance(
      activePeriod?.kind === "V20" ? "EXTRAORDINARIO_V20" : regime,
      currentContinuityForActive
    )
  }, [regime, currentContinuityForActive, activePeriod?.kind])

  // Comparativa de alternativas (Paso 5)
  const comparisonOptions = useMemo(() => {
    if (regime !== "SEMESTRAL") return []

    // Opción 1: Más dinero primero (marca 4 -> marca 9)
    const optMoreNow = buildVacationPlan(planInput, {
      1: { mark: 4, role: calendar?.roles[0] },
      2: { mark: 9, role: calendar?.roles[1] },
    })

    // Opción 2: Pago repartido (marca 1 -> marca 1)
    const optSplit = buildVacationPlan(planInput, {
      1: { mark: 1, role: calendar?.roles[0] },
      2: { mark: 1, role: calendar?.roles[1] },
    })

    // Opción 3: Más descanso (marca 2 -> marca 3)
    const optRest = buildVacationPlan(planInput, {
      1: { mark: 2, role: calendar?.roles[0] },
      2: { mark: 3, role: calendar?.roles[1] },
    })

    return [
      {
        id: "MORE_NOW",
        name: "Más dinero en el primer periodo",
        summary: "Cobras la ayuda cultural completa con marca 4 en el 1er periodo y cierras con marca 9.",
        p1Gross: optMoreNow.periods[0]?.payment?.grossVacationExtra ?? null,
        p2Gross: optMoreNow.periods[1]?.payment?.grossVacationExtra ?? null,
        totalGross: optMoreNow.totalGrossVacationExtra,
        marks: [4, 9],
      },
      {
        id: "SPLIT_PAY",
        name: "Pago repartido (mitad y mitad)",
        summary: "Cobras 50% de ayuda en cada periodo (marca 1→1).",
        p1Gross: optSplit.periods[0]?.payment?.grossVacationExtra ?? null,
        p2Gross: optSplit.periods[1]?.payment?.grossVacationExtra ?? null,
        totalGross: optSplit.totalGrossVacationExtra,
        marks: [1, 1],
      },
      {
        id: "MORE_REST",
        name: "Conservar descanso (sin ayuda 048)",
        summary: "Conservas un segundo periodo de descanso (marca 2→3). No paga la ayuda cultural.",
        p1Gross: optRest.periods[0]?.payment?.grossVacationExtra ?? null,
        p2Gross: optRest.periods[1]?.payment?.grossVacationExtra ?? null,
        totalGross: optRest.totalGrossVacationExtra,
        marks: [2, 3],
      },
    ]
  }, [planInput, regime, calendar?.roles])

  function applyComparisonOption(optMarks: number[]) {
    setSelections((prev) => ({
      ...prev,
      1: { ...prev[1], mark: optMarks[0] },
      2: { ...prev[2], mark: optMarks[1] },
    }))
    setStep("summary")
  }

  // ==================== VISTAS POR PASO ====================

  // PASO 1: BIENVENIDA
  if (step === "welcome") {
    return (
      <div style={CONTAINER}>
        <h1 style={HEADER}>Asesor y Planificador Vacacional IMSS</h1>
        <p style={SUBTITLE}>
          Bienvenido a la simulación de tus vacaciones del siguiente año. La orientación se basa en tu tarjetón, tu antigüedad, el Contrato Colectivo, el procedimiento institucional y el calendario vacacional publicado.
        </p>

        {calendar?.status === "DRAFT" && (
          <div style={ALERT_WARN}>
            <strong>Aviso de calendario 2027:</strong> El calendario oficial 2027 todavía no está publicado por el IMSS. Puedes conocer tus opciones, derechos y los importes estimados que cobrarías, pero las fechas de los roles mostradas son provisionales.
          </div>
        )}

        <Card padding="1.25rem" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--fg)" }}>
            ¿En qué te ayuda esta herramienta?
          </h3>
          <ul style={{ paddingLeft: "1.25rem", color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.8, margin: 0 }}>
            <li>Saber cuántos periodos debes programar de acuerdo con tu tarjetón y antigüedad.</li>
            <li>Conocer cuándo se genera cada derecho y la fecha límite por vencer.</li>
            <li>Identificar qué marca paga más dinero en este momento, cuál divide el pago o cuál no incluye la ayuda.</li>
            <li>Calcular cuánto recibirías aproximadamente en pesos por concepto de prima vacacional (029) y ayuda cultural (048).</li>
            <li>Elegir roles válidos sin empalmes ni inconsistencias normativas.</li>
          </ul>
        </Card>

        <div style={BUTTON_ROW}>
          <div />
          <Button variant="primary" onClick={() => setStep("found")}>
            Comenzar simulación →
          </Button>
        </div>
      </div>
    )
  }

  // PASO 2: LO ENCONTRADO EN TU TARJETÓN
  if (step === "found") {
    return (
      <div style={CONTAINER}>
        <h1 style={HEADER}>Lo que encontramos en tu tarjetón</h1>
        <p style={SUBTITLE}>
          Datos confirmados de tu relación laboral utilizados para la planificación anual:
        </p>

        <div style={INFO_GRID}>
          <div style={INFO_CARD}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Régimen vacacional</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {regime === "CUATRIMESTRAL" ? "Cuatrimestral (Radiaciones)" : regime === "ESTATUTO" ? "Estatuto" : "Semestral Ordinario"}
            </div>
          </div>

          <div style={INFO_CARD}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Antigüedad efectiva</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {effectiveSeniorityYears} {effectiveSeniorityYears === 1 ? "año cumplido" : "años cumplidos"}
            </div>
          </div>

          <div style={INFO_CARD}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Continuidad actual</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              Marca {initialContinuity}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              {initialContinuity === 0 ? "Inicio de ciclo" : initialContinuity === 1 ? "1ra fracción tomada" : initialContinuity === 3 ? "2do periodo pendiente" : "Secuencia en curso"}
            </div>
          </div>

          <div style={INFO_CARD}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Fecha por vencer</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {formattedDueDate || "Pendiente de confirmar"}
            </div>
          </div>
        </div>

        {/* Sueldo Mensual Integrado */}
        <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            Base de cálculo salarial (SMI)
          </div>
          {smi !== null && smi > 0 ? (
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)" }}>
                {formatMexicanCurrency(smi)}
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.5rem", lineHeight: 1.5 }}>
                Para hacer este cálculo usamos el Sueldo Mensual Integrado de tu tarjetón {sourcePayslipPeriod ? `del periodo ${sourcePayslipPeriod}` : ""}: <strong>{formatMexicanCurrency(smi)}</strong>.
              </p>
              {isReconstructedSmi && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  * Importe reconstruido a partir de tus percepciones fijas confirmadas (conceptos 002, 011, etc.).
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "#b91c1c", fontSize: "0.85rem", lineHeight: 1.5 }}>
              ⚠️ No encontramos completo tu Sueldo Mensual Integrado. Puedes planificar las fechas y marcas, pero revisa tu tarjetón para calcular exactamente cuánto cobrarías en pesos.
            </div>
          )}
        </Card>

        {/* Número de periodos requeridos */}
        <Card padding="1.25rem" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span style={BADGE}>{requiredPeriodCount} {requiredPeriodCount === 1 ? "Periodo" : "Periodos"}</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--fg)" }}>
              Programación anual obligatoria
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
            {regime === "CUATRIMESTRAL"
              ? `Por ser trabajador cuatrimestral expuesto a radiaciones${hasV20 ? " y contar con derecho V20" : ""}, debes programar ${requiredPeriodCount} periodos.`
              : `De acuerdo con tu tarjetón y régimen semestral${hasV20 ? " con derecho extraordinario V20" : ""}, debes programar ${requiredPeriodCount} periodos.`
            }
          </p>

          {/* Estado del V20 */}
          <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--accent)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", lineHeight: 1.4 }}>
            <strong>Periodo Extraordinario V20: </strong>
            {hasConfirmedV20 ? (
              <span style={{ color: "#166534" }}>Confirmado en tu tarjetón ({twentyYearsOrMoreDays} días registrados).</span>
            ) : hasSeniorityForV20 ? (
              <span style={{ color: "#92400e" }}>Por tu antigüedad ({effectiveSeniorityYears} años) podrías tener derecho a un periodo extraordinario, pero no lo encontramos confirmado en tu tarjetón. Revísalo con Servicios de Personal.</span>
            ) : (
              <span style={{ color: "var(--muted)" }}>No aplica (se adquiere al cumplir 20 años efectivos de servicio).</span>
            )}
          </div>
        </Card>

        <div style={BUTTON_ROW}>
          <Button variant="secondary" onClick={() => setStep("welcome")}>
            ← Atrás
          </Button>
          <Button variant="primary" onClick={() => setStep("preference")}>
            Continuar a prioridades →
          </Button>
        </div>
      </div>
    )
  }

  // PASO 3: QUÉ PREFIERE EL TRABAJADOR
  if (step === "preference") {
    return (
      <div style={CONTAINER}>
        <h1 style={HEADER}>¿Qué prefieres en tus vacaciones?</h1>
        <p style={SUBTITLE}>
          Elige qué aspecto es más importante para ti. Esta preferencia no modifica las reglas del Contrato Colectivo; solo te mostrará primero las alternativas más convenientes.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
          <div
            onClick={() => setPriority("MORE_NOW")}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius)",
              border: `2px solid ${priority === "MORE_NOW" ? "var(--primary)" : "var(--border)"}`,
              background: priority === "MORE_NOW" ? "rgba(37,99,235,0.05)" : "var(--card)",
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              💵 Quiero cobrar más en el primer periodo
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Te orienta hacia opciones como la <strong>Marca 4</strong> (o Marca 0), cobrando el 100% de la ayuda cultural en la primera exhibición.
            </div>
          </div>

          <div
            onClick={() => setPriority("SPLIT_PAY")}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius)",
              border: `2px solid ${priority === "SPLIT_PAY" ? "var(--primary)" : "var(--border)"}`,
              background: priority === "SPLIT_PAY" ? "rgba(37,99,235,0.05)" : "var(--card)",
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              ⚖️ Prefiero repartir el pago
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Te orienta hacia la <strong>Marca 1</strong>, cobrando el 50% de la ayuda en cada periodo fraccionado.
            </div>
          </div>

          <div
            onClick={() => setPriority("MORE_REST")}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius)",
              border: `2px solid ${priority === "MORE_REST" ? "var(--primary)" : "var(--border)"}`,
              background: priority === "MORE_REST" ? "rgba(37,99,235,0.05)" : "var(--card)",
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              🏖️ Prefiero conservar más días de descanso
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Te orienta hacia secuencias de descansos completos (como la <strong>Marca 2→3</strong> o cuatrimestral <strong>2→5→5</strong>). Cobras la prima pero no la ayuda 048.
            </div>
          </div>

          <div
            onClick={() => setPriority("COMPARE_ALL")}
            style={{
              padding: "1rem",
              borderRadius: "var(--radius)",
              border: `2px solid ${priority === "COMPARE_ALL" ? "var(--primary)" : "var(--border)"}`,
              background: priority === "COMPARE_ALL" ? "rgba(37,99,235,0.05)" : "var(--card)",
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              🔍 Quiero comparar todas las opciones
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Muestra todas las marcas compatibles sin ningún filtro de preferencia.
            </div>
          </div>
        </div>

        <div style={BUTTON_ROW}>
          <Button variant="secondary" onClick={() => setStep("found")}>
            ← Atrás
          </Button>
          <Button variant="primary" onClick={() => setStep("planning")}>
            Continuar a programación →
          </Button>
        </div>
      </div>
    )
  }

  // PASO 4: PROGRAMACIÓN PASO A PASO POR PERIODO
  if (step === "planning") {
    const isV20 = activePeriod?.kind === "V20"
    const currentSelection = selections[activePeriodIdx] || {}
    const selectedMark = currentSelection.mark
    const selectedRole = currentSelection.role

    const currentPeriodPayment = activePeriod?.payment
    const activePeriodUnits = activePeriod?.units || 10

    return (
      <div style={CONTAINER}>
        {/* Navegación adaptable de periodos (cuadrícula en móvil, sin corte horizontal) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
            gap: "0.5rem",
            marginBottom: "0.5rem",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {Array.from({ length: requiredPeriodCount }).map((_, i) => {
            const pNum = i + 1
            const isV = hasV20 && pNum === requiredPeriodCount
            const isCurrent = pNum === activePeriodIdx
            const hasSel = Boolean(selections[pNum]?.role && selections[pNum]?.mark !== undefined)

            return (
              <button
                key={pNum}
                onClick={() => setActivePeriodIdx(pNum)}
                style={{
                  padding: "0.6rem 0.75rem",
                  borderRadius: "var(--radius)",
                  border: `1.5px solid ${isCurrent ? "var(--primary)" : "var(--border)"}`,
                  background: isCurrent ? "var(--primary)" : hasSel ? "var(--accent)" : "var(--card)",
                  color: isCurrent ? "var(--primary-fg)" : "var(--fg)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  textAlign: "center",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "normal",
                }}
              >
                {isV ? "V20" : `Periodo ${pNum}`} {hasSel ? "✓" : ""}
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem", whiteSpace: "normal" }}>
          Estás programando el {isV20 ? "periodo extraordinario V20" : `periodo ${activePeriodIdx} de ${requiredPeriodCount}`}.
        </div>

        {/* Título Adaptable */}
        <h1 style={HEADER}>
          {isV20
            ? "Programa tu periodo extraordinario V20"
            : activePeriodIdx === 1
            ? "Programa tu primer periodo"
            : activePeriodIdx === 2
            ? "Programa tu segundo periodo"
            : activePeriodIdx === 3
            ? "Programa tu tercer periodo"
            : activePeriodIdx === 4
            ? "Programa tu cuarto periodo"
            : `Programa tu periodo ${activePeriodIdx}`
          }
        </h1>
        <p style={SUBTITLE}>
          {isV20
            ? "Este es tu periodo extraordinario por 20 años o más de servicio (10 días de disfrute o pago)."
            : `Este es el periodo ${activePeriodIdx} de ${requiredPeriodCount} que debes programar.`
          }
        </p>

        {/* Explicación amigable para régimen cuatrimestral */}
        {regime === "CUATRIMESTRAL" && !isV20 && (
          <Card padding="1.25rem" style={{ marginBottom: "1.25rem", background: "var(--accent)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
              Programación de vacaciones cuatrimestrales
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.5, marginBottom: "0.75rem" }}>
              Por ser cuatrimestral debes programar tres periodos ordinarios. Las marcas de los tres periodos deben seguir la misma opción.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              <div style={{ background: "var(--card)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, color: "var(--fg)" }}>Opción A — Descanso regular con ayuda.</div>
                <p style={{ margin: "0.25rem 0", color: "var(--muted)", lineHeight: 1.4 }}>
                  En esta opción programas los tres periodos con la secuencia permitida de la opción A. En cada periodo te diremos cuántos días descansas y cuánto recibirías de prima y ayuda.
                </p>
                <div style={{ fontWeight: 600, color: "var(--primary)", marginTop: "0.25rem" }}>
                  Primer periodo: marca 0 • Segundo periodo: marca 0 • Tercer periodo: marca 0
                </div>
              </div>

              <div style={{ background: "var(--card)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, color: "var(--fg)" }}>Opción B — Más días de descanso, sin ayuda cultural.</div>
                <p style={{ margin: "0.25rem 0", color: "var(--muted)", lineHeight: 1.4 }}>
                  Empiezas con la marca 2 y los periodos siguientes continúan con las marcas 5 que correspondan.
                </p>
                <div style={{ fontWeight: 600, color: "var(--primary)", marginTop: "0.25rem" }}>
                  Marca 2 → Marca 5 → Marca 5
                </div>
              </div>

              {hasV20 && (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic", marginTop: "0.25rem" }}>
                  Además de tus tres periodos cuatrimestrales, tienes un periodo extraordinario V20. Lo programaremos por separado.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tarjeta: Antes de elegir, entiende tus marcas */}
        <Card padding="1.25rem" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            Antes de elegir, entiende tus marcas
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.5, marginBottom: "0.5rem" }}>
            La marca de continuidad es la que ya trae tu tarjetón. Nos dice cómo quedó tu programación anterior. Tú no la eliges en este momento.
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.5, marginBottom: "0.75rem" }}>
            La marca de inclusión es la que vas a anotar al programar tus nuevas vacaciones. Esa sí debes elegirla entre las opciones permitidas.
          </p>

          <div style={{ background: "var(--accent)", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Lo que trae tu tarjetón</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--fg)" }}>
                Continuidad actual: marca {currentContinuityForActive}
              </div>
            </div>
            <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "1rem", lineHeight: 1 }}>↓</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Lo que vas a programar</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)" }}>
                Marca de inclusión: {selectedMark !== undefined ? `marca ${selectedMark}` : "Pendiente de elegir abajo"}
              </div>
            </div>
            <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "1rem", lineHeight: 1 }}>↓</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Cómo quedarás después</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--fg)" }}>
                Nueva continuidad: {activePeriod?.continuityAfter !== undefined ? `marca ${activePeriod.continuityAfter}` : "Se actualizará al elegir marca"}
              </div>
            </div>
          </div>
        </Card>

        {/* Tarjeta: La marca que traes */}
        <Card padding="1.25rem" style={{ marginBottom: "1.25rem", borderLeft: "4px solid var(--primary)" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
            La marca que traes
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, margin: "0.25rem 0 0.5rem 0", color: "var(--fg)" }}>
            En tu tarjetón aparece continuidad {currentContinuityForActive}.
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.5, marginBottom: "0.5rem" }}>
            <strong>¿Qué significa?</strong> {continuityGuidance.whatItMeans}
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
            <strong>Por eso, para este periodo:</strong> {continuityGuidance.allowedMarksExplanation}
          </p>
        </Card>

        {/* 1. SELECCIÓN DE MARCA */}
        <Card padding="1.25rem" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            1. Selecciona qué marca vas a anotar
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Elige entre las marcas permitidas para este periodo:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", boxSizing: "border-box" }}>
            {orderedAllowedMarks.map((m) => {
              const g = getMarkGuidance(m, regime)
              const isChosen = selectedMark === m

              // Estimación para esta marca en tiempo real
              const markPayment = calculateVacationPayment({
                integratedMonthlySalary: smi,
                daysOrUnits: activePeriodUnits,
                seniorityYears: effectiveSeniorityYears,
                mark: m,
                radiologicalExposure: Boolean(prefilled.profile?.radiologicalExposure),
                regime,
                isV20,
              })

              const nextTransition = applyInclusionMark(
                isV20 ? "EXTRAORDINARIO_V20" : regime,
                currentContinuityForActive,
                m
              )
              const nextContinuityVal = "nextContinuity" in nextTransition ? nextTransition.nextContinuity : undefined

              return (
                <div
                  key={m}
                  onClick={() => handleSelectMark(activePeriodIdx, m)}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius)",
                    border: `2px solid ${isChosen ? "var(--primary)" : "var(--border)"}`,
                    background: isChosen ? "rgba(37,99,235,0.04)" : "var(--card)",
                    cursor: "pointer",
                    width: "100%",
                    boxSizing: "border-box",
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--fg)" }}>
                      {regime === "CUATRIMESTRAL" && m === 0 ? "Marca 0 — Sí te paga ayuda" : `Marca ${m} — Sí puedes utilizarla`}
                    </div>
                    {isChosen && <span style={BADGE}>Seleccionada</span>}
                  </div>

                  {regime === "CUATRIMESTRAL" && m === 0 ? (
                    <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div>En este periodo descansarías <strong>{activePeriodUnits} días</strong>.</div>
                      <div>También recibirías tu prima vacacional y una ayuda equivalente a <strong>{markPayment.helpDays ?? 13.3} días</strong> de tu Sueldo Mensual Integrado.</div>
                      {markPayment.confidence !== "INCOMPLETE" && markPayment.grossVacationExtra !== null && (
                        <div>Con los datos de tu último tarjetón, recibirías aproximadamente <strong>{formatMexicanCurrency(markPayment.grossVacationExtra)}</strong> adicionales antes de impuestos y descuentos.</div>
                      )}
                      <div>Como eres cuatrimestral, todavía tendrás que programar los demás periodos de tu secuencia.</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginBottom: "0.4rem" }}>
                      <strong>Qué pasa:</strong> Descansas {activePeriodUnits} días.
                    </div>
                  )}

                  <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginBottom: "0.5rem" }}>
                    {markPayment.confidence !== "INCOMPLETE" && markPayment.grossVacationExtra !== null ? (
                      <div style={{ paddingLeft: "0.5rem", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <div>Prima vacacional 029: <strong>{formatMexicanCurrency(markPayment.premium029)}</strong></div>
                        <div>Ayuda cultural 048: <strong>{formatMexicanCurrency(markPayment.culturalHelp048)}</strong></div>
                        <div style={{ marginTop: "0.25rem", color: "var(--primary)", fontWeight: 700 }}>
                          Total adicional estimado por vacaciones: {formatMexicanCurrency(markPayment.grossVacationExtra)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem", lineHeight: 1.4 }}>
                          Este cálculo usa el Sueldo Mensual Integrado de tu último tarjetón. El importe real puede variar algunos centavos por el cálculo interno de nómina.
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem", lineHeight: 1.4 }}>
                          Esta estimación utiliza tu salario actual. Si recibes un incremento salarial antes de tus vacaciones, el importe real será mayor.
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: "var(--muted)", fontStyle: "italic", marginTop: "0.25rem" }}>
                        Falta confirmar tu Sueldo Mensual Integrado para calcular el importe.
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginBottom: "0.6rem" }}>
                    <strong>Después quedarás con:</strong> Continuidad {nextContinuityVal !== undefined ? nextContinuityVal : "—"}
                  </div>

                  {/* Bloques separados de orientación */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <div>
                      <strong>Lo que cobrarías:</strong> {g.economicDetail}
                    </div>
                    <div>
                      <strong>Lo que sigue:</strong> {g.nextStepDetail}
                    </div>
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <Button
                      size="sm"
                      variant={isChosen ? "primary" : "secondary"}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectMark(activePeriodIdx, m)
                      }}
                    >
                      {isChosen ? "Marca elegida ✓" : `Elegir marca ${m}`}
                    </Button>
                  </div>
                </div>
              )
            })}

            {/* Acordeón de marcas no permitidas */}
            {disallowedMarks.length > 0 && (
              <details
                style={{
                  marginTop: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem",
                  background: "var(--accent)",
                  width: "100%",
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                  Ver marcas que no puedes utilizar ahora ({disallowedMarks.length})
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
                  {disallowedMarks.map((m) => {
                    const reason = getIncompatibleReason(m, currentContinuityForActive, regime)
                    return (
                      <div
                        key={m}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px dashed var(--border)",
                          background: "var(--card)",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--fg)" }}>
                          Marca {m} — No corresponde ahora
                        </div>
                        <div style={{ color: "var(--muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
                          {reason}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        </Card>

        {/* 2. SELECCIÓN DE ROL DEL CALENDARIO */}
        <Card padding="1.25rem" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            2. Selecciona tu rol del calendario
          </h3>
          {loadingCalendar ? (
            <LoadingSpinner text="Cargando roles del calendario..." />
          ) : !calendar || calendar.roles.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No hay roles disponibles en este momento.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                gap: "0.5rem",
                width: "100%",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              {calendar.roles.map((r) => {
                const isSelected = selectedRole?.id === r.id || selectedRole?.roleNumber === r.roleNumber
                return (
                  <button
                    key={r.id || r.roleNumber}
                    onClick={() => handleSelectRole(activePeriodIdx, r)}
                    style={{
                      textAlign: "left",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "var(--radius)",
                      border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "rgba(37,99,235,0.06)" : "var(--card)",
                      cursor: "pointer",
                      width: "100%",
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--fg)" }}>
                      Rol #{r.roleNumber} {r.roleGroup ? `(Grupo ${r.roleGroup})` : ""}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      Inicio: {formatMexicanDate(r.startDate)}
                    </div>
                    {r.endDate && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Fin: {formatMexicanDate(r.endDate)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* 3. ESTIMACIÓN ECONÓMICA EN TIEMPO REAL */}
        {currentPeriodPayment && currentPeriodPayment.confidence !== "INCOMPLETE" && (
          <Card padding="1rem" style={{ marginBottom: "1.5rem", background: "rgba(37,99,235,0.03)" }}>
            <h4 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--fg)" }}>
              Estimación de pago para este periodo:
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                gap: "0.5rem",
                textAlign: "center",
                width: "100%",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <div style={{ background: "var(--card)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Prima vacacional 029</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--fg)" }}>
                  {formatMexicanCurrency(currentPeriodPayment.premium029)}
                </div>
              </div>
              <div style={{ background: "var(--card)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Ayuda cultural 048</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--fg)" }}>
                  {formatMexicanCurrency(currentPeriodPayment.culturalHelp048)}
                </div>
              </div>
              <div style={{ background: "var(--card)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Total adicional estimado por vacaciones</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)" }}>
                  {formatMexicanCurrency(currentPeriodPayment.grossVacationExtra)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.4 }}>
              Este cálculo usa el Sueldo Mensual Integrado de tu último tarjetón. El importe real puede variar algunos centavos por el cálculo interno de nómina.
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
              Esta estimación utiliza tu salario actual. Si recibes un incremento salarial antes de tus vacaciones, el importe real será mayor.
            </div>
          </Card>
        )}

        <div style={BUTTON_ROW}>
          {activePeriodIdx > 1 ? (
            <Button variant="secondary" onClick={() => setActivePeriodIdx((p) => p - 1)}>
              ← Periodo anterior
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStep("preference")}>
              ← Prioridades
            </Button>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", minWidth: 0 }}>
            <Button variant="ghost" onClick={() => setStep("comparison")}>
              Comparar opciones
            </Button>

            {activePeriodIdx < requiredPeriodCount ? (
              <Button
                variant="primary"
                disabled={!selectedRole || selectedMark === undefined}
                onClick={() => setActivePeriodIdx((p) => p + 1)}
              >
                Siguiente periodo →
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!selectedRole || selectedMark === undefined}
                onClick={() => setStep("summary")}
              >
                Ver resumen del plan →
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // PASO 5: COMPARACIÓN DE ALTERNATIVAS
  if (step === "comparison") {
    return (
      <div style={CONTAINER}>
        <h1 style={HEADER}>Comparativa de Opciones</h1>
        <p style={SUBTITLE}>
          Compara cómo cambia el importe adicional y el cobro de la ayuda cultural según la secuencia de marcas que elijas:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
          {comparisonOptions.map((opt) => (
            <Card key={opt.id} padding="1.25rem">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>{opt.name}</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0 0" }}>{opt.summary}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => applyComparisonOption(opt.marks)}>
                  Elegir esta opción
                </Button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                  textAlign: "center",
                  width: "100%",
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              >
                <div style={{ background: "var(--accent)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>1er Periodo (Marca {opt.marks[0]})</div>
                  <div style={{ fontWeight: 700, color: "var(--fg)" }}>{formatMexicanCurrency(opt.p1Gross)}</div>
                </div>
                <div style={{ background: "var(--accent)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>2do Periodo (Marca {opt.marks[1]})</div>
                  <div style={{ fontWeight: 700, color: "var(--fg)" }}>{formatMexicanCurrency(opt.p2Gross)}</div>
                </div>
                <div style={{ background: "var(--accent)", padding: "0.5rem", borderRadius: "var(--radius-sm)", minWidth: 0, overflowWrap: "anywhere" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Total Adicional Bruto</div>
                  <div style={{ fontWeight: 700, color: "var(--primary)" }}>{formatMexicanCurrency(opt.totalGross)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div style={BUTTON_ROW}>
          <Button variant="secondary" onClick={() => setStep("planning")}>
            ← Volver a programación
          </Button>
          <Button variant="primary" onClick={() => setStep("summary")}>
            Ver resumen del plan →
          </Button>
        </div>
      </div>
    )
  }

  // PASO 6: RESUMEN FINAL Y PLANIFICACIÓN
  return (
    <div style={CONTAINER}>
      <h1 style={HEADER}>Así quedaría tu programación</h1>
      <p style={SUBTITLE}>
        Resumen integral de tus periodos vacacionales, marcas a solicitar e importes económicos aproximados:
      </p>

      {/* Cifra destacada total */}
      <Card padding="1.5rem" style={{ textAlign: "center", marginBottom: "1.25rem", background: "rgba(37,99,235,0.04)", border: "1.5px solid var(--primary)" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Total adicional estimado por vacaciones
        </div>
        <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)", margin: "0.25rem 0", overflowWrap: "anywhere" }}>
          {formatMexicanCurrency(planResult.totalGrossVacationExtra)}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5 }}>
          Antes de impuestos y deducciones. Incluye {formatMexicanCurrency(planResult.totalPremium029)} de prima vacacional 029 y {formatMexicanCurrency(planResult.totalCulturalHelp048)} de ayuda cultural 048.
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.4 }}>
          Este cálculo usa el Sueldo Mensual Integrado de tu último tarjetón. El importe real puede variar algunos centavos por el cálculo interno de nómina.
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
          Esta estimación utiliza tu salario actual. Si recibes un incremento salarial antes de tus vacaciones, el importe real será mayor.
        </div>
      </Card>

      {/* Lista de periodos programados */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
        {planResult.periods.map((p) => {
          const g = p.selectedMark !== undefined ? getMarkGuidance(p.selectedMark, regime) : null

          return (
            <Card key={p.index} padding="1.25rem">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={BADGE}>
                  {p.kind === "V20" ? "Periodo Extraordinario V20" : `Periodo ${p.index}`}
                </span>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)" }}>
                  Marca a anotar: {p.selectedMark ?? "Sin marca"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  marginBottom: "0.75rem",
                  width: "100%",
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              >
                <div>
                  <strong>Rol:</strong> {p.selectedRole?.label || `Rol #${p.selectedRole?.roleNumber || "—"}`}
                </div>
                <div>
                  <strong>Días / Unidades:</strong> {p.units || "—"} días
                </div>
                <div>
                  <strong>Inicio:</strong> {p.startDate ? formatMexicanDate(p.startDate) : "Por definir"}
                </div>
                <div>
                  <strong>Término:</strong> {p.endDate ? formatMexicanDate(p.endDate) : "Por definir"}
                </div>
              </div>

              {p.payment && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
                    gap: "0.5rem",
                    background: "var(--accent)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8rem",
                    width: "100%",
                    boxSizing: "border-box",
                    minWidth: 0,
                  }}
                >
                  <div>Prima vacacional 029: <strong>{formatMexicanCurrency(p.payment.premium029)}</strong></div>
                  <div>Ayuda cultural 048: <strong>{formatMexicanCurrency(p.payment.culturalHelp048)}</strong></div>
                  <div>Total adicional estimado por vacaciones: <strong style={{ color: "var(--primary)" }}>{formatMexicanCurrency(p.payment.grossVacationExtra)}</strong></div>
                </div>
              )}

              {g && (
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.4 }}>
                  ℹ️ {g.plainSummary}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* 3 Acordeones Prácticos */}
      <Card padding="1rem" style={{ marginBottom: "1rem" }}>
        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", color: "var(--fg)" }}>
            🗣️ Qué debes decir en Personal
          </summary>
          <p style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.5rem", lineHeight: 1.6 }}>
            Al solicitar tu rol de vacaciones, indica que programas {requiredPeriodCount} periodos. Solicita que se anote la marca {planResult.periods[0]?.selectedMark ?? "correspondiente"} en tu primer periodo y la marca {planResult.periods[1]?.selectedMark ?? "correspondiente"} en tu segundo periodo para que coincida con tu continuidad y derecho de cobro.
          </p>
        </details>

        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", color: "var(--fg)" }}>
            ✍️ Qué marca anotar
          </summary>
          <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.5rem", lineHeight: 1.6 }}>
            {planResult.periods.map((p) => (
              <div key={p.index} style={{ marginBottom: "0.25rem" }}>
                • {p.kind === "V20" ? "Periodo Extraordinario V20" : `Periodo ${p.index}`}: Anotar <strong>Marca {p.selectedMark ?? "—"}</strong> ({p.selectedRole?.label || "Rol elegido"}).
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", color: "var(--fg)" }}>
            🔍 Qué debes revisar antes de firmar
          </summary>
          <ul style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.5rem", paddingLeft: "1.25rem", lineHeight: 1.6, margin: 0 }}>
            <li>Que la fecha de inicio coincida exactamente con el rol que elegiste.</li>
            <li>Que el número de marca no haya sido alterado.</li>
            <li>Que tu adscripción, matrícula y categoría estén correctas en el formato institucional.</li>
          </ul>
        </details>

        <details>
          <summary style={{ fontWeight: 600, cursor: "pointer", fontSize: "0.85rem", color: "var(--muted)" }}>
            📖 Ver detalle y fundamento normativo
          </summary>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.5 }}>
            <p style={{ margin: "0.25rem 0" }}><strong>CCT IMSS-SNTSS Cláusula 47:</strong> Días mínimos anuales (16 a 20 días hábiles) y tabla de ayuda para actividades culturales y recreativas (concepto 048) según años de servicio.</p>
            <p style={{ margin: "0.25rem 0" }}><strong>Procedimiento 1A74-003-025:</strong> Reglas de anticipación (hasta 120 días semestral / 105 días cuatrimestral) y cálculo sobre Sueldo Mensual Integrado.</p>
            <p style={{ margin: "0.25rem 0" }}><strong>UPO y Continuidad:</strong> Cadena de transición matemática validada desde continuidad inicial {initialContinuity}.</p>
          </div>
        </details>
      </Card>

      {/* Acciones finales */}
      {savedSuccess && (
        <div style={{ background: "#dcfce7", border: "1px solid #22c55e", color: "#166534", padding: "0.75rem 1rem", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.85rem" }}>
          ✓ Simulación guardada con éxito en tu cuenta.
        </div>
      )}

      <div style={BUTTON_ROW}>
        <Button variant="secondary" onClick={() => setStep("planning")}>
          ← Ajustar fechas o marcas
        </Button>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", minWidth: 0 }}>
          <Button variant="ghost" onClick={() => window.print()}>
            🖨️ Imprimir / Guardar PDF
          </Button>
          <Button variant="primary" onClick={() => setSavedSuccess(true)}>
            Guardar simulación
          </Button>
        </div>
      </div>
    </div>
  )
}
