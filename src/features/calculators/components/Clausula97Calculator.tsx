"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { CurrencyField } from "./CurrencyField"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateClausula97 } from "../lib/clausula97"
import { parseCurrencyInput, formatCurrency } from "../lib/money"

const options = [
  { key: "unMes" as const, label: "1 mes", quincenas: 2 },
  { key: "dosMeses" as const, label: "2 meses", quincenas: 4 },
  { key: "tresMeses" as const, label: "3 meses", quincenas: 6 },
  { key: "cuatroMeses" as const, label: "4 meses", quincenas: 8 },
]

export function Clausula97Calculator() {
  const [c002, setC002] = useState("")
  const [c011, setC011] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateClausula97> | null>(null)

  function validate(): boolean {
    const e: Record<string, string> = {}
    const v002 = parseCurrencyInput(c002)
    const v011 = parseCurrencyInput(c011)
    if (v002 === null) e.c002 = "Ingrese un valor valido"
    if (v011 === null) e.c011 = "Ingrese un valor valido"
    setErrors(e)
    return Object.keys(e).length === 0 && v002 !== null && v011 !== null
  }

  function handleCalculate() {
    if (!validate()) return
    setResult(calculateClausula97({ concepto002: parseCurrencyInput(c002)!, concepto011: parseCurrencyInput(c011)! }))
  }

  function handleClear() {
    setC002(""); setC011(""); setErrors({}); setResult(null)
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Clausula 97</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Adelanto de una a cuatro quincenas.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", maxWidth: "400px" }}>
        <CurrencyField label="Concepto 002" value={c002} onChange={setC002} error={errors.c002} />
        <CurrencyField label="Concepto 011" value={c011} onChange={setC011} error={errors.c011} />
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Base quincenal" rows={[{ label: "Base", value: result.baseQuincenal, highlight: true }]} />
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
          <FormulaExplanation steps={["Base quincenal = 002 + 011", "1 mes = Base x 2", "2 meses = Base x 4", "3 meses = Base x 6", "4 meses = Base x 8"]} />
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
