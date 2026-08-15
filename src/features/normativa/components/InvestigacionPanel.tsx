"use client"

import { useState, type CSSProperties } from "react"
import { Radio, FileSearch, AlertTriangle } from "lucide-react"
import type { EpisodeEvidencePack } from "@/features/normativa/core/types"

interface EvidenceResponse {
  evidencePack: EpisodeEvidencePack
  coverage?: CoverageData
  summary: { documents: number; relevantChunks: number; verifiedClaims: number; conflicts: number }
}

interface CoverageData {
  topic: string
  items: Array<{ id: string; label: string; status: "available" | "unavailable" | "review"; note?: string }>
  available: number
  total: number
  coverage: number
  critical: Array<{ id: string; label: string }>
  recommended: boolean
  warnings: string[]
}

interface ScriptLine {
  locutor: string
  linea: string
  citas: string[]
}

interface ScriptResponse {
  script: { titulo: string; escenas: ScriptLine[] }
  citationIndex: Record<string, { documentId: string; pdfPage: number | null; clause: string | null; article: string | null }>
  verification: Array<{ locutor: string; linea: string; type: string; semaforo: "green" | "yellow" | "red" | "none"; note?: string }>
  semaforo: { green: number; yellow: number; red: number }
  bloqueado: boolean
  provider?: string | null
  fichaFuentes: { cutoff: string; documents: Array<{ id: string; title: string; versionLabel: string; sha256: string }>; generatedAt: string }
}

interface Props {
  initialTopic?: string
}

