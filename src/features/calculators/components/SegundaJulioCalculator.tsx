"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { CurrencyField } from "./CurrencyField"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateSegundaJulio } from "../lib/segundaJulio"
import { parseCurrencyInput } from "../lib/money"

export function SegundaJulioCalculator() {
  const [c002, setC002] = useState("")
  const [c011, setC011] = useState("")
  const [errors, setErrors] = useState<{ c002?: string; c011?: string }>({})
  const [resultado, setResultado] = useState<number | null>(null)
  const [base, setBase] = useState(0)

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
    setBase(v002 + v011)
    setResultado(calculateSegundaJulio({ concepto002: v002, concepto011: v011 }))
  }

  function handleClear() {
    setC002(""); setC011(""); setErrors({}); setResultado(null); setBase(0)
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Segunda de Julio</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Calcula el pago anual de la prestacion segunda de julio.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <CurrencyField label="Concepto 002" value={c002} onChange={setC002} error={errors.c002} />
        <CurrencyField label="Concepto 011" value={c011} onChange={setC011} error={errors.c011} />
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {resultado !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Base", value: base },
            { label: "Segunda de julio", value: resultado, highlight: true },
          ]} />
          <FormulaExplanation steps={["Base = 002 + 011", "Segunda de julio = (Base / 15) x 46"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
