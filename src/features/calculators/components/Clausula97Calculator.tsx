"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Input } from "@/shared/components/ui/Input"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateClausula97 } from "../lib/clausula97"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { calcularConcepto011, calcularConcepto022, parseSeniorityYears } from "../lib/conceptos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

const options = [
  { key: "unMes" as const, label: "1 mes", quincenas: 2 },
  { key: "dosMeses" as const, label: "2 meses", quincenas: 4 },
  { key: "tresMeses" as const, label: "3 meses", quincenas: 6 },
  { key: "cuatroMeses" as const, label: "4 meses", quincenas: 8 },
]

interface Props {
  initialCategoria?: string | null
  initialAntiguedad?: string | null
}

export function Clausula97Calculator({ initialCategoria, initialAntiguedad }: Props) {
  const [c002, setC002] = useState("")
  const [antiguedad, setAntiguedad] = useState(initialAntiguedad ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateClausula97> | null>(null)
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
    setResult(calculateClausula97({ concepto002: c002Num, concepto011: c011Calculated }))
  }

  function handleClear() {
    setC002(""); setAntiguedad(initialAntiguedad ?? ""); setErrors({}); setResult(null)
    setSelectedCategory(null); setJsonC011(null)
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Clausula 97</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Adelanto de una a cuatro quincenas.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", maxWidth: "400px" }}>
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" value={c002} onChange={(v) => { setC002(v); if (!v) setResult(null) }} error={errors.c002} />
        {c011Calculated !== null && (
          <div>
            <Input label="Concepto 011 (calculado)" value={formatCurrency(c011Calculated)} readOnly />
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
          <ResultCard title="Base quincenal" rows={[{ label: "Base (002 + 011 calculado)", value: result.baseQuincenal, highlight: true }]} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" }}>
            {options.map((o) => (
              <Card key={o.key} padding="1rem">
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.25rem" }}>{o.label}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>{o.quincenas} quincenas</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--primary)" }}>{formatCurrency(result[o.key])}</p>
                <p style={{ fontSize: "0.6875rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Base x {o.quincenas}</p>
              </Card>
            ))}
          </div>
          {c022 > 0 && (
            <ResultCard title="Prestación anual por antigüedad" rows={[
              { label: "Concepto 022", value: c022, highlight: true },
            ]} />
          )}
          <FormulaExplanation steps={["Base quincenal = 002 + 011 (011 = 002 × 0.8215)", "1 mes = Base x 2", "2 meses = Base x 4", "3 meses = Base x 6", "4 meses = Base x 8"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
