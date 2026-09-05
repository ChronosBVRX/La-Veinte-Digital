"use client"

import { useState, useMemo, useCallback } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import { Calculator, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
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
  calculateSegundaJulio,
  calculateSegundaJulioProporcional,
  validateUnidades,
  SEGUNDA_JULIO_DAYS_FULL,
  SEGUNDA_JULIO_ANNUAL_BASE,
} from "../lib/segundaJulio"
import { mapJsonToPrestamoRecord } from "../lib/prestamos"
import { parseCurrencyInput, formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import prestamosRaw from "../data/prestamos_categoria.json"
import type { PrestamoCategoriaRecord } from "../lib/types"

interface Props {
  initialCategoria?: string | null
  initialMode?: "completo" | "proporcional"
}

type FieldKey = "c002" | "c011" | "unidades"

export function SegundaJulioCalculator({ initialCategoria, initialMode = "completo" }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const isProporcionalInitial = initialMode === "proporcional"
  const prefillId = isProporcionalInitial ? "segunda-julio-proporcional" : "segunda-julio"
  const prefill = useCalculatorPrefill(prefillId, targetDate)

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
  const [isFullPeriod, setIsFullPeriod] = useState(!isProporcionalInitial)
  const [unidades, setUnidades] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resultadoCompleto, setResultadoCompleto] = useState<number | null>(null)
  const [resultadoProporcional, setResultadoProporcional] = useState<
    ReturnType<typeof calculateSegundaJulioProporcional> | null
  >(null)
  const [baseCalculada, setBaseCalculada] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialMatch?.categoria ?? null
  )
  const [isEditingFields, setIsEditingFields] = useState(() => !initialMatch?.sueldoQuincenal)

  const fields = useMemo(() => ({ c002, c011, unidades }), [c002, c011, unidades])

  const setField = useCallback((key: FieldKey, value: string) => {
    if (key === "c002") setC002(value)
    else if (key === "c011") setC011(value)
    else setUnidades(value)
    if (!value) {
      setResultadoCompleto(null)
      setResultadoProporcional(null)
    }
  }, [])

  const fieldMap = useMemo<Record<FieldKey, "concepto002" | "concepto011" | "daysWorkedInAnnualPeriod">>(
    () => ({
      c002: "concepto002",
      c011: "concepto011",
      unidades: "daysWorkedInAnnualPeriod",
    }),
    []
  )

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

  const c002Num = parseCurrencyInput(c002)
  const c011Num = parseCurrencyInput(c011)

  const handleCategorySelect = (record: PrestamoCategoriaRecord) => {
    setSelectedCategory(record.categoria)
    prefillFields.markDirty("c002")
    prefillFields.markDirty("c011")
    if (record.sueldoQuincenal) setC002(formatCurrency(record.sueldoQuincenal))
    if (record.concepto011 !== undefined) setC011(formatCurrency(record.concepto011))
  }

  function validate(): { valid: boolean; v002: number | null; v011: number | null; uNum: number | null } {
    const v002 = parseCurrencyInput(c002)
    const v011 = parseCurrencyInput(c011)
    const e: Record<string, string> = {}
    if (v002 === null) e.c002 = "Escribe una cantidad válida, por ejemplo $8,500"
    if (v011 === null) e.c011 = "Escribe una cantidad válida (0 si tu puesto no recibe ayuda de renta)"

    let uNum: number | null = null
    if (!isFullPeriod) {
      uNum = parseInt(unidades, 10)
      if (!unidades || isNaN(uNum)) {
        e.unidades = "Indica las unidades computables en el periodo (entre 1 y 360)"
      } else {
        const uErr = validateUnidades(uNum)
        if (uErr) e.unidades = "La cantidad no puede ser mayor a 360 unidades ni menor a 1"
      }
    }

    setErrors(e)
    const valid = Object.keys(e).length === 0 && v002 !== null && v011 !== null
    return { valid, v002, v011, uNum }
  }

  function handleCalculate() {
    const { valid, v002, v011, uNum } = validate()
    if (!valid || v002 === null || v011 === null) {
      setIsEditingFields(true)
      return
    }

    const calculatedBase = v002 + v011
    setBaseCalculada(calculatedBase)

    if (isFullPeriod) {
      const res = calculateSegundaJulio({ concepto002: v002, concepto011: v011 })
      setResultadoCompleto(res)
      setResultadoProporcional(null)
    } else if (uNum !== null) {
      const resProp = calculateSegundaJulioProporcional({
        concepto002: v002,
        concepto011: v011,
        unidades: uNum,
      })
      setResultadoProporcional(resProp)
      setResultadoCompleto(null)
    }
  }

  function handleClear() {
    setC002("")
    setC011("")
    setUnidades("")
    setErrors({})
    setResultadoCompleto(null)
    setResultadoProporcional(null)
    setBaseCalculada(0)
    setSelectedCategory(null)
    prefillFields.clearDirty()
    setIsEditingFields(true)
  }

  const hasDataDetected = Boolean(c002 && c002.trim() !== "")
  const hasResult = resultadoCompleto !== null || resultadoProporcional !== null

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", paddingBottom: "2rem" }}>
      <FriendlyCalculatorIntro
        title="Calcula cuánto recibirás en tu Segunda de Julio"
        description="Esta prestación (Fondo de Ahorro) se calcula con tu sueldo y el periodo que trabajaste del 1 de julio al 30 de junio."
        badge="Cláusula 144 CCT"
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
              description="Aparece en tus percepciones quincenales."
              value={c002}
              onChange={handleCurrencyChange("c002")}
              error={errors.c002}
              placeholder="Ej: $8,450.20"
            />

            <FriendlyField
              id="c011"
              label="Ayuda de renta"
              technicalLabel="Concepto 011 (Cl. 63 Bis b)"
              description="Forma parte de la base integrada para el Fondo de Ahorro."
              value={c011}
              onChange={handleCurrencyChange("c011")}
              error={errors.c011}
              placeholder="Ej: $1,245.30"
            />
          </div>
        )}

        {/* Pregunta humana sobre el periodo laborado */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--fg)",
              marginBottom: "0.75rem",
            }}
          >
            ¿Trabajaste todo el periodo del 1 de julio al 30 de junio?
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => {
                setIsFullPeriod(true)
                setErrors((prev) => {
                  const copy = { ...prev }
                  delete copy.unidades
                  return copy
                })
              }}
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "var(--radius-md)",
                border: isFullPeriod ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: isFullPeriod ? "rgba(37, 99, 235, 0.05)" : "var(--card)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                minHeight: "44px",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: isFullPeriod ? "5px solid var(--primary)" : "2px solid var(--border)",
                  marginTop: 2,
                  flexShrink: 0,
                  background: "#fff",
                }}
              />
              <div>
                <strong style={{ display: "block", fontSize: "0.875rem", color: "var(--fg)" }}>
                  Sí, trabajé todo el periodo
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  La calculadora utilizará el periodo completo (360 unidades).
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsFullPeriod(false)}
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "var(--radius-md)",
                border: !isFullPeriod ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: !isFullPeriod ? "rgba(37, 99, 235, 0.05)" : "var(--card)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                minHeight: "44px",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: !isFullPeriod ? "5px solid var(--primary)" : "2px solid var(--border)",
                  marginTop: 2,
                  flexShrink: 0,
                  background: "#fff",
                }}
              />
              <div>
                <strong style={{ display: "block", fontSize: "0.875rem", color: "var(--fg)" }}>
                  No, trabajé solo una parte
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Necesitamos saber qué parte del periodo se toma en cuenta para tu prestación.
                </span>
              </div>
            </button>
          </div>

          {!isFullPeriod && (
            <div
              style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div>
                <Input
                  id="unidades"
                  label="Unidades que se tomarán en cuenta"
                  value={unidades}
                  onChange={(e) => {
                    setField("unidades", e.target.value)
                    prefillFields.markDirty("unidades")
                  }}
                  placeholder="Ej: 180"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ borderColor: errors.unidades ? "var(--error)" : undefined, fontSize: "1rem" }}
                />
                <p style={{ fontSize: "0.78125rem", color: "var(--muted)", margin: "0.375rem 0 0", lineHeight: 1.4 }}>
                  Este dato representa la parte del periodo anual que se considera para calcular tu prestación. Un periodo completo equivale a 360 unidades.
                </p>
                {errors.unidades && (
                  <p style={{ fontSize: "0.78125rem", color: "var(--error)", margin: "0.25rem 0 0" }}>
                    {errors.unidades}
                  </p>
                )}
              </div>

              {/* Explicación desplegable para el trabajador si desconoce sus unidades */}
              <div
                style={{
                  background: "var(--accent)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 0.875rem",
                  fontSize: "0.78125rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>¿No sabes cuántas unidades tienes?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("unidades", "180")
                      prefillFields.markDirty("unidades")
                    }}
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.71875rem",
                      cursor: "pointer",
                      color: "var(--primary)",
                      fontWeight: 600,
                    }}
                  >
                    Probar con 180 unidades (50 %)
                  </button>
                </div>
                <p style={{ margin: "0.375rem 0 0", color: "var(--muted)", lineHeight: 1.4 }}>
                  Puedes consultar este dato en tu información laboral o capturarlo si ya te fue proporcionado. No vamos a adivinarlo para evitar darte un cálculo incorrecto. (Ejemplo: 180 unidades representan matemáticamente el 50 % del periodo computable).
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button onClick={handleCalculate} size="md">
            <Calculator size={16} /> Calcular Segunda de Julio
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

      {!hasResult && (
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
            ? "Revisa que tu periodo laborado sea correcto y pulsa «Calcular Segunda de Julio»."
            : "Ingresa tus datos y pulsa «Calcular Segunda de Julio» para estimar tu prestación."}
        </div>
      )}

      {/* RESULTADO COMPLETO */}
      {resultadoCompleto !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <CalculationResultHero
            badge="SEGUNDA DE JULIO"
            label="Aproximadamente recibirías"
            amount={resultadoCompleto}
            explanation="Esta cantidad corresponde a tu prestación completa de Segunda de Julio (Fondo de Ahorro) por haber trabajado el año completo (del 1 de julio al 30 de junio). Se deposita en tu cuenta junto con tu quincena regular."
            secondaryHighlight={{
              label: "Base quincenal integrada utilizada",
              value: formatCurrency(baseCalculada),
            }}
          />

          <WorkerExplanation
            title="¿Cómo funciona tu Segunda de Julio?"
            points={[
              {
                title: "¿Cuándo se deposita?",
                text: "Se paga anualmente en la segunda quincena del mes de julio a todo el personal con derecho al Fondo de Ahorro.",
              },
              {
                title: "¿Se suma a tu sueldo?",
                text: "Sí. Este monto es una prestación adicional y se transfiere en conjunto con tu pago normal de la quincena.",
              },
              {
                title: "Régimen ordinario",
                text: "Conforme al CCT, equivale a 46 días de salario integrado (sueldo tabular + ayuda de renta).",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver cálculo y fundamento legal"
            subtitle="Fórmula oficial, base integrada y Cláusula 144 del CCT"
          >
            <ResultCard
              title="Valores técnicos"
              rows={[
                { label: "Concepto 002 (sueldo tabular)", value: c002Num ?? 0 },
                { label: "Concepto 011 (ayuda renta Cl. 63 Bis b)", value: c011Num ?? 0 },
                { label: "Base integrada para Fondo de Ahorro (002 + 011)", value: baseCalculada },
                { label: "Días considerados", value: SEGUNDA_JULIO_DAYS_FULL, format: "number" },
                { label: "Segunda de julio (46 días)", value: resultadoCompleto, highlight: true },
              ]}
            />

            <FormulaExplanation
              title="Procedimiento de cálculo"
              steps={[
                "Base = Concepto 002 (sueldo tabular) + Concepto 011 (ayuda de renta)",
                `Segunda de julio = (Base ÷ 15) × ${SEGUNDA_JULIO_DAYS_FULL} días`,
                "Presupone el escenario de año completo (360 unidades computables)",
              ]}
              fundamento="Cláusula 144 del CCT IMSS-SNTSS (Fondo de Ahorro) y Cláusula 63 Bis inciso b (integración de ayuda de renta)."
            />
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="Esta es una estimación basada en tus datos actuales. La cantidad final puede variar si en tu nómina existen descuentos sindicales, préstamos o retenciones no contempladas."
          />
        </div>
      )}

      {/* RESULTADO PROPORCIONAL */}
      {resultadoProporcional !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <CalculationResultHero
            badge="SEGUNDA DE JULIO PROPORCIONAL"
            label="Aproximadamente recibirías"
            amount={resultadoProporcional.resultado}
            explanation={`Por las ${unidades} unidades computables que indicaste dentro del periodo anual, te corresponde recibir aproximadamente el ${(resultadoProporcional.proporcion * 100).toFixed(1)}% de la prestación anual completa. Se deposita en tu cuenta junto con tu quincena regular.`}
            secondaryHighlight={{
              label: "Monto por periodo completo (360 unidades)",
              value: formatCurrency(resultadoProporcional.importeCompleto),
            }}
          />

          <FriendlyBreakdown
            title="Desglose proporcional"
            items={[
              {
                label: "Monto por periodo completo (360 unidades)",
                value: resultadoProporcional.importeCompleto,
                description: "Lo que correspondería si se cubriera el ciclo anual completo.",
              },
              {
                label: `Proporción por ${unidades} unidades computables`,
                value: resultadoProporcional.proporcion,
                format: "percent",
                description: `${unidades} unidades de 360 computables.`,
              },
              {
                label: "Monto proporcional a recibir",
                value: resultadoProporcional.resultado,
                highlight: true,
                description: "Monto estimado que se sumará a tu quincena.",
              },
            ]}
          />

          <WorkerExplanation
            title="¿Por qué recibes un monto proporcional?"
            points={[
              {
                title: "Ciclo de cómputo y unidades",
                text: "El periodo computable del Fondo de Ahorro abarca del 1 de julio del año anterior al 30 de junio del año en curso (360 unidades en un periodo completo).",
              },
              {
                title: "Cálculo proporcional",
                text: "Si tu registro cuenta con menos de 360 unidades computables por licencias, incidencias o ingreso posterior, se calcula la proporción exacta que corresponde a tus unidades registradas.",
              },
              {
                title: "Fecha de pago",
                text: "Se deposita en la segunda quincena de julio al igual que la prestación ordinaria.",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver cálculo y fundamento legal"
            subtitle="Unidades computables, proporción anual y Cláusula 144"
          >
            <ResultCard
              title="Valores técnicos"
              rows={[
                { label: "Concepto 002 (sueldo tabular)", value: c002Num ?? 0 },
                { label: "Concepto 011 (ayuda renta Cl. 63 Bis b)", value: c011Num ?? 0 },
                { label: "Base integrada para Fondo de Ahorro", value: resultadoProporcional.base },
                { label: "Importe completo (360 unidades)", value: resultadoProporcional.importeCompleto },
                { label: "Unidades computables", value: parseInt(unidades, 10), format: "number" },
                { label: "Proporción del periodo", value: resultadoProporcional.proporcion, format: "percent" },
                { label: "Importe proporcional a pagar", value: resultadoProporcional.resultado, highlight: true },
              ]}
            />

            <FormulaExplanation
              title="Procedimiento de cálculo proporcional"
              steps={[
                "Base = Concepto 002 (sueldo tabular) + Concepto 011 (ayuda de renta)",
                `Importe completo = (Base ÷ 15) × ${SEGUNDA_JULIO_DAYS_FULL}`,
                `Proporción = Unidades computables (${unidades}) ÷ ${SEGUNDA_JULIO_ANNUAL_BASE}`,
                "Importe proporcional = Importe completo × Proporción",
              ]}
              fundamento="Cláusula 144 del CCT IMSS-SNTSS y Cláusula 63 Bis b. Para categorías 08, 02 o cualquier trabajador con periodo laboral parcial."
            />
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="Esta es una estimación orientativa basada en las unidades indicadas. La cantidad final depositada dependerá del corte oficial de nómina de la delegación correspondiente."
          />
        </div>
      )}
    </div>
  )
}
