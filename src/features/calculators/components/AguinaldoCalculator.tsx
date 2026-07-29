"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { CurrencyField } from "./CurrencyField"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateAguinaldo } from "../lib/aguinaldo"
import { parseCurrencyInput } from "../lib/money"

export function AguinaldoCalculator() {
  const [c002, setC002] = useState("")
  const [c011, setC011] = useState("")
  const [errors, setErrors] = useState<{ c002?: string; c011?: string }>({})
  const [result, setResult] = useState<ReturnType<typeof calculateAguinaldo> | null>(null)

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
    setC002(""); setC011(""); setErrors({}); setResult(null)
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Aguinaldo</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Calcula el aguinaldo estimado.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
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
