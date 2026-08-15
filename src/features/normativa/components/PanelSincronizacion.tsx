"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { RefreshCw, AlertTriangle, Download } from "lucide-react"

interface SyncSource {
  id: string
  title: string
  category: string
  priority: string
  type: string
  hasUrl: boolean
  discoveryRequired: boolean
  state: string
  blocked: boolean
  retryAfter: string | null
  lastError: string | null
  attempts: number
  hasVersion: boolean
  versionLabel: string | null
  pages: number | null
  chunks: number
  needsOcr: boolean
}

interface SyncStatus {
  job: { running: boolean; done: number; total: number; current: string | null; recentLog: string[]; startedAt: string | null } | null
  summary: { total: number; hasVersion: number; blocked: number; needsDiscovery: number; needsOcr: number; errored: number; retryable: string[] }
  sources: SyncSource[]
}

const STATE_ICON: Record<string, string> = {
  AVAILABLE: "🟢",
  TEMPORARY_BLOCK: "🟠",
  HTTP_403: "🔴",
  WAF_BLOCK: "🛡️",
  NOT_FOUND: "❓",
  MANUAL_REVIEW: "🧑‍💻",
  RETRY_AFTER: "⏳",
}

const STATE_LABEL: Record<string, string> = {
  AVAILABLE: "disponible",
  TEMPORARY_BLOCK: "bloqueo temporal",
  HTTP_403: "HTTP 403",
  WAF_BLOCK: "bloqueada por WAF",
  NOT_FOUND: "no encontrada",
  MANUAL_REVIEW: "requiere revisión",
  RETRY_AFTER: "reintento programado",
}

export function PanelSincronizacion() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<"todos" | "pendientes">("pendientes")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/normativa/sync")
      const data = await res.json()
      if (res.ok) setStatus(data)
      else setError(data.error ?? "Error al leer el estado")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await load()
    })()
    pollRef.current = setInterval(() => {
      void load()
    }, 6000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const trigger = async (action: string, ids?: string[]) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/normativa/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "No se pudo iniciar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setBusy(false)
    }
  }

  const s = status?.summary
  const pending = status?.sources.filter((x) => !x.hasVersion || x.needsOcr) ?? []
  const shown = filter === "pendientes" ? pending : (status?.sources ?? [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <RefreshCw size={17} color="var(--primary)" /> Estado de sincronización
        </h2>
        {s && (
          <p style={{ fontSize: "0.9rem", margin: "0.5rem 0 0" }}>
            <strong>{s.hasVersion}/{s.total}</strong> fuentes disponibles ·{" "}
            <span style={{ color: "#b45309" }}>{s.blocked} bloqueadas temporalmente</span> ·{" "}
            <span style={{ color: "#1d4ed8" }}>{s.needsDiscovery} requieren descubrimiento</span> ·{" "}
            <span style={{ color: "#9333ea" }}>{s.needsOcr} requieren OCR</span>
            {s.errored > 0 ? ` · ${s.errored} con error` : ""}
          </p>
        )}

        {status?.job?.running && (
          <div style={{ marginTop: "0.6rem", padding: "0.6rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "var(--radius)", fontSize: "0.82rem" }}>
            <strong>Sincronizando…</strong> {status.job.done}/{status.job.total}
            {status.job.current ? ` — ahora: ${status.job.current}` : ""}
            <div style={{ marginTop: "0.3rem", maxHeight: 120, overflowY: "auto", color: "var(--muted)", fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>
              {status.job.recentLog.slice(-6).join("\n")}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <button disabled={busy || !!status?.job?.running} onClick={() => trigger("retry")} style={primaryBtn}>
            <Download size={15} /> Reintentar fallidas ({s?.retryable.length ?? 0})
          </button>
          <button disabled={busy || !!status?.job?.running} onClick={() => trigger("update")} style={secondaryBtn}>
            <RefreshCw size={15} /> Actualizar corpus
          </button>
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: "0.82rem", margin: "0.4rem 0 0" }}>{error}</p>}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={() => setFilter("pendientes")} style={filter === "pendientes" ? activeTab : tab}>
          Pendientes ({pending.length})
        </button>
        <button onClick={() => setFilter("todos")} style={filter === "todos" ? activeTab : tab}>
          Ver todas ({status?.sources.length ?? 0})
        </button>
        {status && pending.length === 0 && <span style={{ fontSize: "0.82rem", color: "#15803d" }}>✓ Todas las fuentes disponibles</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {shown.map((src) => (
          <div key={src.id} style={{ ...card, padding: "0.75rem 0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem" }}>
                {src.hasVersion && !src.needsOcr ? "✅" : STATE_ICON[src.state] ?? "⬜"}{" "}
                <strong>{src.title.slice(0, 80)}</strong>
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{src.id}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              {src.hasVersion && <span>v{src.versionLabel} · {src.pages} págs · {src.chunks} chunks</span>}
              {src.needsOcr && <span style={{ color: "#9333ea" }}>requiere OCR</span>}
              {src.blocked && (
                <span style={{ color: "#b45309" }}>
                  {STATE_LABEL[src.state] ?? src.state}
                  {src.retryAfter ? ` · reintento: ${new Date(src.retryAfter).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              )}
              {src.discoveryRequired && !src.hasVersion && <span style={{ color: "#1d4ed8" }}>requiere descubrimiento de URL oficial</span>}
              {src.lastError && !src.hasVersion && <span style={{ color: "#b91c1c" }}>{src.lastError.slice(0, 120)}</span>}
            </div>
            {!src.hasVersion && !src.discoveryRequired && (
              <button
                disabled={busy || !!status?.job?.running}
                onClick={() => trigger("retry", [src.id])}
                style={{ marginTop: "0.4rem", ...secondaryBtn, padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
              >
                Reintentar ahora
              </button>
            )}
            {src.discoveryRequired && (
              <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "#92400e", display: "flex", gap: "0.3rem", alignItems: "flex-start" }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                Buscar el original oficial en dominios permitidos antes de integrarlo (validación de clave y título obligatoria).
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem",
}
const primaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.85rem",
}
const secondaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.85rem", cursor: "pointer",
}
const tab: CSSProperties = { padding: "0.35rem 0.7rem", borderRadius: 999, border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: "0.8rem" }
const activeTab: CSSProperties = { ...tab, background: "var(--primary)", color: "var(--primary-fg)", borderColor: "var(--primary)" }
