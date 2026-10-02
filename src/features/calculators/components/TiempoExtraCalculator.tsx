"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import { Calculator, RotateCcw, Sparkles, AlertTriangle } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Select } from "@/shared/components/ui/Input"
import { FriendlyCalculatorIntro } from "./FriendlyCalculatorIntro"
import { FriendlyField } from "./FriendlyField"
import { TarjetonDataNotice } from "./TarjetonDataNotice"
import { CalculationResultHero } from "./CalculationResultHero"
import { FriendlyBreakdown } from "./FriendlyBreakdown"
import { WorkerExplanation } from "./WorkerExplanation"
import { TechnicalDetails } from "./TechnicalDetails"
import { CalculatorNotice } from "./CalculatorNotice"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
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
  { value: "6", label: "6 horas diarias (jornada especial)" },
  { value: "6.5", label: "6.5 horas diarias (jornada nocturna)" },
  { value: "8", label: "8 horas diarias (jornada diurna normal)" },
  { value: "12", label: "12 horas diarias (jornada acumulada)" },
]

const EXCEPCIONES: { value: TiempoExtraExceptionType; label: string; sub: string }[] = [
  {
    value: null,
    label: "Sin autorización especial",
    sub: "Límite normal ordinario de 20 horas por quincena",
  },
  {
    value: "clausula_100_cct",
    label: "Situación extraordinaria urgente",
    sub: "Autorizada conforme a la Cláusula 100 del CCT",
  },
  {
    value: "art_24_rit",
    label: "Necesidad de servicio institucional",
    sub: "Autorizada conforme al Artículo 24 del Reglamento Interior de Trabajo",
  },
  {
    value: "manual_authorization",
    label: "Cuento con oficio o autorización manual",
    sub: "Aprobada por la jefatura de servicio o delegación",
  },
]

interface Props {
  initialCategoria?: string | null
}

