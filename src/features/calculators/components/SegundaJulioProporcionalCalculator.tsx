"use client"

import { useState, useMemo, useCallback } from "react"
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
import { calculateSegundaJulioProporcional, validateDiasLaborados } from "../lib/segundaJulio"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002" | "c011" | "dias"

export function SegundaJulioProporcionalCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
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
  const [c011, setC011] = useState(() =>
    initialMatch?.concepto011 !== undefined ? formatCurrency(initialMatch.concepto011) : ""
  )
  const [dias, setDias] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateSegundaJulioProporcional> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )

  const fields = useMemo(() => ({ c002, c011, dias }), [c002, c011, dias])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    else if (key === "c011") setC011(value)
    else setDias(value)
    if (!value) setResult(null)
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002" | "concepto011" | "daysWorkedInAnnualPeriod">>(() => ({
    c002: "concepto002",
    c011: "concepto011",
    dias: "daysWorkedInAnnualPeriod",
  }), [])

  const prefillFields = usePrefillFields({
    fields,
    setField,
    fieldMap,
    data: prefill.data,
  })

  const c002Num = parseCurrencyInput(c002)
  const c011Num = parseCurrencyInput(c011)

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    prefillFields.markDirty("c011")
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
    if (record.concepto011 !== undefined) setC011(formatCurrency(record.concepto011))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (c002Num === null) e.c002 = "Ingrese un importe válido"
    if (c011Num === null) e.c011 = "Ingrese un importe válido (0 si no aplica)"
    const diasNum = parseInt(dias, 10)
    if (!dias || isNaN(diasNum)) e.dias = "Ingrese los días laborados"
    else {
      const err = validateDiasLaborados(diasNum)
      if (err) e.dias = err
    }
    setErrors(e)
    return Object.keys(e).length === 0 && c002Num !== null && c011Num !== null
  }

  function handleCalculate() {
    if (!validate() || c002Num === null || c011Num === null) return
    setResult(calculateSegundaJulioProporcional({
      concepto002: c002Num, concepto011: c011Num, diasLaborados: parseInt(dias, 10),
    }))
  }

  function handleClear() {
    setC002(""); setC011(""); setDias(""); setErrors({}); setResult(null)
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
        Para categorías 08 y 02. Calcula el pago proporcional según los días laborados del 1 de julio al 30 de junio.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" description="Importe quincenal del concepto 002." value={c002} onChange={(v) => { setField("c002", v) }} error={errors.c002} />
        <CurrencyField label="Concepto 011" description="Importe quincenal del concepto 011. Copia el valor de tu nómina." value={c011} onChange={(v) => { setField("c011", v) }} error={errors.c011} />
        <div>
          <Input
            id="dias"
            label="Días laborados (1 julio – 30 junio)"
            value={dias}
            onChange={(e) => { setField("dias", e.target.value) }}
            placeholder="Ej: 180"
            inputMode="numeric"
            autoComplete="off"
            style={{ borderColor: errors.dias ? "var(--error)" : undefined }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
            Número entero entre 1 y 360. La aplicación fuente utiliza una base anual de 360 días.
          </p>
          {errors.dias && (
            <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{errors.dias}</p>
          )}
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
            { label: "Base (002 + 011)", value: result.base },
            { label: "Importe completo (360 días)", value: result.importeCompleto },
            { label: "Porcentaje del periodo laborado", value: result.proporcion, format: "percent" },
            { label: "Importe proporcional", value: result.resultado, highlight: true },
          ]} />
          <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.875rem" }}>
            Cobrarás aproximadamente <strong>{formatCurrency(result.resultado)}</strong> más tu quincena.
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Monto informativo; no constituye garantía contractual.</p>
          </div>
          <FormulaExplanation steps={[
            "Base = Concepto 002 + Concepto 011",
            "Importe completo = (Base ÷ 15) × 46",
            "Proporción = Días laborados ÷ 360",
            "Importe proporcional = Importe completo × Proporción",
          ]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
