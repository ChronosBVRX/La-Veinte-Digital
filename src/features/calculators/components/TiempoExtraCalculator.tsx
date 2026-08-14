"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import Link from "next/link"
import { ArrowLeft, Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Select, Input } from "@/shared/components/ui/Input"
import { CurrencyField } from "./CurrencyField"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import {
  calculateTiempoExtra,
  validateHorasSemana,
  validateHorasExtraQuincena,
  MAX_HORAS_SEMANALES,
  MAX_HORAS_QUINCENALES,
} from "../lib/tiempoExtra"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields, formatSuggestedValue } from "../hooks/usePrefillFields"
import type { CalculatorPrefillFields } from "@/shared/contracts/calculator-prefill"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { JornadaHoras, TiempoExtraInput, TiempoExtraExceptionType, PrestamoCategoriaRecord } from "../lib/types"

const JORNADAS = [
  { value: "6", label: "6 horas" },
  { value: "6.5", label: "6.5 horas" },
  { value: "8", label: "8 horas" },
  { value: "12", label: "12 horas" },
]

const EXCEPCIONES: { value: TiempoExtraExceptionType; label: string }[] = [
  { value: null, label: "Sin excepción documentada" },
  { value: "clausula_100_cct", label: "Cláusula 100 del CCT" },
  { value: "art_24_rit", label: "Art. 24 del RIT" },
  { value: "manual_authorization", label: "Autorización manual documentada" },
]

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002" | "c011" | "c020" | "adicional1" | "adicional2" | "c050" | "jornada"

