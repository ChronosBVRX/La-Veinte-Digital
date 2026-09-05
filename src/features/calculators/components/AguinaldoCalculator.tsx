"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import { Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
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
import { calculateAguinaldo } from "../lib/aguinaldo"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
}

type FieldKey = "c002" | "c011"

export function AguinaldoCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("aguinaldo", targetDate)

  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const raw = prestamosRaw as Record<string, unknown>[]
    const records = raw.map(mapJsonToPrestamoRecord)
    const norm = initialCategoria.toLowerCase().trim()
    return records.find((r) => r.categoria.toLowerCase().includes(norm)) ?? null
  }, [initialCategoria])

  const [c002, setC002] = useState(() =>
    initialMatch?.sueldoQuincenal ? formatCurrency(initialMatch.sueldoQuincenal) : ""
  )
  const [c011, setC011] = useState(() =>
    initialMatch?.concepto011 !== undefined ? formatCurrency(initialMatch.concepto011) : ""
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof calculateAguinaldo> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )
  const [isEditingFields, setIsEditingFields] = useState(() => !initialMatch?.sueldoQuincenal)

  const fields = useMemo(() => ({ c002, c011 }), [c002, c011])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    else setC011(value)
    if (!value) setResult(null)
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002" | "concepto011">>(() => ({
    c002: "concepto002",
    c011: "concepto011",
  }), [])

  const prefillFields = usePrefillFields({
    fields,
    setField,
    fieldMap,
    data: prefill.data,
  })

  const handleCurrencyChange = useCallback((key: FieldKey) => (value: string) => {
    prefillFields.markDirty(key)
    setField(key, value)
  }, [prefillFields, setField])

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    prefillFields.markDirty("c011")
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
    if (record.concepto011 !== undefined) setC011(formatCurrency(record.concepto011))
  }

  function validate(): { valid: boolean; v002: number | null; v011: number | null } {
    const v002 = parseCurrencyInput(c002)
    const v011 = parseCurrencyInput(c011)
    const e: Record<string, string> = {}
    if (v002 === null) e.c002 = "Escribe una cantidad válida, por ejemplo $8,500"
    if (v011 === null) e.c011 = "Escribe una cantidad válida (escribe 0 si no aplica en tu caso)"
    setErrors(e)
    return { valid: Object.keys(e).length === 0 && v002 !== null && v011 !== null, v002, v011 }
  }

  function handleCalculate() {
    const { valid, v002, v011 } = validate()
    if (!valid || v002 === null || v011 === null) {
      setIsEditingFields(true)
      return
    }
    setResult(calculateAguinaldo({ concepto002: v002, concepto011: v011 }))
  }

  function handleClear() {
    setC002("")
    setC011("")
    setErrors({})
    setResult(null)
    setSelectedCategory(null)
    prefillFields.clearDirty()
    setIsEditingFields(true)
  }

  const hasDataDetected = Boolean(c002 && c002.trim() !== "")

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", paddingBottom: "2rem" }}>
      <FriendlyCalculatorIntro
        title="Calcula cuánto recibirás de aguinaldo"
        description="Usaremos tu sueldo y las prestaciones que forman parte del cálculo para estimar cuánto te corresponde durante el año."
        badge="Cláusula 107 CCT"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />

        {hasDataDetected && !isEditingFields ? (
          <TarjetonDataNotice
            items={[
              { label: "Tu sueldo quincenal", value: c002, technicalCode: "Concepto 002" },
              { label: "Ayuda de renta", value: c011 || "$0.00", technicalCode: "Concepto 011" },
            ]}
            isEditing={isEditingFields}
            onToggleEditing={() => setIsEditingFields(true)}
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
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                Datos de tu sueldo
              </span>
              {hasDataDetected && (
                <button
                  type="button"
                  onClick={() => setIsEditingFields(false)}
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
                  Ocultar campos
                </button>
              )}
            </div>

            <CategorySelector
              initialCategory={selectedCategory ?? initialCategoria}
              onSelect={handleCategorySelect}
            />

            <FriendlyField
              id="c002"
              label="Tu sueldo quincenal"
              technicalLabel="Concepto 002 (sueldo tabular)"
              description="Aparece en la parte izquierda de tu tarjetón de percepciones."
              value={c002}
              onChange={handleCurrencyChange("c002")}
              error={errors.c002}
              placeholder="Ej: $8,450.20"
            />

            <FriendlyField
              id="c011"
              label="Ayuda de renta"
              technicalLabel="Concepto 011 (Cl. 63 Bis b)"
              description="Si tu categoría no la recibe, escribe 0."
              value={c011}
              onChange={handleCurrencyChange("c011")}
              error={errors.c011}
              placeholder="Ej: $1,245.30"
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button onClick={handleCalculate} size="md">
            <Calculator size={16} /> Calcular aguinaldo
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
          {hasDataDetected
            ? "Ya cargamos los importes de tu sueldo. Pulsa «Calcular aguinaldo» para ver tu resultado."
            : "Completa tus datos de sueldo quincenal y pulsa «Calcular aguinaldo» para conocer tu estimación."}
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <CalculationResultHero
            badge="AGUINALDO ESTIMADO"
            label="Tu aguinaldo total estimado del año"
            amount={result.totalAnual}
            explanation="Esta cantidad corresponde a 3 meses de tu sueldo base integrado conforme a la Cláusula 107 del CCT. El IMSS distribuye este monto en tres entregas durante el año."
          />

          <FriendlyBreakdown
            title="Así se distribuye tu pago"
            items={[
              {
                label: "Ya recibiste en enero",
                value: result.anticipoEnero047,
                technicalConcept: "Concepto 047",
                description: "Anticipo de 15 días cubierto en la primera quincena de enero.",
              },
              {
                label: "Anticipo recibido en agosto",
                value: result.valeAgosto043,
                technicalConcept: "Concepto 043",
                description: "Vale a cuenta de 30 días (únicamente si lo solicitaste en tiempo).",
              },
              {
                label: "Te faltaría recibir en diciembre",
                value: result.saldoDiciembre049,
                technicalConcept: "Concepto 049",
                highlight: true,
                description: "Saldo restante depositado en la primera quincena de diciembre.",
              },
            ]}
          />

          <WorkerExplanation
            title="¿Cómo y cuándo se cobra tu aguinaldo?"
            points={[
              {
                title: "Fecha de pago en diciembre",
                text: "El saldo restante (Concepto 049) se paga en la primera quincena de diciembre, antes del día 20.",
              },
              {
                title: "Anticipo de enero",
                text: "El IMSS adelanta 15 días (Concepto 047) para amortiguar los gastos de inicio de año.",
              },
              {
                title: "Deducciones y retenciones",
                text: "Este monto es tu percepción nominal. En tu recibo se aplicará la retención correspondiente de ISR y posibles descuentos sindicales o préstamos.",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver cómo se calculó y fundamento legal"
            subtitle="Base quincenal, integración de conceptos y Cláusula 107 del CCT"
          >
            <ResultCard
              title="Valores técnicos de nómina"
              rows={[
                { label: "Base quincenal integrada (002 + 011)", value: result.base, technicalConcept: "Base quincenal" },
                { label: "Sueldo mensual base (Base × 2)", value: result.baseMensual, technicalConcept: "Base mensual" },
                { label: "Aguinaldo total anual (3 meses / 90 días)", value: result.totalAnual, highlight: true },
                { label: "Anticipo de enero (15 días)", value: result.anticipoEnero047, technicalConcept: "Concepto 047" },
                { label: "Vale de agosto (30 días)", value: result.valeAgosto043, technicalConcept: "Concepto 043" },
                { label: "Saldo a pagar en diciembre", value: result.saldoDiciembre049, technicalConcept: "Concepto 049", highlight: true },
                ...(result.historicalComparison
                  ? [
                      {
                        label: `Comparación histórica (${result.historicalComparison.label})`,
                        value: result.historicalComparison.total,
                        format: "currency" as const,
                      },
                    ]
                  : []),
              ]}
            />

            <FormulaExplanation
              title="Procedimiento normativo de cálculo"
              steps={[
                "Base quincenal = Concepto 002 (sueldo tabular) + Concepto 011 (ayuda de renta)",
                "Sueldo mensual base = Base quincenal × 2",
                "Aguinaldo total anual = Sueldo mensual base × 3 meses (90 días de salario)",
                "Concepto 047 (Enero) = Sueldo mensual base × 0.5 (medio mes / 15 días)",
                "Concepto 043 (Agosto) = Sueldo mensual base × 1.0 (un mes / 30 días, si fue solicitado)",
                "Concepto 049 (Diciembre) = Total anual menos los anticipos entregados",
              ]}
              fundamento="Cláusula 107 del Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027 (3 meses de sueldo nominal integrado)."
            />
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="Esta es una estimación basada en tus percepciones normales. La cantidad final depositada puede variar si existen retenciones de ISR, inasistencias o descuentos que no aparezcan en esta simulación."
            additionalInfo="Cláusula 107 del CCT: El aguinaldo corresponde a 90 días de salario base integrado. En caso de no haber laborado todo el año por licencias sin goce o ingreso posterior, se computa la parte proporcional."
          />
        </div>
      )}
    </div>
  )
}
