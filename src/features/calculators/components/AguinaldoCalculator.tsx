"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateAguinaldo } from "../lib/aguinaldo"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

export function AguinaldoCalculator({ initialCategoria }: Props) {
  const [c002, setC002] = useState("")
  const [c011, setC011] = useState("")
  const [errors, setErrors] = useState<{ c002?: string; c011?: string }>({})
  const [result, setResult] = useState<ReturnType<typeof calculateAguinaldo> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const raw = prestamosRaw as Record<string, unknown>[]
    const records = raw.map(mapJsonToPrestamoRecord)
    const norm = initialCategoria.toLowerCase().trim()
    return records.find((r) => r.categoria.toLowerCase().includes(norm)) ?? null
  }, [initialCategoria])

  if (initialMatch && !selectedCategory) {
    setSelectedCategory(initialMatch.categoria)
    if (!c002 && initialMatch.sueldoQuincenal) setC002(formatCurrency(initialMatch.sueldoQuincenal))
    if (!c011 && initialMatch.concepto011) setC011(formatCurrency(initialMatch.concepto011))
  }

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
    if (record.concepto011) setC011(formatCurrency(record.concepto011))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    const v002 = parseCurrencyInput(c002)
    const v011 = parseCurrencyInput(c011)
    if (v002 === null) e.c002 = "Ingrese un valor valido"
    if (v011 === null) e.c011 = "Ingrese un valor valido"
    setErrors(e)
    return Object.keys(e).length === 0 && v002 !== null && v011 !== null
  }

  function handleCalculate() {
    if (!validate()) return
    const v002 = parseCurrencyInput(c002)!
    const v011 = parseCurrencyInput(c011)!
    setResult(calculateAguinaldo({ concepto002: v002, concepto011: v011 }))
  }

  function handleClear() {
    setC002(""); setC011(""); setErrors({}); setResult(null); setSelectedCategory(null)
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Aguinaldo</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Calcula el aguinaldo estimado.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" value={c002} onChange={setC002} error={errors.c002} />
        <CurrencyField label="Concepto 011" value={c011} onChange={setC011} error={errors.c011} />
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base", value: result.base },
            { label: "Aguinaldo total", value: result.total, highlight: true },
            { label: "Anticipo enero (047)", value: result.anticipoEnero047 },
            { label: "Anticipo agosto (043)", value: result.anticipoAgosto043 },
            { label: "Resto diciembre (049)", value: result.restoDiciembre049 },
          ]} />
          <FormulaExplanation steps={["Base = 002 + 011", "Aguinaldo = Base x 7.490956567109524", "047 = Total / 6", "043 = Total / 3", "049 = Total / 2"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
