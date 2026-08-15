"use client"

import { useState, type CSSProperties } from "react"
import { Search, FileText } from "lucide-react"
import type { SearchHit } from "@/features/normativa/core/types"

interface CoverageData {
  topic: string
  items: Array<{ id: string; label: string; status: "available" | "unavailable" | "review"; note?: string }>
  coverage: number
  recommended: boolean
  warnings: string[]
}

interface RespuestaData {
  query: string
  respuesta: string
  provider: string | null
  deterministicOnly: boolean
  coverage: CoverageData
  hits: Array<{ documentId: string; documentTitle: string; clause: string | null; article: string | null; pdfPageIndex: number | null }>
}

interface Props {
  onCrearEpisodio: (topic: string) => void
}

export function BusquedaNormativa({ onCrearEpisodio }: Props) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [respuesta, setRespuesta] = useState<RespuestaData | null>(null)
  const [loading, setLoading] = useState<"none" | "searching" | "answering">("none")
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!query.trim()) return
    setLoading("searching")
    setError(null)
    setRespuesta(null)
    try {
      const res = await fetch("/api/normativa/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error en la búsqueda")
        return
      }
      setHits(data.hits ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading("none")
    }
  }

  const responder = async () => {
    if (!query.trim()) return
    setLoading("answering")
    setError(null)
    try {
      const res = await fetch("/api/normativa/respuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al responder")
        return
      }
      setRespuesta(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading("none")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="¿Qué quieres saber? ej. ¿quién autoriza mi tiempo extra?"
          style={inputStyle}
        />
        <button onClick={run} disabled={loading !== "none"} style={searchBtn}>
          <Search size={16} /> {loading === "searching" ? "Buscando…" : "Buscar"}
        </button>
        <button onClick={responder} disabled={loading !== "none"} style={answerBtn}>
          <FileText size={16} /> {loading === "answering" ? "Respondiendo…" : "Respuesta documental"}
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{error}</p>}

      {respuesta && (
        <div style={hitStyle}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ ...badge, background: "#eff6ff", color: "#1d4ed8" }}>
              {respuesta.deterministicOnly ? "🔒 Solo corpus documental" : `Proveedor: ${respuesta.provider}`}
            </span>
            <span style={{ ...badge, color: respuesta.coverage.recommended ? "#15803d" : "#b45309", background: respuesta.coverage.recommended ? "#dcfce7" : "#fef3c7" }}>
              Cobertura documental: {respuesta.coverage.coverage}%
            </span>
            <button
              onClick={() => onCrearEpisodio(query.trim())}
              style={{ ...badge, background: "var(--primary)", color: "var(--primary-fg)", border: "none", cursor: "pointer" }}
            >
              🎙 Crear episodio sobre este tema
            </button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", lineHeight: 1.55 }}>{respuesta.respuesta}</div>
          {respuesta.coverage.warnings.length > 0 && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.5rem" }}>
              ⚠️ {respuesta.coverage.warnings.join(" ")}
            </div>
          )}
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            Documentos citados: {respuesta.hits.map((h) => `${h.documentTitle}${h.clause ? ` (${h.clause})` : ""}${h.article ? ` (Art. ${h.article})` : ""}${h.pdfPageIndex != null ? ` pág.${h.pdfPageIndex}` : ""}`).join(" · ")}
          </div>
        </div>
      )}

      {hits && !respuesta && (
        <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
          {hits.length === 0
            ? "Sin resultados. No puedo fundamentar esa consulta con el corpus."
            : `${hits.length} fragmentos con fundamento documental:`}
        </p>
      )}

      {hits && !respuesta && hits.map((h, i) => (
        <div key={`${h.chunkId}-${i}`} style={hitStyle}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
            <span style={{ fontWeight: 700 }}>{h.documentTitle}</span>
            <span style={badge}>{h.validity}</span>
            {h.clause && <span style={badge}>Cláusula {h.clause}</span>}
            {h.article && <span style={badge}>Artículo {h.article}</span>}
            {h.pdfPageIndex != null && <span style={badge}>Pág. PDF {h.pdfPageIndex}</span>}
            {h.printedPage && <span style={badge}>Pág. impresa {h.printedPage}</span>}
            {h.section && <span style={badge}>{h.section}</span>}
          </div>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
            …{h.snippet.replace(/\[|\]/g, "")}…
          </p>
        </div>
      ))}
    </div>
  )
}

const inputStyle: CSSProperties = {
  flex: 1, padding: "0.6rem 0.8rem", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", fontSize: "0.9rem",
}
const searchBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.875rem",
}
const answerBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1rem",
  background: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.875rem",
}
const hitStyle: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.85rem",
}
const badge: CSSProperties = { padding: "0.1rem 0.5rem", background: "var(--accent)", borderRadius: 999, fontSize: "0.72rem" }
