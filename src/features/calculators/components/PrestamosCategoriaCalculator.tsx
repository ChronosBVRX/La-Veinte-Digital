"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import { Input } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import { CalculatorDisclaimer } from "./CalculatorDisclaimer"
import { filterCategorias, calcularPrestamos, mapJsonToPrestamoRecord } from "../lib/prestamos"
import { formatCurrency } from "../lib/money"
import type { PrestamoCategoriaRecord } from "../lib/types"
import prestamosRaw from "../data/prestamos_categoria.json"

export function PrestamosCategoriaCalculator() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<PrestamoCategoriaRecord | null>(null)

  const records = useMemo(() => {
    const raw = prestamosRaw as Record<string, unknown>[]
    return raw.map(mapJsonToPrestamoRecord)
  }, [])

  const filtered = useMemo(() => filterCategorias(records, query), [records, query])

  const selectedCalculos = useMemo(() => {
    if (!selected) return []
    return calcularPrestamos(selected)
  }, [selected])

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Link href="/calculadoras" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "var(--primary)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Volver a calculadoras
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Préstamos por categoría</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
        Consulta montos de préstamos disponibles según tu categoría.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <Input
          id="buscar"
          label="Buscar categoría"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
          placeholder="Ej: 08, 02, auxiliar, enfermera..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
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
                  onClick={() => setSelected(r)}
                  style={{
                    textAlign: "left", background: selected?.categoria === r.categoria ? "var(--primary)" : "var(--card)",
                    color: selected?.categoria === r.categoria ? "var(--primary-fg)" : "var(--fg)",
                    border: `1px solid ${selected?.categoria === r.categoria ? "var(--primary)" : "var(--border)"}`,
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
                  {selected.smi !== undefined && <InfoRow label="SMI" value={formatCurrency(selected.smi)} />}
                </div>
              </Card>

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
