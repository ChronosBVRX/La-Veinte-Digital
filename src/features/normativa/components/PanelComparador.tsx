"use client"

import { useState, type CSSProperties } from "react"
import { GitCompareArrows, Radio } from "lucide-react"

interface ClauseCompare {
  clause: string
  textA: string
  textB: string
  changedNumbers: Array<{ before: number | null; after: number | null }>
  diffScore: number
}

interface CctCompareReport {
  fromId: string
  toId: string
  fromLabel: string
  toLabel: string
  clausesA: number
  clausesB: number
  added: string[]
  removed: string[]
  modified: ClauseCompare[]
  unchanged: string[]
  blocksAdded: string[]
  blocksRemoved: string[]
}

const EDITIONS = [
  { id: "CCT-IMSS-SNTSS-2025-2027", label: "2025-2027 (vigente)" },
  { id: "CCT-IMSS-SNTSS-2023-2025", label: "2023-2025" },
  { id: "CCT-IMSS-SNTSS-2021-2023", label: "2021-2023" },
  { id: "CCT-IMSS-SNTSS-2019-2021", label: "2019-2021" },
  { id: "CCT-IMSS-SNTSS-2017-2019", label: "2017-2019" },
  { id: "CCT-IMSS-SNTSS-2015-2017", label: "2015-2017" },
  { id: "CCT-IMSS-SNTSS-2013-2015", label: "2013-2015" },
]

export function PanelComparador() {
  const [fromId, setFromId] = useState("CCT-IMSS-SNTSS-2023-2025")
  const [toId, setToId] = useState("CCT-IMSS-SNTSS-2025-2027")
  const [report, setReport] = useState<CctCompareReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyNumeric, setOnlyNumeric] = useState(false)

  const compare = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/normativa/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al comparar")
        return
      }
      setReport(data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading(false)
    }
  }

  const modified = onlyNumeric ? (report?.modified.filter((m) => m.changedNumbers.length > 0) ?? []) : (report?.modified ?? [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <GitCompareArrows size={17} color="var(--primary)" /> Comparador de CCT
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.3rem 0 0.6rem" }}>
          Comparación documental entre ediciones del Contrato Colectivo. Las cifras se extraen del texto original de cada edición.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Desde
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={selectStyle}>
              {EDITIONS.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Hasta
            <select value={toId} onChange={(e) => setToId(e.target.value)} style={selectStyle}>
              {EDITIONS.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
          <button onClick={compare} disabled={loading || fromId === toId} style={primaryBtn}>
            <GitCompareArrows size={15} /> {loading ? "Comparando…" : "Comparar"}
          </button>
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: "0.82rem", marginTop: "0.5rem" }}>{error}</p>}
      </div>

      {report && (
        <>
          <div style={card}>
            <strong>
              {report.fromLabel} → {report.toLabel}
            </strong>
            <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.5rem", flexWrap: "wrap", fontSize: "0.88rem" }}>
              <span style={badgeGreen}>＋ añadidas: {report.added.length}</span>
              <span style={badgeRed}>－ eliminadas: {report.removed.length}</span>
              <span style={badgeAmber}>✎ modificadas: {report.modified.length}</span>
              <span style={badgeGray}>＝ sin cambios: {report.unchanged.length}</span>
              {report.modified.filter((m) => m.changedNumbers.length > 0).length > 0 && (
                <span style={badgeBlue}># con cifras cambiadas: {report.modified.filter((m) => m.changedNumbers.length > 0).length}</span>
              )}
            </div>
            {(report.blocksAdded.length > 0 || report.blocksRemoved.length > 0) && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                {report.blocksAdded.length > 0 && <div>Reglamentos/convenios nuevos: {report.blocksAdded.join(" · ")}</div>}
                {report.blocksRemoved.length > 0 && <div>Reglamentos/convenios que ya no aparecen: {report.blocksRemoved.join(" · ")}</div>}
              </div>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            <input type="checkbox" checked={onlyNumeric} onChange={(e) => setOnlyNumeric(e.target.checked)} />
            Solo cláusulas con cambios de cifras/porcentajes
          </label>

          {report.added.length > 0 && (
            <details style={card}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>Cláusulas añadidas ({report.added.length})</summary>
              <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {report.added.map((c) => (
                  <span key={c} style={chipGreen}>{c}</span>
                ))}
              </div>
            </details>
          )}

          {report.removed.length > 0 && (
            <details style={card}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>Cláusulas eliminadas ({report.removed.length})</summary>
              <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {report.removed.map((c) => (
                  <span key={c} style={chipRed}>{c}</span>
                ))}
              </div>
            </details>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {modified.map((m) => (
              <div key={m.clause} style={card}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{m.clause}</div>
                {m.changedNumbers.length > 0 && (
                  <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {m.changedNumbers.map((n, i) => (
                      <span key={i} style={chipBlue}>
                        {n.before ?? "—"} → {n.after ?? "—"}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: "0.4rem", fontSize: "0.76rem", color: "var(--muted)", whiteSpace: "pre-wrap", maxHeight: 130, overflowY: "auto" }}>
                  <span style={{ color: "#b91c1c" }}>Antes:</span> {m.textA.slice(0, 400)}
                  {"\n"}
                  <span style={{ color: "#15803d" }}>Ahora:</span> {m.textB.slice(0, 400)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...card, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <div style={{ fontSize: "0.85rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <Radio size={15} color="#1d4ed8" />
              Con esta comparación puedes crear el episodio <strong>“¿Qué cambió realmente en nuestro nuevo Contrato Colectivo?”</strong> desde la pestaña “Investigar para episodio”, usando las cláusulas con cifras modificadas como evidencia.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const card: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem",
}
const selectStyle: CSSProperties = {
  padding: "0.45rem 0.6rem", borderRadius: "var(--radius)", border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--fg)", fontSize: "0.85rem", minWidth: 220,
}
const primaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.85rem",
}
const badgeGreen: CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, background: "#dcfce7", color: "#15803d" }
const badgeRed: CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, background: "#fee2e2", color: "#b91c1c" }
const badgeAmber: CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, background: "#fef3c7", color: "#92400e" }
const badgeGray: CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, background: "var(--accent)", color: "var(--muted)" }
const badgeBlue: CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8" }
const chipGreen: CSSProperties = { padding: "0.25rem 0.55rem", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: "0.78rem" }
const chipRed: CSSProperties = { padding: "0.25rem 0.55rem", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: "0.78rem" }
const chipBlue: CSSProperties = { padding: "0.25rem 0.55rem", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 600 }