export function InvestigacionPanel({ initialTopic }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? "")
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null)
  const [script, setScript] = useState<ScriptResponse | null>(null)
  const [loading, setLoading] = useState<"none" | "investigating" | "writing" | "audio">("none")
  const [error, setError] = useState<string | null>(null)

  const investigate = async () => {
    if (!topic.trim()) return
    setLoading("investigating")
    setError(null)
    setScript(null)
    try {
      const res = await fetch("/api/normativa/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al investigar")
        return
      }
      setEvidence(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading("none")
    }
  }

  const createScript = async () => {
    if (!evidence) return
    setLoading("writing")
    setError(null)
    try {
      const res = await fetch("/api/normativa/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), evidencePack: evidence.evidencePack }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al generar el guion")
        return
      }
      setScript(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading("none")
    }
  }

  const generateAudio = async () => {
    if (!script) return
    setLoading("audio")
    setError(null)
    try {
      const res = await fetch("/api/normativa/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escenas: script.script.escenas.map((s) => ({ locutor: s.locutor, linea: s.linea })) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Error al generar el audio")
        return
      }
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "episodio-la-veinte.mp3"
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading("none")
    }
  }

  const downloadFicha = () => {
    if (!script) return
    const lines = [
      "<!doctype html><html lang='es'><head><meta charset='utf-8'><title>Ficha de fuentes</title>",
      "<style>body{font-family:sans-serif;max-width:760px;margin:2rem auto;line-height:1.5}",
      "code{background:#f1f5f9;padding:0.1rem 0.3rem;border-radius:4px;font-size:.85rem}</style></head><body>",
      `<h1>Fuentes y fundamento — ${escapeHtml(script.script.titulo || topic)}</h1>`,
      `<p>Fecha de corte: ${escapeHtml(script.fichaFuentes.cutoff)} · Generado: ${escapeHtml(script.fichaFuentes.generatedAt)}</p>`,
      "<h2>Documentos utilizados</h2><ol>",
      ...script.fichaFuentes.documents.map(
        (d) => `<li>${escapeHtml(d.title)} — versión ${escapeHtml(d.versionLabel)} — SHA-256 <code>${escapeHtml(d.sha256)}</code></li>`
      ),
      "</ol>",
      "<h2>Aviso editorial</h2>",
      "<p>Contenido informativo elaborado a partir de las fuentes indicadas. La aplicación conserva la versión documental utilizada y la fecha de corte. Los casos individuales pueden requerir revisión específica.</p>",
      "</body></html>",
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/html;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "fuentes-episodio.html"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Radio size={17} color="var(--primary)" /> Nuevo episodio
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
          TEMA → INVESTIGAR EN CORPUS → PAQUETE DE EVIDENCIA → MATRIZ DE AFIRMACIONES → GUION → VERIFICACIÓN
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && investigate()}
            placeholder="Tema: ej. “Me pueden cambiar mi horario?”"
            style={inputStyle}
          />
          <button onClick={investigate} disabled={loading !== "none" || !topic.trim()} style={primaryBtn}>
            <FileSearch size={16} /> {loading === "investigating" ? "Investigando…" : "INVESTIGAR"}
          </button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
          <input type="checkbox" defaultChecked readOnly disabled /> 🔒 Solo corpus documental (recomendado para IMSS/SNTSS)
        </label>
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{error}</p>}

      {evidence && (
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Resultado de la investigación</div>
          <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}>
            Encontré: {evidence.summary.documents} documentos · {evidence.summary.relevantChunks} fragmentos relevantes ·{" "}
            {evidence.summary.verifiedClaims} afirmaciones verificables · {evidence.summary.conflicts} conflictos graves
          </p>

          {evidence.coverage && (
            <div style={{ margin: "0.5rem 0", padding: "0.7rem", background: evidence.coverage.recommended ? "#f0fdf4" : "#fffbeb", border: `1px solid ${evidence.coverage.recommended ? "#bbf7d0" : "#fde68a"}`, borderRadius: "var(--radius)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                Cobertura documental: {evidence.coverage.coverage}%
              </div>
              {evidence.coverage.items.map((it) => (
                <div key={it.id} style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                  {it.status === "available" ? "🟢" : it.status === "review" ? "🟡" : "🔴"} {it.label}
                  {it.note ? <span style={{ color: "var(--muted)" }}> — {it.note}</span> : null}
                </div>
              ))}
              {evidence.coverage.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: "0.76rem", color: "#92400e", marginTop: "0.35rem" }}>⚠️ {w}</div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
            {evidence.evidencePack.documents.map((d) => (
              <span key={d.id} style={docBadge}>
                {d.title.slice(0, 55)}{d.lastReformDate ? ` · ${d.lastReformDate}` : ""}
              </span>
            ))}
          </div>

          <details>
            <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>MATRIZ DE AFIRMACIONES ({evidence.evidencePack.claims.length})</summary>
            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 300, overflowY: "auto" }}>
              {evidence.evidencePack.claims.map((c) => (
                <div key={c.id} style={{ fontSize: "0.78rem", padding: "0.45rem 0.6rem", background: "var(--accent)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.id} · {c.state === "VERIFIED" ? "🟢 VERIFIED" : "🔴 " + c.state} · {c.type}
                  </div>
                  <div style={{ color: "var(--muted)" }}>{c.text.slice(0, 260)}</div>
                  {c.evidence[0] && (
                    <div style={{ fontSize: "0.72rem" }}>
                      Fuente: {c.evidence[0].documentId}
                      {c.evidence[0].clause ? ` · Cláusula ${c.evidence[0].clause}` : ""}
                      {c.evidence[0].article ? ` · Artículo ${c.evidence[0].article}` : ""}
                      {c.evidence[0].pdfPage != null ? ` · pág. ${c.evidence[0].pdfPage}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>

          <button onClick={createScript} disabled={loading !== "none"} style={{ ...primaryBtn, marginTop: "0.75rem" }}>
            <Radio size={16} /> {loading === "writing" ? "Escribiendo guion…" : "CREAR GUION FUNDAMENTADO"}
          </button>
        </div>
      )}

      {script && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{script.script.titulo || topic}</div>
          <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ ...semBadge, color: "#15803d" }}>🟢 sustentado: {script.semaforo.green}</span>
            <span style={{ ...semBadge, color: "#b45309" }}>🟡 interpretación/contexto: {script.semaforo.yellow}</span>
            <span style={{ ...semBadge, color: "#b91c1c" }}>🔴 sin sustento: {script.semaforo.red}</span>
          </div>

          {script.bloqueado && (
            <div style={{ marginTop: "0.6rem", padding: "0.6rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius)", fontSize: "0.82rem", color: "#991b1b", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Este guion contiene afirmaciones normativas sin fundamento suficiente. Corrige las líneas en rojo antes de marcar el episodio como documentalmente verificado.
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
            <button onClick={generateAudio} disabled={loading !== "none"} style={primaryBtn}>
              🎙 {loading === "audio" ? "Generando MP3…" : "Generar voces (MP3)"}
            </button>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", alignSelf: "center" }}>
              {script.provider ? `Guion: ${script.provider}` : "Guion: solo corpus documental (sin LLM)"} · voces es-MX neurales
            </span>
          </div>

          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {script.script.escenas.map((s, i) => {
              const v = script.verification[i]
              const dot = v?.semaforo === "red" ? "🔴" : v?.semaforo === "yellow" ? "🟡" : v?.semaforo === "green" ? "🟢" : "•"
              return (
                <div key={i} style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--muted)" }}>{dot} {s.locutor}</div>
                  <div>“{s.linea}”</div>
                  {s.citas.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.3rem" }}>
                      {s.citas.map((cid) => {
                        const ref = script.citationIndex[cid]
                        return (
                          <button key={cid} style={citeBtn} title="Ver fundamento">
                            📚 {ref ? `${ref.documentId}${ref.clause ? ` Cl. ${ref.clause}` : ""}${ref.article ? ` Art. ${ref.article}` : ""}${ref.pdfPage != null ? ` pág. ${ref.pdfPage}` : ""}` : cid}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {v?.semaforo === "red" && v.note && (
                    <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.2rem" }}>{v.note}</div>
                  )}
                </div>
              )
            })}
          </div>

          <details style={{ marginTop: "0.75rem" }}>
            <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>FUENTES Y FUNDAMENTO DEL EPISODIO</summary>
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              <p style={{ margin: "0 0 0.5rem" }}>Fecha de corte: {script.fichaFuentes.cutoff} · Generado: {script.fichaFuentes.generatedAt}</p>
              {script.fichaFuentes.documents.map((d, i) => (
                <div key={d.id} style={{ marginBottom: "0.4rem" }}>
                  {i + 1}. {d.title} — versión {d.versionLabel} — SHA-256 {d.sha256.slice(0, 16)}…
                </div>
              ))}
              <button onClick={downloadFicha} style={{ ...secondaryBtn, marginTop: "0.5rem" }}>
                DESCARGAR FUENTES DE ESTE CAPÍTULO
              </button>
              <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                Contenido informativo elaborado a partir de las fuentes indicadas. La aplicación conserva la versión documental utilizada y la fecha de corte. Los casos individuales pueden requerir revisión específica.
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

const card: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem",
}
const inputStyle: CSSProperties = {
  flex: 1, padding: "0.6rem 0.8rem", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)", fontSize: "0.9rem",
}
const primaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.875rem",
}
const docBadge: CSSProperties = { padding: "0.3rem 0.6rem", background: "var(--accent)", borderRadius: 999, fontSize: "0.75rem" }
const semBadge: CSSProperties = { padding: "0.25rem 0.6rem", background: "var(--accent)", borderRadius: 999 }
const citeBtn: CSSProperties = {
  fontSize: "0.7rem", padding: "0.25rem 0.55rem", borderRadius: 999,
  background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", cursor: "pointer",
}
const secondaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.8rem", cursor: "pointer",
}
