"use client"

import { useState, useMemo } from "react"
import { Input } from "@/shared/components/ui/Input"
import { normalizeSearch, mapJsonToPrestamoRecord } from "../lib/prestamos"
import type { PrestamoCategoriaRecord } from "../lib/types"
import prestamosRaw from "../data/prestamos_categoria.json"

interface Props {
  initialCategory?: string | null
  onSelect: (record: PrestamoCategoriaRecord) => void
}

export function CategorySelector({ initialCategory, onSelect }: Props) {
  const [query, setQuery] = useState(initialCategory ?? "")
  const [selected, setSelected] = useState<PrestamoCategoriaRecord | null>(null)

  const records = useMemo(() => {
    const raw = prestamosRaw as Record<string, unknown>[]
    return raw.map(mapJsonToPrestamoRecord)
  }, [])

  const filtered = useMemo(() => {
    if (!query) return []
    const norm = normalizeSearch(query)
    return records
      .map((r) => ({
        record: r,
        score: normalizeSearch(r.categoria).includes(norm) ? 1 : 0,
      }))
      .filter((r) => r.score > 0 || r.record.categoria.toLowerCase().includes(query.toLowerCase()))
      .map((r) => r.record)
      .slice(0, 10)
  }, [records, query])

  const handleSelect = (r: PrestamoCategoriaRecord) => {
    setSelected(r)
    setQuery(r.categoria)
    onSelect(r)
  }

  return (
    <div>
      <Input
        id="categoria"
        label="Categoría"
        value={selected ? selected.categoria : query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (selected) {
            setSelected(null)
          }
        }}
        placeholder="Escribe para buscar..."
      />
      {!selected && query.length >= 2 && filtered.length > 0 && (
        <div style={{
          marginTop: "0.25rem", background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", maxHeight: "200px", overflowY: "auto",
        }}>
          {filtered.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem", border: "none", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                background: "transparent", cursor: "pointer", color: "var(--fg)",
              }}
            >
              {r.categoria}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