export function TiempoExtraCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("tiempo-extra", targetDate)

  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const raw = prestamosRaw as Record<string, unknown>[]
    const records = raw.map(mapJsonToPrestamoRecord)
    const norm = initialCategoria.toLowerCase().trim()
    return records.find((r) => r.categoria.toLowerCase().includes(norm)) ?? null
  }, [initialCategoria])

  const [fields, setFields] = useState({
    c002: initialMatch?.sueldoQuincenal ? formatCurrency(initialMatch.sueldoQuincenal) : "",
    c011: initialMatch?.concepto011 !== undefined ? formatCurrency(initialMatch.concepto011) : "",
    c020: "", adicional1: "", adicional2: "", c050: "",
    jornada: "8",
    horasExtra: "",
    horasSemana: "",
  })
  const [exceptionType, setExceptionType] = useState<TiempoExtraExceptionType>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<ReturnType<typeof calculateTiempoExtra> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )

  const setField = useCallback((key: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (key !== "jornada" && !value) { setResult(null); setWarning(null) }
  }, [])

  const fieldMap = useMemo<Record<FieldKey, keyof CalculatorPrefillFields>>(() => ({
    c002: "concepto002",
    c011: "concepto011",
    c020: "concepto020",
    adicional1: "concepto023",
    adicional2: "concepto063",
    c050: "concepto050",
    jornada: "workdayHours",
  }), [])

  const prefillFields = usePrefillFields({
    fields,
    setField,
    fieldMap,
    data: prefill.data,
    formatValue: useCallback(
      (key: keyof CalculatorPrefillFields, value: string | number) =>
        key === "workdayHours" ? String(value) : formatSuggestedValue(value),
      [],
    ),
  })

  const handleCurrencyChange = useCallback((key: keyof typeof fields) => (value: string) => {
    prefillFields.markDirty(key)
    setField(key, value)
  }, [prefillFields.markDirty, setField])

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    prefillFields.markDirty("c011")
    prefillFields.markDirty("c020")
    prefillFields.markDirty("adicional1")
    prefillFields.markDirty("adicional2")
    prefillFields.markDirty("c050")
    if (record.sueldoQuincenal) setField("c002", formatCurrency(record.sueldoQuincenal))
    if (record.concepto011 !== undefined) setField("c011", formatCurrency(record.concepto011))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    const v = (k: keyof typeof fields) => parseCurrencyInput(fields[k])
    const optional = (k: keyof typeof fields, errKey: string): number => {
      if (fields[k].trim() === "") return 0
      const val = v(k)
      if (val === null) e[errKey] = "Importe inválido (0 si no aplica)"
      return val ?? 0
    }

    const v002 = v("c002")
    const vJ = parseFloat(fields.jornada)
    const vH = parseFloat(fields.horasExtra)
    const vSemana = fields.horasSemana.trim() === "" ? undefined : parseFloat(fields.horasSemana)

    if (v002 === null) e.c002 = "Importe inválido"
    optional("c011", "c011")
    optional("c020", "c020")
    optional("adicional1", "adicional1")
    optional("adicional2", "adicional2")
    optional("c050", "c050")
    if (vJ !== 6 && vJ !== 6.5 && vJ !== 8 && vJ !== 12) e.jornada = "Seleccione una jornada"
    if (!fields.horasExtra || isNaN(vH)) e.horasExtra = "Ingrese las horas extra"
    else {
      const quincena = validateHorasExtraQuincena(vH, exceptionType)
      if (!quincena.valid) e.horasExtra = quincena.error ?? "Horas inválidas"
    }
    if (vSemana !== undefined && !isNaN(vSemana)) {
      const sem = validateHorasSemana(vSemana)
      if (!sem.valid) e.horasSemana = sem.error ?? "Horas semanales inválidas"
    }

    setErrors(e)
    setWarning(null)
    const vHQuincena = validateHorasExtraQuincena(vH, exceptionType)
    if (vHQuincena.valid && vHQuincena.warning) setWarning(vHQuincena.warning)

    return Object.keys(e).length === 0 && v002 !== null && vH > 0
  }

  function handleCalculate() {
    if (!validate()) return
    const g = (k: keyof typeof fields) => parseCurrencyInput(fields[k]) ?? 0

    // Base normativa del concepto 037 (matriz de repercusiones): 002, 011, 020,
    // 023, 063, 050 integran la base. El motor de proyección además integra
    // 02, 012, 013, 057, 058, 061 según la Norma 1000-001-020.
    const conceptos = [
      { code: "002", amount: g("c002") },
      { code: "011", amount: g("c011") },
      { code: "020", amount: g("c020") },
      { code: "023", amount: g("adicional1") },
      { code: "063", amount: g("adicional2") },
      { code: "050", amount: g("c050") },
    ]
    const baseAmount = conceptos.reduce((s, c) => s + c.amount, 0)

    const input: TiempoExtraInput = {
      concepto002: g("c002"),
      concepto011: g("c011"),
      concepto020: g("c020"),
      conceptoAdicional1: g("adicional1"),
      conceptoAdicional2: g("adicional2"),
      concepto050: g("c050"),
      jornada: parseFloat(fields.jornada) as JornadaHoras,
      horasExtra: parseFloat(fields.horasExtra),
      horasSemana: fields.horasSemana.trim() === "" ? undefined : parseFloat(fields.horasSemana),
      exceptionType,
      baseNormativa: { conceptos, baseAmount },
    }
    setResult(calculateTiempoExtra(input))
  }

  function handleClear() {
    setFields({ c002: "", c011: "", c020: "", adicional1: "", adicional2: "", c050: "", jornada: "8", horasExtra: "", horasSemana: "" })
    setExceptionType(null)
    setErrors({}); setResult(null); setWarning(null); setSelectedCategory(null)
    prefillFields.clearDirty()
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1.5rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Tiempo Extra</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Calcula el pago estimado de horas extraordinarias. Límite ordinario: {MAX_HORAS_SEMANALES} h a la semana y {MAX_HORAS_QUINCENALES} h a la quincena
        (procedimiento 1A74-003-031).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
        <CategorySelector initialCategory={selectedCategory ?? initialCategoria} onSelect={handleCategorySelect} />
        <CurrencyField label="Concepto 002" value={fields.c002} onChange={handleCurrencyChange("c002")} error={errors.c002} />
        <CurrencyField label="Concepto 011" value={fields.c011} onChange={handleCurrencyChange("c011")} error={errors.c011} />
        <CurrencyField label="Concepto 020" value={fields.c020} onChange={handleCurrencyChange("c020")} error={errors.c020} />
        <CurrencyField label="Concepto adicional 1 (023 o 063)" description="Copia el concepto que recibas; cero si no aplica." value={fields.adicional1} onChange={handleCurrencyChange("adicional1")} error={errors.adicional1} />
        <CurrencyField label="Concepto adicional 2 (023 o 063)" description="Copia el concepto que recibas; cero si no aplica." value={fields.adicional2} onChange={handleCurrencyChange("adicional2")} error={errors.adicional2} />
        <CurrencyField label="Concepto 050" value={fields.c050} onChange={handleCurrencyChange("c050")} error={errors.c050} />
        <Select id="jornada" label="Jornada" value={fields.jornada} onChange={(e) => { setField("jornada", e.target.value); prefillFields.markDirty("jornada") }}>
          {JORNADAS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
        </Select>
        <div>
          <Input
            id="horasExtra"
            label={`Horas extra en la quincena (máx. ordinario ${MAX_HORAS_QUINCENALES})`}
            value={fields.horasExtra}
            onChange={(e) => { setField("horasExtra", e.target.value); prefillFields.markDirty("horasExtra") }}
            placeholder="Ej: 5"
            inputMode="numeric"
            autoComplete="off"
            style={{ borderColor: errors.horasExtra ? "var(--error)" : undefined }}
          />
          {errors.horasExtra && (
            <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{errors.horasExtra}</p>
          )}
        </div>
        <div>
          <Input
            id="horasSemana"
            label={`Horas extra en la semana (máx. ordinario ${MAX_HORAS_SEMANALES}) — opcional`}
            value={fields.horasSemana}
            onChange={(e) => { setField("horasSemana", e.target.value); prefillFields.markDirty("horasSemana") }}
            placeholder="Ej: 6"
            inputMode="numeric"
            autoComplete="off"
            style={{ borderColor: errors.horasSemana ? "var(--error)" : undefined }}
          />
          {errors.horasSemana && (
            <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{errors.horasSemana}</p>
          )}
        </div>
        <Select
          id="exceptionType"
          label="Excepción documentada (solo si supera el límite ordinario)"
          value={exceptionType ?? ""}
          onChange={(e) => setExceptionType((e.target.value as TiempoExtraExceptionType) || null)}
        >
          {EXCEPCIONES.map((x) => <option key={x.value ?? "none"} value={x.value ?? ""}>{x.label}</option>)}
        </Select>
      </div>
      {warning && (
        <div style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          {warning}
        </div>
      )}
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
            { label: result.baseNormativaUsada ? "Base normativa 037 (repercusiones)" : "Suma de conceptos (manual)", value: result.sumaConceptos },
            ...(result.baseNormativaUsada && result.conceptosIntegrados.length > 0
              ? result.conceptosIntegrados.map((c) => ({ label: `  · Concepto ${c.code}`, value: c.amount }))
              : []),
            { label: "Horas ordinarias del periodo (jornada × 15)", value: result.horasOrdinariasPeriodo, format: "number" as const },
            { label: "Valor de la hora ordinaria", value: result.valorHora },
            { label: "Factor", value: result.factor, format: "number" as const },
            { label: "Horas extra", value: result.horasExtra, format: "number" as const },
            { label: "Pago estimado", value: result.pago, highlight: true },
          ]} />
          <FormulaExplanation steps={[
            "Base = 002 + 011 + 020 + 023 + 063 + 050 (037), según matriz de repercusiones",
            "El motor de proyección integra además 02, 012, 013, 057, 058, 061 (Norma 1000-001-020)",
            "Horas ordinarias del periodo = Jornada × 15",
            "Valor hora = Base ÷ Horas ordinarias",
            "Pago = Valor hora × 2 × Horas extra",
            "Límites ordinarios: 9 h/semana y 20 h/quincena (proc. 1A74-003-031)",
          ]} />
          <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            <strong>Nota:</strong> Esta plataforma usa la fórmula corregida (valor hora × 2 × horas extra). La aplicación de referencia anulaba el efecto de las horas.
          </div>
          <CalculatorDisclaimer />
        </div>
      )}
    </div>
  )
}
