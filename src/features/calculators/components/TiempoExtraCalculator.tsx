"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Select, Input } from "@/shared/components/ui/Input"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { calculateTiempoExtra } from "../lib/tiempoExtra"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { calcularConcepto011, calcularConcepto022, parseSeniorityYears } from "../lib/conceptos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { JornadaHoras, TiempoExtraInput, PrestamoCategoriaRecord } from "../lib/types"

const JORNADAS = [
  { value: "6.5", label: "6.5 horas" },
  { value: "8", label: "8 horas" },
  { value: "12", label: "12 horas" },
]

interface Props {
  initialCategoria?: string | null
  initialAntiguedad?: string | null
}

export function TiempoExtraCalculator({ initialCategoria, initialAntiguedad }: Props) {
  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const raw = prestamosRaw as Record<string, unknown>[]
    const records = raw.map(mapJsonToPrestamoRecord)
    const norm = initialCategoria.toLowerCase().trim()
    return records.find((r) => r.categoria.toLowerCase().includes(norm)) ?? null
  }, [initialCategoria])

  const initialC002 = initialMatch?.sueldoQuincenal ? formatCurrency(initialMatch.sueldoQuincenal) : ""
  const [fields, setFields] = useState({
    c002: initialC002, c020: "", adicional1: "", adicional2: "", c050: "",
    jornada: "8", horasExtra: "",
  })
  const [antiguedad, setAntiguedad] = useState(initialAntiguedad ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateTiempoExtra> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )
  const [jsonC011, setJsonC011] = useState<number | null>(
    () => initialMatch?.concepto011 ?? null
  )

  const c002Num = parseCurrencyInput(fields.c002)
  const c011Calculated = c002Num !== null ? calcularConcepto011(c002Num) : null
  const antiguedadYears = parseSeniorityYears(antiguedad)
  const c022 = c002Num !== null && antiguedadYears > 0 ? calcularConcepto022(c002Num, antiguedadYears) : 0

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    if (record.sueldoQuincenal) setField("c002", formatCurrency(record.sueldoQuincenal))
    setJsonC011(record.concepto011 ?? null)
  }

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    const v = (k: string) => parseCurrencyInput(fields[k as keyof typeof fields])
    const v002 = v("c002"), v020 = v("c020")
    const vAd1 = v("adicional1"), vAd2 = v("adicional2"), v050 = v("c050")
    const vJ = parseFloat(fields.jornada)
    const vH = parseFloat(fields.horasExtra)

    if (v002 === null) e.c002 = "Valor invalido"
    if (v020 === null) e.c020 = "Valor invalido"
    if (vAd1 === null) e.adicional1 = "Valor invalido"
    if (vAd2 === null) e.adicional2 = "Valor invalido"
    if (v050 === null) e.c050 = "Valor invalido"
    if (vJ !== 6.5 && vJ !== 8 && vJ !== 12) e.jornada = "Seleccione una jornada"
    if (!fields.horasExtra || isNaN(vH) || vH <= 0) e.horasExtra = "Debe ser > 0"

    setErrors(e)
    return Object.keys(e).length === 0 && v002 !== null && v020 !== null &&
      vAd1 !== null && vAd2 !== null && v050 !== null && vH > 0
  }

  function handleCalculate() {
    if (!validate()) return
    const g = (k: string) => parseCurrencyInput(fields[k as keyof typeof fields])!
    const input: TiempoExtraInput = {
      concepto002: g("c002"),
      concepto011: c011Calculated ?? 0,
      concepto020: g("c020"),
      conceptoAdicional1: g("adicional1") + c022,
      conceptoAdicional2: g("adicional2"),
      concepto050: g("c050"),
      jornada: parseFloat(fields.jornada) as JornadaHoras,
      horasExtra: parseFloat(fields.horasExtra),
    }
    setResult(calculateTiempoExtra(input))
  }

  function handleClear() {
    setFields({ c002: "", c020: "", adicional1: "", adicional2: "", c050: "", jornada: "8", horasExtra: "" })
    setAntiguedad(initialAntiguedad ?? ""); setErrors({}); setResult(null); setSelectedCategory(null); setJsonC011(null)
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Tiempo Extra</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>Calcula el pago de horas extraordinarias.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" value={fields.c002} onChange={(v) => { setField("c002", v); if (!v) setResult(null) }} error={errors.c002} />
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
        <CurrencyField label="Concepto 020" value={fields.c020} onChange={(v) => { setField("c020", v); if (!v) setResult(null) }} error={errors.c020} />
        {c022 > 0 && (
          <div>
            <Input label="Concepto 022 (calculado por antigüedad)" value={formatCurrency(c022)} readOnly />
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Se incluirá automáticamente en la suma de conceptos</p>
          </div>
        )}
        <CurrencyField label="Adicional (023/063)" description="Otros conceptos si aplican." value={fields.adicional1} onChange={(v) => { setField("adicional1", v); if (!v) setResult(null) }} error={errors.adicional1} />
        <CurrencyField label="Adicional 2 (063)" description="Cero si no aplica." value={fields.adicional2} onChange={(v) => { setField("adicional2", v); if (!v) setResult(null) }} error={errors.adicional2} />
        <CurrencyField label="Concepto 050" value={fields.c050} onChange={(v) => { setField("c050", v); if (!v) setResult(null) }} error={errors.c050} />
        <CurrencyField label="Antigüedad (años)" value={antiguedad} onChange={(v) => { setAntiguedad(v); if (!v) setResult(null) }} />
        <Select id="jornada" label="Jornada" value={fields.jornada} onChange={(e) => setField("jornada", e.target.value)}>
          {JORNADAS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
        </Select>
        <CurrencyField label="Horas extra" value={fields.horasExtra} onChange={(v) => { setField("horasExtra", v); if (!v) setResult(null) }} error={errors.horasExtra} />
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Button onClick={handleCalculate}><Calculator size={16} /> Calcular</Button>
        <Button variant="secondary" onClick={handleClear}><RotateCcw size={16} /> Limpiar</Button>
      </div>
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ResultCard title="Resultado" rows={[
            { label: "Suma conceptos (inc. 022)", value: result.sumaConceptos },
            { label: "Horas ordinarias", value: result.horasOrdinariasPeriodo },
            { label: "Valor hora", value: result.valorHora },
            { label: "Factor", value: result.factor },
            { label: "Horas extra", value: result.horasExtra },
            { label: "Pago estimado", value: result.pago, highlight: true },
          ]} />
          <FormulaExplanation steps={["Suma = 002+011+020+022+Ad1+Ad2+050", "011 = 002 × 0.8215", "022 según antigüedad y Cláusula 63 Bis inciso c", "Horas ordinarias = Jornada x 15", "Valor hora = Suma / Horas ordinarias", "Pago = Valor hora x 2 x Horas extra"]} />
          <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            <strong>Nota:</strong> Esta plataforma usa la formula corregida (valor hora x 2 x horas extra). La aplicacion de referencia anulaba las horas.
          </div>
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
