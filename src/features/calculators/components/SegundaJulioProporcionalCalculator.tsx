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
import { calculateSegundaJulioProporcional } from "../lib/segundaJulio"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

export function SegundaJulioProporcionalCalculator({ initialCategoria }: Props) {
  const [c002, setC002] = useState("")
  const [c011, setC011] = useState("")
  const [dias, setDias] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateSegundaJulioProporcional> | null>(null)
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
    const e: Record<string, string> = {}
    const v002 = parseCurrencyInput(c002)
    const v011 = parseCurrencyInput(c011)
    const vDias = parseInt(dias, 10)
    if (v002 === null) e.c002 = "Ingrese un valor valido"
    if (v011 === null) e.c011 = "Ingrese un valor valido"
    if (!dias || isNaN(vDias) || vDias < 1) e.dias = "Minimo 1 dia"
    else if (vDias > 360) e.dias = "Maximo 360 dias"
    else if (vDias !== Math.floor(vDias)) e.dias = "Debe ser entero"
    setErrors(e)
    return Object.keys(e).length === 0 && v002 !== null && v011 !== null
  }

  function handleCalculate() {
    if (!validate()) return
    const v002 = parseCurrencyInput(c002)!
    const v011 = parseCurrencyInput(c011)!
    setResult(calculateSegundaJulioProporcional({
      concepto002: v002, concepto011: v011, diasLaborados: parseInt(dias, 10),
    }))
  }

  function handleClear() {
    setC002(""); setC011(""); setDias(""); setErrors({}); setResult(null); setSelectedCategory(null)
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Segunda de Julio Proporcional</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.25rem" }}>Para categorias 08 y 02 con periodo menor a un ano.</p>
      <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1.5rem" }}>La aplicacion fuente usa base anual de 360 dias.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" value={c002} onChange={setC002} error={errors.c002} />
        <CurrencyField label="Concepto 011" value={c011} onChange={setC011} error={errors.c011} />
        <div>
          <Input id="dias" label="Dias laborados" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} placeholder="180" inputMode="numeric" style={{ borderColor: errors.dias ? "var(--error)" : undefined }} />
          {errors.dias && <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{errors.dias}</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base", value: result.base },
            { label: "Importe completo (360 dias)", value: result.importeCompleto },
            { label: "Proporcion", value: result.proporcion * 100 },
            { label: "Importe proporcional", value: result.resultado, highlight: true },
          ]} />
          <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.875rem" }}>
            Cobraras aproximadamente <strong>{formatCurrency(result.resultado)}</strong> mas tu quincena.
          </div>
          <FormulaExplanation steps={["Base = 002 + 011", "Completo = (Base / 15) x 46", "Proporcion = Dias / 360", "Resultado = Completo x Proporcion"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
