"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  type: "categoria" | "adscripcion"
}

export function CatalogSearch({ type }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ nombre: string }[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (value: string) => {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.rpc("search_catalogo", {
      catalogo_type: type,
      search_term: value,
    })
    setResults(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar..."
        style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
      />
      {loading && <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.5rem" }}>Buscando...</p>}
      {results.length > 0 && (
        <div style={{ marginTop: "0.5rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.375rem" }}>
          {results.map((r, i) => (
            <div key={i} style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem", borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none" }}>
              {r.nombre}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
