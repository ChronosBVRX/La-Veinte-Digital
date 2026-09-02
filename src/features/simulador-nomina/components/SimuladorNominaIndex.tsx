"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { IdentificationCard, ArrowRight, ArrowsLeftRight, CurrencyDollar, ClockCounterClockwise } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { SectionCard } from "@/shared/components/ui/SectionCard"
import { Button } from "@/shared/components/ui/Button"
import { Alert } from "@/shared/components/ui/Alert"
import { Badge } from "@/shared/components/ui/Badge"
import { Spinner } from "@/shared/components/ui/Spinner"
import { EmptyState } from "@/shared/components/feedback/EmptyState"
import { ScenarioComparison } from "./ScenarioComparison"
import { simulateScenario, compareProjections, sumComprobadoTarjeton } from "../services/simulate"
import { getCurrentPayPeriod } from "@/features/nomina/lib/periods"
import { calculateProjection } from "@/features/nomina/lib/engine"
import { resolveCategory } from "@/features/nomina/lib/category-resolver"
import { SALARY_DATA } from "@/features/nomina/data/salaries"
import type { SimulationScenario, SimulationResult } from "../services/simulate"
import { analyzeSeniorityImpact } from "@/features/nomina/lib/seniority-impact"
import type { PayrollProjection, EmployeePayrollProfile, PayrollFact } from "@/features/nomina/lib/types"

type Step = "loading" | "no-profile" | "select" | "result"

const SCENARIO_PRESETS: { key: string; label: string; description: string; icon: typeof CurrencyDollar }[] = [
  { key: "category_change", label: "Cambio de categoría", description: "Simula cómo cambiaría tu quincena si tuvieras otra categoría.", icon: CurrencyDollar },
  { key: "seniority_bump", label: "Más antigüedad", description: "Simula tu quincena con N años TOTALES de antigüedad, manteniendo tu categoría y conceptos actuales.", icon: ClockCounterClockwise },
]

interface InitialState {
  step: Step
  profile: EmployeePayrollProfile | null
  baseline: PayrollProjection | null
  categories: { name: string; salary: number }[]
  targetCategory: string
}

function loadInitialState(): InitialState {
  // localStorage is kept as fast cache/fallback, but real source is Supabase via API
  try {
    const raw = localStorage.getItem("nomina_profile")
    if (!raw) return { step: "no-profile", profile: null, baseline: null, categories: [], targetCategory: "" }

    const loadedProfile = JSON.parse(raw) as EmployeePayrollProfile
    if (!loadedProfile.categoryId && !loadedProfile.categoryName) {
      return { step: "no-profile", profile: null, baseline: null, categories: [], targetCategory: "" }
    }

    const today = new Date().toISOString().slice(0, 10)
    const period = getCurrentPayPeriod(today)
    const resolved = resolveCategory(
      loadedProfile.categoryId ?? loadedProfile.categoryName ?? "",
      String(loadedProfile.workdayHours)
    )

    if (!resolved || resolved.status !== "resolved" || !resolved.category) {
      return { step: "no-profile", profile: null, baseline: null, categories: [], targetCategory: "" }
    }

    const computedSeniority = loadedProfile.effectiveSeniorityDate
      ? computeSeniority(loadedProfile.effectiveSeniorityDate, period)
      : { years: 0, months: 0, days: 0, totalDays: 0, referenceDate: "", source: "institutional_entry_date" as const, warnings: [] as string[] }

    const facts: PayrollFact[] = loadedProfile.facts ?? []

    const projResult = calculateProjection({
      profile: { ...loadedProfile, facts },
      category: resolved.category,
      period,
      seniority: computedSeniority,
      incidents: [],
      recurringConcepts: [],
    })

    const cats = SALARY_DATA
      .filter((c: { workdayHours: number }) => c.workdayHours === 8)
      .map((c: { categoryName: string; biweeklyBaseSalary: number }) => ({
        name: c.categoryName,
        salary: c.biweeklyBaseSalary,
      }))
      .sort((a: { salary: number }, b: { salary: number }) => a.salary - b.salary)

    return {
      step: "select",
      profile: loadedProfile,
      baseline: projResult.projection,
      categories: cats,
      targetCategory: loadedProfile.categoryName ?? "",
    }
  } catch (e) {
    console.error("[SimuladorNomina]", e)
    return { step: "no-profile", profile: null, baseline: null, categories: [], targetCategory: "" }
  }
}

