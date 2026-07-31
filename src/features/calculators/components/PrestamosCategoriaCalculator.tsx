"use client"

import { useState, useMemo, useCallback, useActionState } from "react"
import Link from "next/link"
import { ArrowLeft, Search, Check, RotateCcw, AlertTriangle } from "lucide-react"
import { Input } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
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

export function PrestamosCategoriaCalculator({ initialCategoria }: Props) {
  const targetDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
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
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Préstamos por categoría</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Consulta montos de préstamos disponibles según tu categoría. Los montos provienen del tabulador cargado.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <PrefillStatus data={prefill.data} loading={prefill.loading} error={prefill.error} />
      </div>

      {jsonUnavailable && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          <AlertTriangle size={16} color="var(--warning)" />
          <span>No se pudo cargar el tabulador de préstamos (prestamos_categoria.json ausente o inválido).</span>
        </div>
      )}

      {selected && (
        <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Categoría seleccionada: <strong style={{ color: "var(--fg)" }}>{selected.categoria}</strong>
          </span>
          <button
            onClick={handleClear}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <RotateCcw size={12} /> Cambiar
          </button>
        </div>
      )}

      {!selected && (
        <div style={{ marginBottom: "1rem" }}>
          <Input
            id="buscar"
            label="Buscar categoría"
            value={query}
            onChange={(e) => { setQuery(e.target.value) }}
            placeholder="Ej: 08, 02, auxiliar, enfermera..."
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          {!selected && (
            <>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", margin: "0 0 0.5rem" }}>
                {filtered.length} categoría{filtered.length !== 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "500px", overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", padding: "1rem" }}>
                    No se encontraron categorías
                  </p>
                ) : (
                  filtered.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(r)}
                      style={{
                        textAlign: "left", background: "var(--card)",
                        color: "var(--fg)",
                        border: `1px solid var(--border)`,
                        borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem",
                        cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, transition: "all var(--transition)",
                      }}
                    >
                      <span>{r.categoria}</span>
                      {r.descripcionTC && (
                        <span style={{ display: "block", fontSize: "0.6875rem", opacity: 0.8, marginTop: "0.125rem" }}>{r.descripcionTC}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div>
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Card padding="1rem">
                <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.5rem" }}>{selected.categoria}</p>
                {selected.descripcionTC && <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>{selected.descripcionTC}</p>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
                  {selected.sueldoPlaza !== undefined && <InfoRow label="Sueldo plaza" value={formatCurrency(selected.sueldoPlaza)} />}
                  {selected.sueldoQuincenal !== undefined && <InfoRow label="Sueldo quincenal" value={formatCurrency(selected.sueldoQuincenal)} />}
                  {selected.concepto011 !== undefined && <InfoRow label="Concepto 011" value={formatCurrency(selected.concepto011)} />}
                  {selected.smtabMas011 !== undefined && <InfoRow label="SMTAB + 011" value={formatCurrency(selected.smtabMas011)} />}
                  {selected.smi !== undefined && <InfoRow label="SMI" value={formatCurrency(selected.smi)} />}
                </div>
              </Card>

              <form action={saveAction}>
                <input type="hidden" name="categoria" value={selected.categoria} />
                <Button
                  type="submit"
                  variant={saved || saveState?.ok ? "secondary" : "primary"}
                  size="sm"
                  loading={savePending}
                  disabled={saved || saveState?.ok || savePending}
                  style={{ width: "100%" }}
                >
                  {saved || saveState?.ok ? (
                    <><Check size={14} /> Guardado en perfil</>
                  ) : (
                    "Guardar categoría en mi perfil"
                  )}
                </Button>
                {saveState?.error && (
                  <p style={{ fontSize: "0.75rem", color: "var(--primary)", margin: "0.375rem 0 0" }}>{saveState.error}</p>
                )}
              </form>

              {selectedCalculos.map((c, i) => (
                <Card key={i} padding="0.875rem">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0 }}>{c.modalidad}</p>
                      <p style={{ fontSize: "0.6875rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>{c.formula}</p>
                    </div>
                    <p style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--primary)" }}>{formatCurrency(c.valor)}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ background: "var(--accent)", borderRadius: "var(--radius-sm)", padding: "2rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
              <p style={{ margin: 0 }}>Selecciona una categoría para ver sus préstamos</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <CalculatorDisclaimer />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
