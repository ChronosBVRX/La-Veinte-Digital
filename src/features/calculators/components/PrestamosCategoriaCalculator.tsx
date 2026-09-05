"use client"

import { useState, useMemo, useCallback, useActionState } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import { Search, Check, RotateCcw, AlertTriangle, Building2, Car, Home, Wallet } from "lucide-react"
import { Input } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { FriendlyCalculatorIntro } from "./FriendlyCalculatorIntro"
import { WorkerExplanation } from "./WorkerExplanation"
import { TechnicalDetails } from "./TechnicalDetails"
import { CalculatorNotice } from "./CalculatorNotice"
import { PrefillStatus } from "./PrefillStatus"
import { filterCategorias, calcularPrestamos, mapJsonToPrestamoRecord, normalizeSearch } from "../lib/prestamos"
import { formatCurrency } from "../lib/money"
import { useCalculatorPrefill } from "../hooks/useCalculatorPrefill"
import { usePrefillFields } from "../hooks/usePrefillFields"
import type { PrestamoCategoriaRecord } from "../lib/types"
import prestamosRaw from "../data/prestamos_categoria.json"
import { saveProfileCategoria } from "../services/saveProfileCategoria"

interface Props {
  initialCategoria?: string | null
}

function getLoanIcon(modalidad: string) {
  const m = modalidad.toLowerCase()
  if (m.includes("automóvil") || m.includes("automovil")) return Car
  if (m.includes("hipotecario") || m.includes("enganche") || m.includes("vivienda")) return Home
  if (m.includes("cláusula 97") || m.includes("clausula 97") || m.includes("anticipo")) return Wallet
  return Building2
}

