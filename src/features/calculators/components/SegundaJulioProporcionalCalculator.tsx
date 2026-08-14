"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateSegundaJulioProporcional, validateUnidades, SEGUNDA_JULIO_ANNUAL_BASE } from "../lib/segundaJulio"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002" | "unidades"

export function SegundaJulioProporcionalCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("segunda-julio-proporcional", targetDate)

  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const raw = prestamosRaw as Record<string, unknown>[]
    const records = raw.map(mapJsonToPrestamoRecord)
    const norm = initialCategoria.toLowerCase().trim()
    return records.find((r) => r.categoria.toLowerCase().includes(norm)) ?? null
  }, [initialCategoria])

  const [c002, setC002] = useState(() =>
    initialMatch?.sueldoQuincenal ? formatCurrency(initialMatch.sueldoQuincenal) : ""
  )
  const [unidades, setUnidades] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateSegundaJulioProporcional> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )

  const fields = useMemo(() => ({ c002, unidades }), [c002, unidades])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    else setUnidades(value)
    if (!value) setResult(null)
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002" | "daysWorkedInAnnualPeriod">>(() => ({
    c002: "concepto002",
    unidades: "daysWorkedInAnnualPeriod",
  }), [])

  const prefillFields = usePrefillFields({
    fields,
    setField,
    fieldMap,
    data: prefill.data,
  })

  const handleCurrencyChange = useCallback((key: FieldKey) => (value: string) => {
    prefillFields.markDirty(key)
    setField(key, value)
  }, [prefillFields.markDirty, setField])

  const c002Num = parseCurrencyInput(c002)

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (c002Num === null) e.c002 = "Ingrese un importe válido"
    const unidadesNum = parseInt(unidades, 10)
    if (!unidades || isNaN(unidadesNum)) e.unidades = "Ingrese las unidades computables"
    else {
      const err = validateUnidades(unidadesNum)
      if (err) e.unidades = err
    }
    setErrors(e)
    return Object.keys(e).length === 0 && c002Num !== null
  }

  function handleCalculate() {
    if (!validate() || c002Num === null) return
    setResult(calculateSegundaJulioProporcional({
      concepto002: c002Num, unidades: parseInt(unidades, 10),
    }))
  }

  function handleClear() {
    setC002(""); setUnidades(""); setErrors({}); setResult(null)
    setSelectedCategory(null)
    prefillFields.clearDirty()
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Segunda de Julio Proporcional</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Para categorías 08 y 02. Calcula el pago proporcional del Fondo de Ahorro según las unidades computables
        del periodo anual (1 de julio – 30 de junio). Base = sueldo tabular (002).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" description="Importe quincenal del concepto 002 (sueldo tabular)." value={c002} onChange={handleCurrencyChange("c002")} error={errors.c002} />
        <div>
          <Input
            id="unidades"
            label="Unidades computables (1 julio – 30 junio)"
            value={unidades}
            onChange={(e) => { setField("unidades", e.target.value); prefillFields.markDirty("unidades") }}
            placeholder="Ej: 180"
            inputMode="numeric"
            autoComplete="off"
            style={{ borderColor: errors.unidades ? "var(--error)" : undefined }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
            Número entero entre 1 y {SEGUNDA_JULIO_ANNUAL_BASE}. Año completo = {SEGUNDA_JULIO_ANNUAL_BASE} unidades; medio año = 180.
          </p>
          {errors.unidades && (
            <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{errors.unidades}</p>
          )}
        </div>
        <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          <strong>Régimen ordinario (proc. 1A74-003-024):</strong> la base es el sueldo tabular (002).
          La prima 011 <strong>no</strong> integra esta base. Si solo laboraste parte del año, indica las unidades reales.
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
        {prefillFields.hasSuggestions && (
          <Button variant="ghost" onClick={prefillFields.restore}><Sparkles size={16} /> Restaurar valores sugeridos</Button>
        )}
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base (002, sueldo tabular)", value: result.base },
            { label: "Importe completo (360 unidades)", value: result.importeCompleto },
            { label: "Proporción del periodo laborado", value: result.proporcion, format: "percent" },
            { label: "Importe proporcional", value: result.resultado, highlight: true },
          ]} />
          <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.875rem" }}>
            Cobrarás aproximadamente <strong>{formatCurrency(result.resultado)}</strong> más tu quincena.
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Monto informativo; no constituye garantía contractual.</p>
          </div>
          <FormulaExplanation steps={[
            "Base = Concepto 002 (sueldo tabular)",
            "Importe completo = (Base ÷ 15) × 46",
            "Proporción = Unidades computables ÷ 360",
            "Importe proporcional = Importe completo × Proporción",
          ]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