type FieldKey =
  | "c002"
  | "c011"
  | "c020"
  | "c014"
  | "adicional1"
  | "adicional2"
  | "c054"
  | "c050"
  | "c022"
  | "jornada"

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

  const initialC054 = useMemo(() => {
    if (!initialCategoria || !initialMatch?.sueldoQuincenal) return ""
    if (initialCategoria.toUpperCase().includes("RADIOLOG")) {
      const base = initialMatch.sueldoQuincenal + (initialMatch.concepto011 || 0)
      return formatCurrency(Math.floor(base * 0.20 * 100) / 100)
    }
    return ""
  }, [initialCategoria, initialMatch])

  const [fields, setFields] = useState({
    c002: initialMatch?.sueldoQuincenal ? formatCurrency(initialMatch.sueldoQuincenal) : "",
    c011: initialMatch?.concepto011 !== undefined ? formatCurrency(initialMatch.concepto011) : "",
    c020: formatCurrency(250),
    c014: "",
    adicional1: "",
    adicional2: "",
    c054: initialC054,
    c050: formatCurrency(200),
    c022: "",
    jornada: "8",
    horasExtra: "",
    horasSemana1: "",
    horasSemana2: "",
    horasSemana: "",
  })
  const [integrarAntiguedad, setIntegrarAntiguedad] = useState(false)
  const [exceptionType, setExceptionType] = useState<TiempoExtraExceptionType>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<ReturnType<typeof calculateTiempoExtra> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )
  const [isEditingSalary, setIsEditingSalary] = useState(() => !initialMatch?.sueldoQuincenal)

  const setField = useCallback((key: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (key !== "jornada" && !value) {
      setResult(null)
      setWarning(null)
    }
  }, [])

  const fieldMap = useMemo<Record<FieldKey, keyof CalculatorPrefillFields>>(() => ({
    c002: "concepto002",
    c011: "concepto011",
    c020: "concepto020",
    c014: "concepto014",
    adicional1: "concepto023",
    adicional2: "concepto063",
    c054: "concepto054",
    c050: "concepto050",
    c022: "concepto022",
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
      []
    ),
  })

  const handleCurrencyChange = useCallback((key: keyof typeof fields) => (value: string) => {
    prefillFields.markDirty(key)
    setField(key, value)
  }, [prefillFields, setField])

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    prefillFields.markDirty("c011")
    prefillFields.markDirty("c020")
    prefillFields.markDirty("c014")
    prefillFields.markDirty("adicional1")
    prefillFields.markDirty("adicional2")
    prefillFields.markDirty("c054")
    prefillFields.markDirty("c050")
    prefillFields.markDirty("c022")
    if (record.sueldoQuincenal) setField("c002", formatCurrency(record.sueldoQuincenal))
    if (record.concepto011 !== undefined) setField("c011", formatCurrency(record.concepto011))
    setField("c020", formatCurrency(250))
    setField("c050", formatCurrency(200))
    if (record.categoria.toUpperCase().includes("RADIOLOG") && record.sueldoQuincenal) {
      const base = record.sueldoQuincenal + (record.concepto011 || 0)
      const c054Val = Math.floor(base * 0.20 * 100) / 100
      setField("c054", formatCurrency(c054Val))
    }
  }

  const vSem1 = fields.horasSemana1.trim() === "" ? undefined : parseFloat(fields.horasSemana1)
  const vSem2 = fields.horasSemana2.trim() === "" ? undefined : parseFloat(fields.horasSemana2)
  const parsedVH = parseFloat(fields.horasExtra)
  const vH = !isNaN(parsedVH) && parsedVH > 0
    ? parsedVH
    : ((vSem1 ?? 0) + (vSem2 ?? 0))
  const isOverQuincenaLimit = !isNaN(vH) && vH > MAX_HORAS_QUINCENALES

  function validate(): boolean {
    const e: Record<string, string> = {}
    const v = (k: keyof typeof fields) => parseCurrencyInput(fields[k])
    const optional = (k: keyof typeof fields, errKey: string): number => {
      if (fields[k].trim() === "") return 0
      const val = v(k)
      if (val === null) e[errKey] = "Escribe una cantidad válida (escribe 0 si no aplica)"
      return val ?? 0
    }

    const v002 = v("c002")
    const vJ = parseFloat(fields.jornada)
    const vSemana = fields.horasSemana.trim() === "" ? undefined : parseFloat(fields.horasSemana)

    if (v002 === null) e.c002 = "Escribe tu sueldo quincenal válido, por ejemplo $8,500"
    optional("c011", "c011")
    optional("c020", "c020")
    optional("c014", "c014")
    optional("adicional1", "adicional1")
    optional("adicional2", "adicional2")
    optional("c054", "c054")
    optional("c050", "c050")
    optional("c022", "c022")

    if (vJ !== 6 && vJ !== 6.5 && vJ !== 8 && vJ !== 12) e.jornada = "Selecciona tu jornada diaria"

    if (vSem1 !== undefined && (isNaN(vSem1) || vSem1 < 0)) {
      e.horasSemana1 = "Escribe un número válido de horas"
    }
    if (vSem2 !== undefined && (isNaN(vSem2) || vSem2 < 0)) {
      e.horasSemana2 = "Escribe un número válido de horas"
    }

    if (!vH || isNaN(vH) || vH <= 0) {
      e.horasExtra = "Escribe el número de horas extra trabajadas (por ejemplo: 5)"
    } else {
      const quincena = validateHorasExtraQuincena(vH, exceptionType)
      if (!quincena.valid) {
        e.horasExtra =
          quincena.error ??
          `El límite ordinario es de ${MAX_HORAS_QUINCENALES} horas en la quincena. Selecciona una autorización especial si aplica.`
      }
    }

    if (vSemana !== undefined && !isNaN(vSemana)) {
      const sem = validateHorasSemana(vSemana)
      if (!sem.valid) {
        e.horasSemana =
          sem.error ?? `El límite ordinario es de ${MAX_HORAS_SEMANALES} horas en una semana.`
      }
    }

    setErrors(e)
    setWarning(null)
    const vHQuincena = validateHorasExtraQuincena(vH, exceptionType)
    if (vHQuincena.valid && vHQuincena.warning) setWarning(vHQuincena.warning)

    return Object.keys(e).length === 0 && v002 !== null && vH > 0
  }

  function handleCalculate() {
    if (!validate()) {
      if (parseCurrencyInput(fields.c002) === null) {
        setIsEditingSalary(true)
      }
      return
    }

    const g = (k: keyof typeof fields) => parseCurrencyInput(fields[k]) ?? 0

    const conceptos = [
      { code: "002", amount: g("c002") },
      { code: "011", amount: g("c011") },
      { code: "020", amount: g("c020") },
      { code: "014", amount: g("c014") },
      { code: "023", amount: g("adicional1") },
      { code: "063", amount: g("adicional2") },
      { code: "054", amount: g("c054") },
      { code: "050", amount: g("c050") },
      ...(integrarAntiguedad && g("c022") > 0 ? [{ code: "022", amount: g("c022") }] : []),
    ].filter((c) => c.amount > 0)
    const baseAmount = conceptos.reduce((s, c) => s + c.amount, 0)

    const input: TiempoExtraInput = {
      concepto002: g("c002"),
      concepto011: g("c011"),
      concepto020: g("c020"),
      concepto014: g("c014"),
      concepto022: g("c022"),
      integrarAntiguedad,
      conceptoAdicional1: g("adicional1"),
      conceptoAdicional2: g("adicional2"),
      concepto054: g("c054"),
      concepto050: g("c050"),
      jornada: parseFloat(fields.jornada) as JornadaHoras,
      horasExtra: vH,
      horasSemana1: vSem1,
      horasSemana2: vSem2,
      horasSemana: fields.horasSemana.trim() === "" ? undefined : parseFloat(fields.horasSemana),
      exceptionType,
      baseNormativa: { conceptos, baseAmount },
    }

    setResult(calculateTiempoExtra(input))
  }

  function handleClear() {
    setFields({
      c002: "",
      c011: "",
      c020: formatCurrency(250),
      c014: "",
      adicional1: "",
      adicional2: "",
      c054: "",
      c050: formatCurrency(200),
      c022: "",
      jornada: "8",
      horasExtra: "",
      horasSemana1: "",
      horasSemana2: "",
      horasSemana: "",
    })
    setIntegrarAntiguedad(false)
    setExceptionType(null)
    setErrors({})
    setResult(null)
    setWarning(null)
    setSelectedCategory(null)
    prefillFields.clearDirty()
    setIsEditingSalary(true)
  }

  const hasSalaryData = Boolean(fields.c002 && fields.c002.trim() !== "")

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", paddingBottom: "2rem" }}>
      <FriendlyCalculatorIntro
        title="Calcula cuánto te pagarían por tus horas extra"
        description="Usaremos tus horas trabajadas y tu sueldo para calcular el pago por tu tiempo extraordinario."
        badge="Cláusula 33 CCT"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />

        {/* 1. Datos principales que el trabajador sí conoce */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
            ¿Cuántas horas extra vas a registrar?
          </span>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <FriendlyField
              id="horasSemana1"
              label="Horas Semana 1"
              technicalLabel="Límite: 9 h al doble"
              description="Horas de la 1ª semana"
              value={fields.horasSemana1}
              onChange={(val) => {
                setField("horasSemana1", val)
                prefillFields.markDirty("horasSemana1")
                const s1 = parseFloat(val) || 0
                const s2 = parseFloat(fields.horasSemana2) || 0
                if (val !== "" || fields.horasSemana2 !== "") {
                  setField("horasExtra", String(s1 + s2))
                }
              }}
              type="number"
              error={errors.horasSemana1}
              placeholder="Ej: 9"
            />

            <FriendlyField
              id="horasSemana2"
              label="Horas Semana 2"
              technicalLabel="Límite: 9 h al doble"
              description="Horas de la 2ª semana"
              value={fields.horasSemana2}
              onChange={(val) => {
                setField("horasSemana2", val)
                prefillFields.markDirty("horasSemana2")
                const s1 = parseFloat(fields.horasSemana1) || 0
                const s2 = parseFloat(val) || 0
                if (val !== "" || fields.horasSemana1 !== "") {
                  setField("horasExtra", String(s1 + s2))
                }
              }}
              type="number"
              error={errors.horasSemana2}
              placeholder="Ej: 9"
            />
          </div>

          <FriendlyField
            id="horasExtra"
            label="Horas extra trabajadas en la quincena"
            technicalLabel="Concepto 037 (Tiempo Extraordinario)"
            description={`Límite ordinario normal: hasta ${MAX_HORAS_QUINCENALES} horas por quincena (hasta 9 h/semana al doble).`}
            value={fields.horasExtra}
            onChange={(val) => {
              setField("horasExtra", val)
              prefillFields.markDirty("horasExtra")
            }}
            type="number"
            error={errors.horasExtra}
            placeholder="Ej: 18"
          />

          <div>
            <Select
              id="jornada"
              label="Tu jornada de trabajo diaria"
              value={fields.jornada}
              onChange={(e) => {
                setField("jornada", e.target.value)
                prefillFields.markDirty("jornada")
              }}
            >
              {JORNADAS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </Select>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
              Determina cuántas horas ordinarias comprende tu periodo quincenal.
            </p>
          </div>
        </div>

        {/* 2. Sección humana para límites excedidos */}
        {isOverQuincenaLimit && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.06)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-lg)",
              padding: "1.125rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
              <strong style={{ fontSize: "0.875rem", color: "var(--fg)" }}>
                Necesitamos revisar algo
              </strong>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "var(--fg)", margin: 0, lineHeight: 1.4 }}>
              Las {fields.horasExtra} horas que indicaste superan el límite ordinario normal de {MAX_HORAS_QUINCENALES} horas por quincena. Si fueron autorizadas bajo alguna situación especial, seleccionala:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {EXCEPCIONES.map((ex) => {
                const isSelected = exceptionType === ex.value
                return (
                  <button
                    key={String(ex.value)}
                    type="button"
                    onClick={() => setExceptionType(ex.value)}
                    style={{
                      textAlign: "left",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: isSelected ? "rgba(37, 99, 235, 0.06)" : "var(--card)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                      {ex.label}
                    </span>
                    <span style={{ display: "block", fontSize: "0.71875rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                      {ex.sub}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 3. Percepciones del tarjetón (con toggle progresivo) */}
        {hasSalaryData && !isEditingSalary ? (
          <TarjetonDataNotice
            items={[
              { label: "Sueldo quincenal", value: fields.c002, technicalCode: "Concepto 002" },
              { label: "Ayuda de renta", value: fields.c011 || "$0.00", technicalCode: "Concepto 011" },
              ...(fields.c054 && fields.c054 !== "$0.00" && fields.c054 !== "0"
                ? [{ label: "Emanaciones no médicas", value: fields.c054, technicalCode: "Concepto 054" }]
                : []),
              ...(fields.c020 && fields.c020 !== "$0.00" && fields.c020 !== "0"
                ? [{ label: "Ayuda de renta fija", value: fields.c020, technicalCode: "Concepto 020" }]
                : []),
              ...(fields.c050 && fields.c050 !== "$0.00" && fields.c050 !== "0"
                ? [{ label: "Ayuda para despensa", value: fields.c050, technicalCode: "Concepto 050" }]
                : []),
              ...(fields.c014 && fields.c014 !== "$0.00" && fields.c014 !== "0"
                ? [{ label: "Infecto no médico", value: fields.c014, technicalCode: "Concepto 014" }]
                : []),
              ...(fields.c022 && fields.c022 !== "$0.00" && fields.c022 !== "0"
                ? [{ label: "Antigüedad (Cl. 63 Bis c)", value: fields.c022, technicalCode: "Concepto 022" }]
                : []),
              { label: "Jornada seleccionada", value: `${fields.jornada} horas` },
            ]}
            sourceText="Usaremos automáticamente estos datos de tu nómina para calcular el valor de tu hora."
            isEditing={isEditingSalary}
            onToggleEditing={() => setIsEditingSalary(true)}
            hasSuggestions={prefillFields.hasSuggestions}
            onRestore={prefillFields.restore}
          />
        ) : (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)", display: "block" }}>
                  Conceptos que integran tu hora de trabajo
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Copia los conceptos de tu tarjetón o déjalos en 0 si no aplican.
                </span>
              </div>
              {hasSalaryData && (
                <button
                  type="button"
                  onClick={() => setIsEditingSalary(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "0.78125rem",
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Ocultar
                </button>
              )}
            </div>

            <CategorySelector
              initialCategory={selectedCategory ?? initialCategoria}
              onSelect={handleCategorySelect}
            />

            <FriendlyField
              id="c002"
              label="Sueldo quincenal"
              technicalLabel="Concepto 002"
              value={fields.c002}
              onChange={handleCurrencyChange("c002")}
              error={errors.c002}
              placeholder="Ej: $8,450.20"
            />

            <FriendlyField
              id="c011"
              label="Ayuda de renta"
              technicalLabel="Concepto 011"
              value={fields.c011}
              onChange={handleCurrencyChange("c011")}
              error={errors.c011}
              placeholder="Ej: $1,245.30"
            />

            <FriendlyField
              id="c020"
              label="Ayuda de renta fija (Cláusula 63 Bis, inciso a)"
              technicalLabel="Concepto 020 ($250.00 quincenales fijos)"
              value={fields.c020}
              onChange={handleCurrencyChange("c020")}
              error={errors.c020}
              placeholder="Ej: $250.00"
            />

            <FriendlyField
              id="c050"
              label="Ayuda para despensa (Cláusula 142 Bis)"
              technicalLabel="Concepto 050 ($200.00 quincenales para trabajadores de base)"
              value={fields.c050}
              onChange={handleCurrencyChange("c050")}
              error={errors.c050}
              placeholder="Ej: $200.00"
            />

            <FriendlyField
              id="c054"
              label="Emanaciones radiactivas no médicas"
              technicalLabel="Concepto 054 (Técnicos radiólogos y áreas expuestas)"
              value={fields.c054}
              onChange={handleCurrencyChange("c054")}
              error={errors.c054}
              placeholder="Ej: $1,434.48"
            />

            <FriendlyField
              id="c014"
              label="Infectocontagiosidad no médica"
              technicalLabel="Concepto 014 (10% sobre 002 + 011 para técnicos/auxiliares)"
              value={fields.c014}
              onChange={handleCurrencyChange("c014")}
              error={errors.c014}
              placeholder="Ej: $0.00"
            />

            <FriendlyField
              id="adicional1"
              label="Infectocontagiosidad médica"
              technicalLabel="Concepto 023 (personal médico)"
              value={fields.adicional1}
              onChange={handleCurrencyChange("adicional1")}
              error={errors.adicional1}
              placeholder="Ej: $0.00"
            />

            <FriendlyField
              id="adicional2"
              label="Emanaciones radiactivas médicas"
              technicalLabel="Concepto 063 (médicos radiólogos)"
              value={fields.adicional2}
              onChange={handleCurrencyChange("adicional2")}
              error={errors.adicional2}
              placeholder="Ej: $0.00"
            />

            <FriendlyField
              id="c022"
              label="Ayuda de renta por antigüedad (opcional)"
              technicalLabel="Concepto 022 (Cláusula 63 Bis, inciso c)"
              description="Ingresa el importe de tu tarjetón si deseas calcular o comparar el escenario con antigüedad integrada."
              value={fields.c022}
              onChange={handleCurrencyChange("c022")}
              error={errors.c022}
              placeholder="Ej: $1,972.41"
            />

            {parseCurrencyInput(fields.c022) !== null && (parseCurrencyInput(fields.c022) ?? 0) > 0 && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--fg)",
                  cursor: "pointer",
                  padding: "0.375rem 0.5rem",
                  background: "var(--accent)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <input
                  type="checkbox"
                  checked={integrarAntiguedad}
                  onChange={(e) => setIntegrarAntiguedad(e.target.checked)}
                />
                Integrar antigüedad (Concepto 022) a la base principal del cálculo
              </label>
            )}
          </div>
        )}

        {warning && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "0.75rem 1rem",
              fontSize: "0.8125rem",
              color: "var(--fg)",
            }}
          >
            {warning}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button onClick={handleCalculate} size="md">
            <Calculator size={16} /> Calcular pago de horas extra
          </Button>
          <Button variant="secondary" onClick={handleClear} size="md">
            <RotateCcw size={16} /> Limpiar
          </Button>
          {prefillFields.hasSuggestions && (
            <Button variant="ghost" onClick={prefillFields.restore} size="md">
              <Sparkles size={16} /> Restaurar valores sugeridos
            </Button>
          )}
        </div>
      </div>

      {!result && (
        <div
          style={{
            background: "var(--accent)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          Ingresa el número de horas trabajadas y pulsa «Calcular pago de horas extra» para conocer tu estimación.
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <CalculationResultHero
            badge="PAGO ESTIMADO"
            label={`Por tus ${result.horasExtra} horas extra recibirías aproximadamente:`}
            amount={result.pago}
            explanation={`Esto se suma a tu pago normal de la quincena. Cada hora ordinaria de tu jornada equivale aproximadamente a ${formatCurrency(result.valorHora)}.`}
            secondaryHighlight={{
              label: "Valor estimado por hora ordinaria",
              value: formatCurrency(result.valorHora),
            }}
          />

          {result.comparativaAntiguedad && (
            <div
              style={{
                background: "rgba(37, 99, 235, 0.04)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                  Impacto de Antigüedad (Concepto 022)
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "999px",
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  Cláusula 63 Bis c CCT
                </span>
              </div>

              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.45 }}>
                En el IMSS, la base contractual estricta de tiempo extra usa el tabulador más riesgos. No obstante, si tu centro de trabajo o reclamo liquida sobre <strong>Salario Quincenal Integrado</strong> con tu Concepto 022 ({formatCurrency(result.comparativaAntiguedad.monto022)}):
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                <div
                  style={{
                    background: "var(--card)",
                    padding: "0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: !result.comparativaAntiguedad.integradaEnPrincipal ? "2px solid var(--primary)" : "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                    Base Tabular Estándar {!result.comparativaAntiguedad.integradaEnPrincipal && "✓ (Activo)"}
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "var(--fg)", display: "block", marginTop: "0.25rem" }}>
                    {formatCurrency(result.comparativaAntiguedad.integradaEnPrincipal ? result.pago - result.comparativaAntiguedad.diferencia : result.pago)}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                    Hora ordinaria: {formatCurrency(result.comparativaAntiguedad.integradaEnPrincipal ? (result.sumaConceptos - result.comparativaAntiguedad.monto022) / result.horasOrdinariasPeriodo : result.valorHora)}
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--card)",
                    padding: "0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: result.comparativaAntiguedad.integradaEnPrincipal ? "2px solid var(--primary)" : "1px solid rgba(37, 99, 235, 0.3)",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", display: "block" }}>
                    Con Antigüedad Integrada {result.comparativaAntiguedad.integradaEnPrincipal && "✓ (Activo)"}
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "var(--primary)", display: "block", marginTop: "0.25rem" }}>
                    {formatCurrency(result.comparativaAntiguedad.integradaEnPrincipal ? result.pago : result.comparativaAntiguedad.pagoConAntiguedad)}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                    Hora ordinaria: {formatCurrency(result.comparativaAntiguedad.valorHoraConAntiguedad)} (+{formatCurrency(Math.abs(result.comparativaAntiguedad.diferencia))})
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
                💡 Esto explica por qué compañeros con 20 años de servicio (150 días en el Concepto 022) cobran una tarifa por hora superior a los $100.00/h aunque compartan la misma categoría y turno.
              </p>
            </div>
          )}

          {result.desglose && result.desglose.length > 0 && (
            <FriendlyBreakdown
              title="Desglose por factor de pago"
              items={result.desglose.map((d) => ({
                label: d.label,
                value: d.importe,
                technicalConcept: `${d.horas}h con factor ${d.factor}x`,
                description: `Equivale a ${d.horas} horas pagadas a factor ${d.factor}x sobre el valor hora ordinaria.`,
              }))}
            />
          )}

          <WorkerExplanation
            title="¿Cómo se pagan las horas extra en el IMSS?"
            points={[
              {
                title: "Horas dobles (factor 2x)",
                text: "Las primeras 9 horas extraordinarias trabajadas a la semana se pagan al doble de tu hora ordinaria.",
              },
              {
                title: "Horas triples (factor 3x)",
                text: "A partir de la décima hora extraordinaria en una misma semana, o en días de descanso semanal o festivo obligatorio, el pago se realiza al triple.",
              },
              {
                title: "Redondeo de minutos (Cláusula 33)",
                text: "Si laboraste fracciones de hora: menos de 30 minutos se paga como media hora; entre 30 y 60 minutos se paga como una hora completa.",
              },
              {
                title: "Fecha de pago",
                text: "Aparece registrado en tu tarjetón de percepciones bajo el Concepto 037 (Tiempo Extraordinario).",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver cómo se calculó y fundamento legal"
            subtitle="Procedimiento 1A74-003-031, repercusiones 037 y Cláusula 33"
          >
            <ResultCard
              title="Valores técnicos de nómina"
              rows={[
                {
                  label: result.baseNormativaUsada ? "Base normativa 037 (repercusiones)" : "Suma de conceptos base",
                  value: result.sumaConceptos,
                },
                ...(result.baseNormativaUsada && result.conceptosIntegrados.length > 0
                  ? result.conceptosIntegrados.map((c) => ({
                      label: `  · Concepto ${c.code}`,
                      value: c.amount,
                    }))
                  : []),
                {
                  label: "Horas ordinarias en la quincena (jornada × 15)",
                  value: result.horasOrdinariasPeriodo,
                  format: "number" as const,
                },
                { label: "Valor de la hora ordinaria", value: result.valorHora },
                { label: "Horas extra computadas", value: result.horasExtra, format: "number" as const },
                { label: "Pago total estimado (Concepto 037)", value: result.pago, highlight: true },
              ]}
            />

            <FormulaExplanation
              title="Fórmulas aplicables"
              steps={[
                "Base quincenal estándar = 002 + 011 + 020 + 050 + 054 (y en su caso 014, 023, 063) (matriz CCT pág. 26 / concepto 037)",
                "Base con antigüedad integrada = Base estándar + 022 (Cláusula 63 Bis c)",
                "Horas ordinarias quincenales = Jornada diaria × 15 días",
                "Valor hora ordinaria = Base quincenal ÷ Horas ordinarias",
                "Primeras 9 horas de cada semana = Valor hora × 2 (dobles)",
                "Excedente mayor a 9 horas por semana = Valor hora × 3 (triples)",
                "Descanso semanal o festivo laborado = Valor hora × 3",
                "Coincidencia de descanso obligatorio en descanso semanal = Valor hora × 4",
                "Redondeo Cláusula 33: < 30 min = 0.5 h; 30 a 60 min = 1.0 h",
              ]}
              fundamento="Procedimiento institucional 1A74-003-031, Cláusula 33 del CCT y Artículos 66 a 68 de la Ley Federal del Trabajo."
            />
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="Esta es una estimación basada en la jornada y horas capturadas. El pago final en tu tarjetón requiere la validación y firma de tu tarjeta o registro de asistencia por parte de tu delegación."
          />
        </div>
      )}
    </div>
  )
}
