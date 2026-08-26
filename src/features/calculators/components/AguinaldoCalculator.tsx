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
import { calculateAguinaldo } from "../lib/aguinaldo"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002" | "c011"

export function AguinaldoCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("aguinaldo", targetDate)

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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateAguinaldo> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )

  const fields = useMemo(() => ({ c002, c011 }), [c002, c011])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    else setC011(value)
    if (!value) setResult(null)
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002" | "concepto011">>(() => ({
    c002: "concepto002",
    c011: "concepto011",
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
    setErrors(e)
    return Object.keys(e).length === 0 && c002Num !== null && c011Num !== null
  }

  function handleCalculate() {
    if (!validate() || c002Num === null || c011Num === null) return
    setResult(calculateAguinaldo({ concepto002: c002Num, concepto011: c011Num }))
  }

  function handleClear() {
    setC002(""); setC011(""); setErrors({}); setResult(null)
    setSelectedCategory(null)
    prefillFields.clearDirty()
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Aguinaldo</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Calcula el aguinaldo estimado. Copia los conceptos 002 y 011 de tu nómina quincenal.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" description="Importe quincenal del concepto 002." value={c002} onChange={handleCurrencyChange("c002")} error={errors.c002} />
        <CurrencyField label="Concepto 011" description="Importe quincenal del concepto 011. Copia el valor de tu nómina." value={c011} onChange={handleCurrencyChange("c011")} error={errors.c011} />
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
            { label: "Aguinaldo total estimado", value: result.total, highlight: true },
            { label: "Concepto 047: anticipo de enero", value: result.anticipoEnero047 },
            { label: "Concepto 043: anticipo de agosto", value: result.anticipoAgosto043 },
            { label: "Concepto 049: resto de diciembre", value: result.restoDiciembre049 },
            ...(result.documentedAlternative
              ? [{ label: `Alternativa documentada (${result.documentedAlternative.label})`, value: result.documentedAlternative.total, format: "currency" as const }]
              : []),
          ]} />
          <FormulaExplanation steps={[
            "Base = Concepto 002 + Concepto 011",
            `Aguinaldo total = Base × ${result.factor}`,
            "Concepto 047 (anticipo enero) = Total ÷ 6",
            "Concepto 043 (anticipo agosto) = Total ÷ 3",
            "Concepto 049 (resto diciembre) = Total ÷ 2",
            "Alternativa documentada: Cláusula 107 (3 meses de sueldo nominal) = Base × 6 — en revisión",
          ]} />
          <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            La fórmula aplica el factor vigente {result.factor} conforme a la normativa disponible. La Cláusula 107 (3 meses de sueldo nominal, factor 6) se muestra como referencia comparativa en revisión.
            El resultado es orientativo y puede variar por impuestos, incidencias o criterios institucionales.
          </div>
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
