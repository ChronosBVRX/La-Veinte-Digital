"use client"

import { useState, useEffect } from "react"
import { IdentificationCard, ArrowRight, ArrowsLeftRight, CurrencyDollar, ClockCounterClockwise } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { SectionCard } from "@/shared/components/ui/SectionCard"
import { Button } from "@/shared/components/ui/Button"
import { Alert } from "@/shared/components/ui/Alert"
import { Badge } from "@/shared/components/ui/Badge"
import { Spinner } from "@/shared/components/ui/Spinner"
import { EmptyState } from "@/shared/components/feedback/EmptyState"
import { ScenarioComparison } from "./ScenarioComparison"
import { simulateScenario, compareProjections } from "../services/simulate"
import { getCurrentPayPeriod } from "@/features/nomina/lib/periods"
import { calculateProjection } from "@/features/nomina/lib/engine"
import { resolveCategory } from "@/features/nomina/lib/category-resolver"
import { SALARY_DATA } from "@/features/nomina/data/salaries"
import type { SimulationScenario, SimulationResult } from "../services/simulate"
import type { PayrollProjection, EmployeePayrollProfile, PayrollFact } from "@/features/nomina/lib/types"

type Step = "loading" | "no-profile" | "select" | "result"

const SCENARIO_PRESETS: { key: string; label: string; description: string; icon: typeof CurrencyDollar }[] = [
  { key: "category_change", label: "Cambio de categoría", description: "Simula cómo cambiaría tu quincena si tuvieras otra categoría.", icon: CurrencyDollar },
  { key: "seniority_bump", label: "Más antigüedad", description: "Proyecta tu quincena cuando cumplas más años de servicio.", icon: ClockCounterClockwise },
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
        // Sync to localStorage as cache
        const profileData = {
          categoryName: emp.categoryName,
          workdayHours: emp.workdayHours,
          effectiveSeniorityDate: emp.effectiveSeniorityDate,
          facts: pay.payrollFacts || [],
          recurringConcepts: pay.recurringConcepts || [],
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

      const comparison = compareProjections(baseline, simResult.projection)
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
          title="Configura tu perfil primero"
          description="Necesitas tener tu perfil laboral configurado para usar el simulador. Importa un tarjetón o captura tus datos manualmente."
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
            display: "flex", gap: "1rem", marginBottom: "var(--space-6)", flexWrap: "wrap",
          }}>
            <div style={{
              flex: 1, minWidth: 180, padding: "var(--space-4)", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Categoría actual</span>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 700, marginTop: "0.25rem" }}>{baseline.category.categoryName}</div>
            </div>
            <div style={{
              flex: 1, minWidth: 180, padding: "var(--space-4)", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Quincena estimada</span>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "0.25rem", color: "var(--area-work)" }}>
                ${baseline.totals.possibleGross.toLocaleString("es-MX")}
              </div>
            </div>
          </div>
        )}

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
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}>
          <div style={{
            padding: "var(--space-4)", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", textAlign: "center",
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Situación actual
            </span>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "0.25rem" }}>
              ${result.baselineNet.toLocaleString("es-MX")}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>quincenal estimado</span>
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
              color: result.netDelta > 0 ? "var(--success)" : result.netDelta < 0 ? "var(--error)" : "var(--fg)",
            }}>
              ${result.scenarioNet.toLocaleString("es-MX")}
            </div>
            <div style={{ marginTop: "0.25rem" }}>
              <Badge variant={result.netDelta > 0 ? "success" : result.netDelta < 0 ? "error" : "neutral"}>
                {result.netDelta > 0 ? "+" : ""}
                ${result.netDelta.toLocaleString("es-MX")}
                {" "}({result.netDeltaPercent > 0 ? "+" : ""}{result.netDeltaPercent}%)
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
            color: result.netDelta > 0 ? "var(--success)" : result.netDelta < 0 ? "var(--error)" : "var(--fg)",
            marginBottom: "0.125rem",
          }}>
            {result.netDelta > 0 ? "+" : ""}${result.netDelta.toLocaleString("es-MX")} por quincena
          </div>
          <Badge variant={result.netDelta > 0 ? "success" : result.netDelta < 0 ? "error" : "neutral"}>
            {result.netDeltaPercent > 0 ? "+" : ""}{result.netDeltaPercent}% que ahora
          </Badge>
        </div>

        <SectionCard title="Lo que más cambia" description="Los tres conceptos con mayor diferencia entre tu situación actual y el escenario.">
          <ScenarioComparison result={result} />
        </SectionCard>

        <div style={{ marginTop: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
          <strong>Cómo se calcula:</strong> Los montos son estimaciones basadas en el tabulador salarial 2025-2027 y las cláusulas del Contrato Colectivo de Trabajo. Los descuentos (ISR, cuotas IMSS) no están incluidos.
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
