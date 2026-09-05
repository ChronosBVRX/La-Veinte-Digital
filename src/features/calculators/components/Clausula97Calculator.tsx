"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import { Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { FriendlyCalculatorIntro } from "./FriendlyCalculatorIntro"
import { FriendlyField } from "./FriendlyField"
import { TarjetonDataNotice } from "./TarjetonDataNotice"
import { CalculationResultHero } from "./CalculationResultHero"
import { WorkerExplanation } from "./WorkerExplanation"
import { TechnicalDetails } from "./TechnicalDetails"
import { CalculatorNotice } from "./CalculatorNotice"
import { CategorySelector } from "./CategorySelector"
import { PrefillStatus } from "./PrefillStatus"
import { ResultCard } from "./ResultCard"
import { FormulaExplanation } from "./FormulaExplanation"
import { calculateClausula97 } from "../lib/clausula97"
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

export function Clausula97Calculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("clausula-97", targetDate)

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
  const [result, setResult] = useState<ReturnType<typeof calculateClausula97> | null>(null)
  const [selectedMonths, setSelectedMonths] = useState<number>(2)
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
    if (v011 === null) e.c011 = "Escribe una cantidad válida (0 si tu puesto no recibe ayuda de renta)"
    setErrors(e)
    return { valid: Object.keys(e).length === 0 && v002 !== null && v011 !== null, v002, v011 }
  }

  function handleCalculate() {
    const { valid, v002, v011 } = validate()
    if (!valid || v002 === null || v011 === null) {
      setIsEditingFields(true)
      return
    }
    setResult(calculateClausula97({ concepto002: v002, concepto011: v011 }))
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

  const selectedOption = useMemo(() => {
    if (!result) return null
    return result.opciones.find((o) => o.meses === selectedMonths) ?? result.opciones[1]
  }, [result, selectedMonths])

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", paddingBottom: "2rem" }}>
      <FriendlyCalculatorIntro
        title="Anticipo de sueldo"
        badge="Cláusula 97 CCT"
        description="Consulta cuánto puedes solicitar como anticipo de sueldo sin intereses y cuánto te descontarían de cada quincena."
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
              description="Sueldo base quincenal que aparece en tu nómina."
              value={c002}
              onChange={handleCurrencyChange("c002")}
              error={errors.c002}
              placeholder="Ej: $8,450.20"
            />

            <FriendlyField
              id="c011"
              label="Ayuda de renta"
              technicalLabel="Concepto 011 (Cl. 63 Bis b)"
              description="Se suma a tu sueldo tabular para calcular la base mensual."
              value={c011}
              onChange={handleCurrencyChange("c011")}
              error={errors.c011}
              placeholder="Ej: $1,245.30"
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button onClick={handleCalculate} size="md">
            <Calculator size={16} /> Calcular opciones de anticipo
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
            ? "Revisa tus importes y pulsa «Calcular opciones de anticipo» para consultar los montos disponibles."
            : "Completa tu sueldo quincenal para ver cuánto puedes solicitar bajo la Cláusula 97."}
        </div>
      )}

      {result && selectedOption && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Selector interactivo de meses */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--fg)",
                marginBottom: "0.625rem",
              }}
            >
              ¿Cuánto te gustaría solicitar?
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "0.5rem",
              }}
            >
              {[1, 2, 3, 4].map((m) => {
                const isSelected = selectedMonths === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonths(m)}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderRadius: "var(--radius-md)",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: isSelected ? "var(--primary)" : "var(--card)",
                      color: isSelected ? "var(--primary-fg)" : "var(--fg)",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                      minHeight: "44px",
                    }}
                  >
                    {m} {m === 1 ? "mes" : "meses"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resultado principal destacado para la opción seleccionada */}
          <CalculationResultHero
            badge={`ANTICIPO DE ${selectedOption.meses} ${selectedOption.meses === 1 ? "MES" : "MESES"}`}
            label={`Si solicitas ${selectedOption.meses} ${selectedOption.meses === 1 ? "mes" : "meses"} de sueldo recibirías:`}
            amount={selectedOption.monto}
            explanation={`Te descontarían aproximadamente ${formatCurrency(selectedOption.descuentoQuincenal)} de tu nómina cada quincena. Terminarías de pagarlo en ${selectedOption.quincenasRecuperacion} quincenas (sin intereses).`}
            secondaryHighlight={{
              label: "Descuento estimado por quincena",
              value: `${formatCurrency(selectedOption.descuentoQuincenal)} / quincena`,
            }}
          />

          {/* Comparativa clara de las 4 opciones */}
          <div>
            <h3
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "var(--fg)",
                margin: "0 0 0.75rem",
              }}
            >
              Comparativa de plazos y descuentos
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {result.opciones.map((o) => {
                const isSelected = o.meses === selectedMonths
                return (
                  <div
                    key={o.meses}
                    onClick={() => setSelectedMonths(o.meses)}
                    style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
                  >
                    <Card
                      padding="1rem"
                      style={{
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(37, 99, 235, 0.04)" : "var(--card)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                    <div>
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          margin: "0 0 0.25rem",
                          color: isSelected ? "var(--primary)" : "var(--fg)",
                        }}
                      >
                        {o.meses} {o.meses === 1 ? "mes" : "meses"}
                      </p>
                      <p
                        style={{
                          fontSize: "1.125rem",
                          fontWeight: 800,
                          margin: "0 0 0.625rem",
                          color: "var(--fg)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(o.monto)}
                      </p>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: "0.5rem",
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      <p style={{ margin: "0 0 0.25rem" }}>
                        Descuento:{" "}
                        <strong style={{ color: "var(--fg)" }}>
                          {formatCurrency(o.descuentoQuincenal)}
                        </strong>{" "}
                        por quincena
                      </p>
                      <p style={{ margin: 0 }}>
                        Terminas en:{" "}
                        <strong style={{ color: "var(--fg)" }}>
                          {o.quincenasRecuperacion} quincenas
                        </strong>
                      </p>
                    </div>
                  </Card>
                </div>
              )
            })}
            </div>
          </div>

          <WorkerExplanation
            title="¿Cómo funciona el anticipo de la Cláusula 97?"
            points={[
              {
                title: "Sin cobro de intereses",
                text: "Es una prestación institucional del CCT IMSS-SNTSS. El importe total que recibes es exactamente el mismo que devuelves, dividido en partes iguales.",
              },
              {
                title: "Frecuencia anual",
                text: "Se puede tramitar una sola vez al año. Para poder tramitar uno nuevo, el anterior debe estar totalmente liquidado.",
              },
              {
                title: "Capacidad de pago",
                text: "El monto que te aprueben dependerá de que tu recibo tenga suficiente liquidez después de los demás descuentos obligatorios de ley y sindicato.",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver cómo se calculó y fundamento legal"
            subtitle="Base mensual (002 + 011) × 2 y Cláusula 97 del CCT"
          >
            <ResultCard
              title="Base de cálculo técnica"
              rows={[
                { label: "Base quincenal (Concepto 002 + 011)", value: result.baseQuincenal },
                { label: "Sueldo mensual base (Base quincenal × 2)", value: result.baseMensual, highlight: true },
                { label: "Monto de 1 mes (recuperación en 10 qnas)", value: result.unMes },
                { label: "Monto de 2 meses (recuperación en 20 qnas)", value: result.dosMeses },
                { label: "Monto de 3 meses (recuperación en 30 qnas)", value: result.tresMeses },
                { label: "Monto de 4 meses (recuperación en 40 qnas)", value: result.cuatroMeses },
              ]}
            />

            <FormulaExplanation
              title="Procedimiento de cálculo de anticipo"
              steps={[
                "Base quincenal = Concepto 002 (sueldo tabular) + Concepto 011 (ayuda de renta)",
                "Base mensual = Base quincenal × 2",
                "1 mes: Anticipo = 1 sueldo mensual; recuperación en 10 quincenas",
                "2 meses: Anticipo = 2 sueldos mensuales; recuperación en 20 quincenas",
                "3 meses: Anticipo = 3 sueldos mensuales; recuperación en 30 quincenas",
                "4 meses: Anticipo = 4 sueldos mensuales; recuperación en 40 quincenas",
              ]}
              fundamento="Cláusula 97 del Contrato Colectivo de Trabajo IMSS-SNTSS. Anticipo sin intereses hasta por cuatro meses de sueldo, una sola vez al año."
            />
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="La entrega del anticipo es facultativa y depende de la suficiencia presupuestal de la delegación y de que tu capacidad de endeudamiento permita el descuento en nómina."
          />
        </div>
      )}
    </div>
  )
}