export function PrestamosCategoriaCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => todayForQueryParam(), [])
  const prefill = useCalculatorPrefill("prestamos", targetDate)

  const [query, setQuery] = useState(initialCategoria ?? "")
  const setQueryField = useCallback((_: "categoryName", value: string) => setQuery(value), [])

  usePrefillFields({
    fields: { categoryName: query },
    setField: setQueryField,
    fieldMap: { categoryName: "categoryName" },
    data: prefill.data,
  })

  const [userSelected, setUserSelected] = useState<PrestamoCategoriaRecord | null>(null)
  const [saved, setSaved] = useState(false)

  const [saveState, saveAction, savePending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | undefined, formData: FormData) => {
      const cat = formData.get("categoria") as string
      try {
        await saveProfileCategoria(cat)
        setSaved(true)
        return { ok: true }
      } catch {
        return { ok: false, error: "No se pudo guardar. Intenta de nuevo." }
      }
    },
    undefined
  )

  const records = useMemo(() => {
    if (!Array.isArray(prestamosRaw)) return []
    return (prestamosRaw as Record<string, unknown>[]).map(mapJsonToPrestamoRecord)
  }, [])

  const jsonUnavailable = records.length === 0

  const initialMatch = useMemo(() => {
    if (!initialCategoria) return null
    const norm = normalizeSearch(initialCategoria)
    return records.find((r) => normalizeSearch(r.categoria) === norm) ?? null
  }, [initialCategoria, records])

  const selected = userSelected ?? initialMatch

  const filtered = useMemo(() => filterCategorias(records, query), [records, query])

  const selectedCalculos = useMemo(() => {
    if (!selected) return []
    return calcularPrestamos(selected)
  }, [selected])

  const handleSelect = (r: PrestamoCategoriaRecord) => {
    setUserSelected(r)
    setSaved(false)
  }

  const handleClear = () => {
    setUserSelected(null)
    setQuery("")
    setSaved(false)
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
      <FriendlyCalculatorIntro
        title="Consulta cuánto puedes solicitar según tu categoría"
        badge="Tabulador IMSS-SNTSS"
        description="Encuentra tu puesto de trabajo para conocer los préstamos institucionales y facilidades de pago disponibles según tu tabulador oficial."
      />

      <div style={{ marginBottom: "1.25rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
      </div>

      {jsonUnavailable && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1rem",
            fontSize: "0.8125rem",
            marginBottom: "1rem",
          }}
        >
          <AlertTriangle size={16} color="var(--warning)" />
          <span>No se pudo cargar el tabulador de préstamos institucional.</span>
        </div>
      )}

      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Banner de categoría seleccionada */}
          <div
            style={{
              background: "rgba(37, 99, 235, 0.04)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--primary)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Puesto seleccionado
              </span>
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  margin: 0,
                  lineHeight: 1.3,
                  wordBreak: "break-word",
                }}
              >
                {selected.categoria}
              </h2>
              {selected.descripcionTC && (
                <p
                  style={{
                    fontSize: "0.78125rem",
                    color: "var(--muted)",
                    margin: "0.25rem 0 0",
                    lineHeight: 1.3,
                  }}
                >
                  {selected.descripcionTC}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <form action={saveAction}>
                <input type="hidden" name="categoria" value={selected.categoria} />
                <Button
                  type="submit"
                  variant={saved || saveState?.ok ? "secondary" : "primary"}
                  size="sm"
                  loading={savePending}
                  disabled={saved || saveState?.ok || savePending}
                >
                  {saved || saveState?.ok ? (
                    <>
                      <Check size={14} /> Guardado en tu perfil
                    </>
                  ) : (
                    "Guardar en mi perfil"
                  )}
                </Button>
              </form>

              <Button variant="secondary" size="sm" onClick={handleClear}>
                <RotateCcw size={14} /> Cambiar puesto
              </Button>
            </div>
          </div>

          {/* Tarjetas destacadas de préstamos disponibles */}
          <div>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--fg)",
                margin: "0 0 0.875rem",
              }}
            >
              Préstamos y montos disponibles para tu puesto
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
              }}
            >
              {selectedCalculos.map((c, i) => {
                const Icon = getLoanIcon(c.modalidad)
                return (
                  <Card
                    key={i}
                    padding="1.25rem"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "var(--radius-md)",
                            background: "rgba(37, 99, 235, 0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={18} style={{ color: "var(--primary)" }} />
                        </div>
                        <h4
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            margin: 0,
                            color: "var(--fg)",
                            lineHeight: 1.3,
                          }}
                        >
                          {c.modalidad}
                        </h4>
                      </div>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          display: "block",
                          marginTop: "0.25rem",
                        }}
                      >
                        Puedes solicitar hasta
                      </span>
                      <div
                        style={{
                          fontSize: "1.375rem",
                          fontWeight: 800,
                          color: "var(--primary)",
                          fontVariantNumeric: "tabular-nums",
                          marginTop: "0.125rem",
                        }}
                      >
                        {formatCurrency(c.valor)}
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: "0.5rem",
                        fontSize: "0.71875rem",
                        color: "var(--muted)",
                      }}
                    >
                      <span>Sujeto a validación institucional y liquidez quincenal.</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          <WorkerExplanation
            title="¿Cómo tramitar un préstamo institucional?"
            points={[
              {
                title: "Vía de solicitud",
                text: "Los préstamos se gestionan a través de la representación sindical del SNTSS o directamente en el área de prestaciones económicas de tu unidad.",
              },
              {
                title: "Capacidad de endeudamiento",
                text: "El monto autorizado dependerá de que tus descuentos totales no superen los topes legales de tu sueldo neto quincenal.",
              },
              {
                title: "Plazos de amortización",
                text: "Cada crédito cuenta con plazos definidos en quincenas descontadas automáticamente vía nómina.",
              },
            ]}
          />

          <TechnicalDetails
            title="Ver datos de tabulador y fórmulas utilizadas"
            subtitle="Valores SMTAB, SMI y bases tabulares por categoría"
          >
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {selected.sueldoPlaza !== undefined && (
                <InfoItem label="Sueldo plaza" value={formatCurrency(selected.sueldoPlaza)} />
              )}
              {selected.sueldoQuincenal !== undefined && (
                <InfoItem label="Sueldo quincenal (002)" value={formatCurrency(selected.sueldoQuincenal)} />
              )}
              {selected.concepto011 !== undefined && (
                <InfoItem label="Ayuda de renta (011)" value={formatCurrency(selected.concepto011)} />
              )}
              {selected.smtabMas011 !== undefined && (
                <InfoItem label="SMTAB + 011 mensual" value={formatCurrency(selected.smtabMas011)} />
              )}
              {selected.smi !== undefined && (
                <InfoItem label="SMI (Tabulador)" value={formatCurrency(selected.smi)} />
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                Fórmulas contractuales por modalidad
              </h4>
              {selectedCalculos.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>{c.modalidad}</span>
                  <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.formula}</span>
                </div>
              ))}
            </div>
          </TechnicalDetails>

          <CalculatorNotice
            title="Toma en cuenta"
            text="Los montos máximos son de carácter informativo conforme al tabulador vigente. El otorgamiento final está sujeto a la disponibilidad del fondo de préstamos y a tu capacidad líquida de pago."
          />
        </div>
      ) : (
        /* Búsqueda de categoría */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
            }}
          >
            <label
              htmlFor="buscar"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--fg)",
                marginBottom: "0.5rem",
              }}
            >
              ¿Cuál es tu categoría o puesto de trabajo?
            </label>

            <Input
              id="buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe tu puesto (ej: médico, enfermera, auxiliar, 08, 02...)"
              icon={<Search size={16} />}
              style={{ fontSize: "1rem" }}
            />
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
                padding: "0 0.25rem",
              }}
            >
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                {filtered.length} categoría{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Toca tu puesto para ver sus préstamos
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                maxHeight: "450px",
                overflowY: "auto",
                paddingRight: "0.25rem",
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px dashed var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "2rem",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: "0.875rem",
                  }}
                >
                  No encontramos categorías que coincidan con «{query}». Prueba buscando palabras clave como «enfermera», «médico» o «auxiliar».
                </div>
              ) : (
                filtered.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(r)}
                    style={{
                      textAlign: "left",
                      background: "var(--card)",
                      color: "var(--fg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem 1rem",
                      cursor: "pointer",
                      fontSize: "0.84375rem",
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      minHeight: "44px",
                    }}
                  >
                    <div>
                      <span style={{ display: "block", color: "var(--fg)" }}>{r.categoria}</span>
                      {r.descripcionTC && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.71875rem",
                            color: "var(--muted)",
                            fontWeight: 400,
                            marginTop: "0.125rem",
                          }}
                        >
                          {r.descripcionTC}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>
                      Consultar →
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <CalculatorNotice />
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--muted)" }}>{label}</span>
      <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.125rem" }}>
        {value}
      </span>
    </div>
  )
}
