"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateClausula97 } from "../lib/clausula97"
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

export function Clausula97Calculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("clausula-97", targetDate)

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
  const [result, setResult] = useState<ReturnType<typeof calculateClausula97> | null>(null)
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
    setResult(calculateClausula97({ concepto002: c002Num, concepto011: c011Num }))
  }

  function handleClear() {
    setC002(""); setC011(""); setErrors({}); setResult(null)
    setSelectedCategory(null)
    prefillFields.clearDirty()
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Cláusula 97</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Anticipo de hasta por cuatro meses de sueldo sin intereses, una sola vez al año. La base mensual corresponde a (002 + 011) × 2.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", maxWidth: "400px" }}>
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
          <ResultCard
            title="Base de cálculo"
            rows={[
              { label: "Base quincenal (002 + 011)", value: result.baseQuincenal },
              { label: "Sueldo mensual base", value: result.baseMensual, highlight: true },
            ]}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
            {result.opciones.map((o) => (
              <Card key={o.meses} padding="1rem">
                <p style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.25rem" }}>{o.meses} {o.meses === 1 ? "mes" : "meses"}</p>
                <p style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--primary)" }}>{formatCurrency(o.monto)}</p>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                  <p style={{ margin: "0 0 0.25rem" }}>Recuperación: <strong>{o.quincenasRecuperacion} quincenas</strong></p>
                  <p style={{ margin: 0 }}>Descuento estimado: <strong>{formatCurrency(o.descuentoQuincenal)}</strong> / qna</p>
                </div>
              </Card>
            ))}
          </div>
          <FormulaExplanation steps={[
            "Base mensual = (Concepto 002 + Concepto 011) × 2",
            "1 mes: anticipo de 1 sueldo mensual, recuperación en 10 quincenas (sin intereses)",
            "2 meses: anticipo de 2 sueldos mensuales, recuperación en 20 quincenas",
            "3 meses: anticipo de 3 sueldos mensuales, recuperación en 30 quincenas",
            "4 meses: anticipo de 4 sueldos mensuales, recuperación en 40 quincenas",
            "El anticipo es facultativo en una sola exhibición o fraccionado, previa verificación de liquidez institucional.",
          ]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
