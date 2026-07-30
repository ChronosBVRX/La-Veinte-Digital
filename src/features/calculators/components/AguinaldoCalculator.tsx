"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateAguinaldo } from "../lib/aguinaldo"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { calcularConcepto011, calcularConcepto022, parseSeniorityYears } from "../lib/conceptos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
  initialAntiguedad?: string | null
}

export function AguinaldoCalculator({ initialCategoria, initialAntiguedad }: Props) {
  const [c002, setC002] = useState("")
  const [antiguedad, setAntiguedad] = useState(initialAntiguedad ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateAguinaldo> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [jsonC011, setJsonC011] = useState<number | null>(null)

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
    if (initialMatch.concepto011) setJsonC011(initialMatch.concepto011)
  }

  const c002Num = parseCurrencyInput(c002)
  const c011Calculated = c002Num !== null ? calcularConcepto011(c002Num) : null
  const antiguedadYears = parseSeniorityYears(antiguedad)
  const c022 = c002Num !== null && antiguedadYears > 0 ? calcularConcepto022(c002Num, antiguedadYears) : 0

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
    setJsonC011(record.concepto011 ?? null)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (c002Num === null) e.c002 = "Ingrese un valor valido"
    setErrors(e)
    return Object.keys(e).length === 0 && c002Num !== null
  }

  function handleCalculate() {
    if (!validate() || c002Num === null || c011Calculated === null) return
    setResult(calculateAguinaldo({ concepto002: c002Num, concepto011: c011Calculated }))
  }

  function handleClear() {
    setC002(""); setAntiguedad(initialAntiguedad ?? ""); setErrors({}); setResult(null)
    setSelectedCategory(null); setJsonC011(null)
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
        <CurrencyField label="Concepto 002" value={c002} onChange={(v) => { setC002(v); if (!v) setResult(null) }} error={errors.c002} />
        {c011Calculated !== null && (
          <div>
            <Input
              label="Concepto 011 (calculado)"
              value={formatCurrency(c011Calculated)}
              readOnly
            />
            {jsonC011 !== null && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                011 en tabulador: {formatCurrency(jsonC011)} | 011 calculado: {formatCurrency(c011Calculated)}
              </p>
            )}
          </div>
        )}
        <CurrencyField label="Antigüedad (años)" value={antiguedad} onChange={(v) => { setAntiguedad(v); if (!v) setResult(null) }} />
        {c022 > 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", background: "var(--accent)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", margin: 0 }}>
            Concepto 022 (Ayuda de Renta por Antigüedad): <strong>{formatCurrency(c022)}</strong> anual
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base (002 + 011 calculado)", value: result.base },
            { label: "Aguinaldo total", value: result.total, highlight: true },
            { label: "Anticipo enero (047)", value: result.anticipoEnero047 },
            { label: "Anticipo agosto (043)", value: result.anticipoAgosto043 },
            { label: "Resto diciembre (049)", value: result.restoDiciembre049 },
          ]} />
          {c022 > 0 && (
            <ResultCard title="Prestación anual por antigüedad" rows={[
              { label: "Concepto 022", value: c022, highlight: true },
            ]} />
          )}
          <FormulaExplanation steps={["Base = 002 + 011 (011 = 002 × 0.8215)", "Aguinaldo = Base x 7.490956567109524", "047 = Total / 6", "043 = Total / 3", "049 = Total / 2"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
