"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateSegundaJulio } from "../lib/segundaJulio"
import { SEGUNDA_JULIO_DAYS_FULL } from "../lib/segundaJulio"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002"

export function SegundaJulioCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("segunda-julio", targetDate)

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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<number | null>(null)
  const [base, setBase] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )

  const fields = useMemo(() => ({ c002 }), [c002])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    if (!value) setResultado(null)
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002">>(() => ({
    c002: "concepto002",
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
    setErrors(e)
    return Object.keys(e).length === 0 && c002Num !== null
  }

  function handleCalculate() {
    if (!validate() || c002Num === null) return
    setBase(c002Num)
    setResultado(calculateSegundaJulio({ concepto002: c002Num }))
  }

  function handleClear() {
    setC002(""); setErrors({}); setResultado(null); setBase(0)
    setSelectedCategory(null)
    prefillFields.clearDirty()
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Segunda de Julio</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Calcula el pago anual de la prestación de segunda de julio (Fondo de Ahorro, régimen ordinario).
        Usa el concepto 002 (sueldo tabular) de tu nómina quincenal.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" description="Importe quincenal del concepto 002 (sueldo tabular)." value={c002} onChange={handleCurrencyChange("c002")} error={errors.c002} />
      </div>
      <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
        <strong>Régimen ordinario (proc. 1A74-003-024):</strong> la base es el sueldo tabular (002).
        La prima 011 <strong>no</strong> integra esta base.
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
        {prefillFields.hasSuggestions && (
          <Button variant="ghost" onClick={prefillFields.restore}><Sparkles size={16} /> Restaurar valores sugeridos</Button>
        )}
      </div>
      {resultado !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base (002, sueldo tabular)", value: base },
            { label: "Segunda de julio (46 días)", value: resultado, highlight: true },
          ]} />
          <FormulaExplanation steps={[
            "Base = Concepto 002 (sueldo tabular)",
            `Segunda de julio = (Base ÷ 15) × ${SEGUNDA_JULIO_DAYS_FULL}`,
          ]} />
          <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            Corresponde a la segunda quincena de julio. Este cálculo presume el escenario de año completo (360 unidades computables).
            Si tu tiempo laborado del 1 de julio al 30 de junio fue parcial, el pago es proporcional.
          </div>
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