export function SimuladorNominaIndex() {
  const [initial] = useState(loadInitialState)
  const [step, setStep] = useState<Step>(initial.step)
  const [baseline, setBaseline] = useState<PayrollProjection | null>(initial.baseline)
  const [profile, setProfile] = useState<EmployeePayrollProfile | null>(initial.profile)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [scenarioType, setScenarioType] = useState<string | null>(null)
  const [targetCategory, setTargetCategory] = useState<string>(initial.targetCategory)
  const [targetYears, setTargetYears] = useState<number>(10)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [categories, setCategories] = useState<{ name: string; salary: number }[]>(initial.categories)

  // Hydrate from Supabase worker context on mount (source of truth)
  useEffect(() => {
    fetch("/api/worker-context")
      .then(r => r.json())
      .then((ctx: Record<string, unknown>) => {
        if (!ctx?.employment || !ctx?.payroll) return
        const emp = ctx.employment as Record<string, unknown>
        const pay = ctx.payroll as Record<string, unknown>
        // Sync to localStorage as cache. NUNCA pisar listas locales con
        // arrays vacíos del API (evita borrar evidencia válida si el servidor
        // aún no tiene contexto persistido).
        const prev = (() => {
          try { return JSON.parse(localStorage.getItem("nomina_profile") || "{}") as Partial<EmployeePayrollProfile> }
          catch { return {} as Partial<EmployeePayrollProfile> }
        })()
        const apiRc = (pay.recurringConcepts as EmployeePayrollProfile["recurringConcepts"]) || []
        const apiFacts = (pay.payrollFacts as EmployeePayrollProfile["facts"]) || []
        const profileData = {
          ...prev,
          categoryName: emp.categoryName ?? prev.categoryName,
          workdayHours: emp.workdayHours ?? prev.workdayHours,
          effectiveSeniorityDate: emp.effectiveSeniorityDate ?? prev.effectiveSeniorityDate,
          facts: apiFacts.length > 0 ? apiFacts : (prev.facts ?? []),
          recurringConcepts: apiRc.length > 0 ? apiRc : (prev.recurringConcepts ?? []),
        }
        localStorage.setItem("nomina_profile", JSON.stringify(profileData))
        // Reload from updated localStorage
        const reloaded = loadInitialState()
        if (reloaded.step !== "no-profile") {
          setStep(reloaded.step)
          setBaseline(reloaded.baseline)
          setProfile(reloaded.profile)
          setTargetCategory(reloaded.targetCategory)
          setCategories(reloaded.categories)
        }
      })
      .catch(() => { /* use localStorage as fallback */ })
  }, [])

  const runSimulation = async () => {
    if (!baseline || !profile) return
    setError(null)
    setRunning(true)

    try {
      const categoriesForSim = SALARY_DATA.map((c: { categoryId: string; categoryName: string; biweeklyBaseSalary: number; workdayHours: number }) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        biweeklyBaseSalary: c.biweeklyBaseSalary,
        workdayHours: c.workdayHours,
        sourceRecordId: "",
      }))

      let scenario: SimulationScenario

      if (scenarioType === "category_change") {
        scenario = {
          type: "category_change",
          label: "Cambio de categoría",
          description: `Simulando cambio a ${targetCategory}`,
          targetCategoryName: targetCategory,
        }
      } else if (scenarioType === "seniority_bump") {
        scenario = {
          type: "seniority_bump",
          label: "Más antigüedad",
          description: `Simulando ${targetYears} años de antigüedad`,
          targetSeniorityYears: targetYears,
        }
      } else {
        setError("Selecciona un escenario.")
        setRunning(false)
        return
      }

      const simResult = simulateScenario(baseline, scenario, { ...profile }, categoriesForSim)
      if ("error" in simResult) {
        setError(simResult.error)
        setRunning(false)
        return
      }

      const seniorityImpact = scenario.type === "seniority_bump" && !("error" in simResult)
        ? analyzeSeniorityImpact(baseline, simResult.projection)
        : undefined
      const comparison = compareProjections(baseline, simResult.projection, { seniorityImpact })
      setResult(comparison)
      setStep("result")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al simular.")
    } finally {
      setRunning(false)
    }
  }

  if (step === "loading") return <Spinner size="md" text="Cargando tu perfil..." />

  if (step === "no-profile") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <PageHeader
          title="Simulador de nómina"
          description="Explora cómo cambiaría tu quincena en distintos escenarios."
          icon={<ArrowsLeftRight size={24} weight="duotone" />}
        />
        <EmptyState
          icon={<IdentificationCard weight="duotone" />}
          title="Sube tu tarjetón para usar el simulador"
          description="El simulador usa tu categoría, antigüedad y jornada actuales. Súbelo desde Mi información laboral y tus datos se actualizan automáticamente; también puedes capturarlos manualmente ahí."
          action={
            <Link href="/profile/mi-informacion-laboral" style={{ textDecoration: "none" }}>
              <Button leadingIcon={<IdentificationCard size={16} weight="duotone" />}>
                Subir mi tarjetón IMSS
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (step === "select") {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <PageHeader
          title="Simulador de nómina"
          description="Explora cómo cambiaría tu quincena en distintos escenarios laborales."
          icon={<ArrowsLeftRight size={24} weight="duotone" />}
        />

        {baseline && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem", marginBottom: "var(--space-3)", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
          }}>
            <div style={{
              padding: "var(--space-4)", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", minWidth: 0, boxSizing: "border-box",
            }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Categoría actual</span>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 700, marginTop: "0.25rem", wordBreak: "break-word" }}>{baseline.category.categoryName}</div>
            </div>
            <div style={{
              padding: "var(--space-4)", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", minWidth: 0, boxSizing: "border-box",
            }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Quincena comprobada (tarjetón)</span>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "0.25rem", color: "var(--area-work)", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                ${(sumComprobadoTarjeton(profile) ?? baseline.totals.confirmedGross).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Mantener datos al día: mismo lugar unificado de siempre */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Link
            href="/profile/mi-informacion-laboral"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "0.75rem", flexWrap: "wrap", textDecoration: "none",
              padding: "0.625rem 0.875rem", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", background: "var(--card)",
            }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
              ¿Cambió tu categoría o antigüedad? Sube tu último tarjetón y el simulador se actualiza solo.
            </span>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--primary)", whiteSpace: "nowrap" }}>
              Actualizar mis datos →
            </span>
          </Link>
        </div>

        <SectionCard title="¿Qué quieres simular?" icon={<ArrowsLeftRight size={20} weight="duotone" />}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {SCENARIO_PRESETS.map((preset) => {
              const Icon = preset.icon
              const selected = scenarioType === preset.key
              return (
                <button
                  key={preset.key}
                  onClick={() => setScenarioType(preset.key)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "var(--space-4)",
                    padding: "var(--space-4)", borderRadius: "var(--radius-md)",
                    border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    background: selected ? "var(--surface-interactive)" : "var(--card)",
                    cursor: "pointer", textAlign: "left", width: "100%",
                    fontFamily: "inherit", color: "inherit",
                    transition: "all var(--transition)",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: "var(--radius-md)",
                    background: "var(--accent)", display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={20} weight="duotone" color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "0.125rem" }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                      {preset.description}
                    </div>
                  </div>
                </button>
              )
            })}

            {scenarioType === "category_change" && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                  Nueva categoría
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  style={{
                    width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", background: "var(--card)", fontSize: "var(--text-sm)",
                    minHeight: "var(--control-md)",
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} — ${c.salary.toLocaleString("es-MX")} quincenal
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scenarioType === "seniority_bump" && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                  Años de antigüedad simulados
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={targetYears}
                    onChange={(e) => setTargetYears(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 700, minWidth: 40, textAlign: "right" }}>{targetYears} años</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={runSimulation}
              loading={running}
              disabled={!scenarioType}
              leadingIcon={<ArrowRight size={16} />}
            >
              {running ? "Calculando..." : "Simular"}
            </Button>
          </div>
        </SectionCard>
      </div>
    )
  }

  if (step === "result" && result) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <PageHeader
          title="Resultado de simulación"
          description="Comparación entre tu situación actual y el escenario simulado."
          icon={<ArrowsLeftRight size={24} weight="duotone" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setStep("select") }}>
              Nueva simulación
            </Button>
          }
        />

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "var(--space-4)",
          marginBottom: "var(--space-6)", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
        }}>
          <div style={{
            padding: "var(--space-4)", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", textAlign: "center",
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Situación actual
            </span>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "0.25rem" }}>
              ${result.baselineGross.toLocaleString("es-MX")}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>bruto posible quincenal</span>
          </div>
          <div style={{
            padding: "var(--space-4)", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", textAlign: "center",
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Escenario simulado
            </span>
            <div style={{
              fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "0.25rem",
              color: result.grossDelta > 0 ? "var(--success)" : result.grossDelta < 0 ? "var(--error)" : "var(--fg)",
            }}>
              ${result.scenarioGross.toLocaleString("es-MX")}
            </div>
            <div style={{ marginTop: "0.25rem" }}>
              <Badge variant={result.grossDelta > 0 ? "success" : result.grossDelta < 0 ? "error" : "neutral"}>
                {result.grossDelta > 0 ? "+" : ""}
                ${result.grossDelta.toLocaleString("es-MX")}
                {" "}({result.grossDeltaPercent > 0 ? "+" : ""}{result.grossDeltaPercent}%)
              </Badge>
            </div>
          </div>
        </div>

        <div style={{
          padding: "var(--space-5)",
          background: "linear-gradient(135deg, var(--surface-interactive), var(--card))",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          textAlign: "center",
          marginBottom: "var(--space-5)",
        }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: "0.25rem" }}>
            Con este cambio recibirías aproximadamente
          </div>
          <div style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            color: result.grossDelta > 0 ? "var(--success)" : result.grossDelta < 0 ? "var(--error)" : "var(--fg)",
            marginBottom: "0.125rem",
          }}>
            {result.grossDelta > 0 ? "+" : ""}${result.grossDelta.toLocaleString("es-MX")} por quincena
          </div>
          <Badge variant={result.grossDelta > 0 ? "success" : result.grossDelta < 0 ? "error" : "neutral"}>
            {result.grossDeltaPercent > 0 ? "+" : ""}{result.grossDeltaPercent}% que ahora
          </Badge>
        </div>

        <SectionCard title="Lo que más cambia" description="Los tres conceptos con mayor diferencia entre tu situación actual y el escenario.">
          <ScenarioComparison result={result} />
        </SectionCard>

        {result.seniorityImpact && result.seniorityImpact.direct.length > 0 && (
          <SectionCard title="Cambio directo en tu quincena" description="Conceptos de tu quincena ordinaria que cambian con la antigüedad simulada.">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {result.seniorityImpact.direct.map((d) => (
                <div key={d.code} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap", padding: "var(--space-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{d.code} · {d.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: "0.125rem" }}>
                      ${d.before.toLocaleString("es-MX", { minimumFractionDigits: 2 })} → ${d.after.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <Badge variant={d.delta > 0 ? "success" : d.delta < 0 ? "error" : "neutral"}>
                    {d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {result.seniorityImpact && result.seniorityImpact.indirect.length > 0 && (
          <SectionCard title="También repercute en otras prestaciones" description="Prestaciones cuya base incluye un concepto que cambió. No suman a tu quincena ordinaria: se recalcularán cuando corresponda su pago.">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {result.seniorityImpact.indirect.map((i) => (
                <div key={i.code} style={{ padding: "var(--space-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{i.code} · {i.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Su importe se recalculará cuando corresponda el pago porque el concepto {i.causeCodes.join(", ")} forma parte de su base ({i.evidence.reference}).
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                    El importe depende del periodo y requiere confirmación.
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {result.seniorityImpact && result.seniorityImpact.milestones.length > 0 && (
          <SectionCard title="Próximos cambios por antigüedad" description="Generado desde la tabla contractual 63 Bis c (días por años cumplidos).">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {result.seniorityImpact.milestones.slice(0, 5).map((m) => (
                <div key={m.year} style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                  <strong style={{ color: "var(--fg)" }}>{m.year} años:</strong>{" "}
                  022 pasa al factor correspondiente a {m.days} días (+{m.factorDeltaDays} vs año anterior)
                  {m.notes.map((n, idx) => (
                    <span key={idx}> · {n.note}</span>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <div style={{ marginTop: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
          <strong>Cómo se calcula:</strong> Estimación con tu categoría, conceptos y tabulador actuales (no proyecta aumentos futuros), basada en el tabulador 2025-2027 y las cláusulas del CCT. Los descuentos (ISR, cuotas IMSS) no están incluidos.
        </div>
      </div>
    )
  }

  return null
}

function computeSeniority(
  dateStr: string,
  period: ReturnType<typeof getCurrentPayPeriod>
): { years: number; months: number; days: number; totalDays: number; referenceDate: string; source: "confirmed_effective_date" | "reconstructed_from_payslip" | "institutional_entry_date"; warnings: string[] } {
  const ref = new Date(dateStr)
  const end = new Date(period.endDate)
  let years = end.getFullYear() - ref.getFullYear()
  let months = end.getMonth() - ref.getMonth()
  let days = end.getDate() - ref.getDate()
  if (days < 0) { months--; days += new Date(end.getFullYear(), end.getMonth(), 0).getDate() }
  if (months < 0) { years--; months += 12 }
  const totalDays = Math.floor((end.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24))
  return { years, months, days, totalDays, referenceDate: dateStr, source: "institutional_entry_date", warnings: [] }
}
