"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Mic2, RefreshCw, Play, BatteryWarning, TriangleAlert } from "lucide-react"

interface GpuSnap {
  name: string | null
  driver: string | null
  vramTotalMb: number | null
  vramUsedMb: number | null
  vramFreeMb: number | null
  tempC: number | null
  gpuUtil: number | null
  powerW: number | null
}

interface TtsStatus {
  hardware: {
    profile: string
    cpu: string
    ramTotalGb: number
    ramFreeGb: number
    diskFreeGb: number | null
    gpu: GpuSnap
    isBattery: boolean
  }
  config: { preset: string; devicePriority: string; concurrency: number; chunkTargetMin: number; chunkTargetMax: number }
  benchmark: {
    meanRtf: number
    peakVramMb: number
    peakRamGb: number
    peakTempC: number
    throttlingSuspect: boolean
    estimates: Record<string, number>
    warmup: { load_s?: number }
  } | null
  engine: {
    running: boolean
    cache: { hits: number; misses: number; entries: number }
    status: { loaded?: boolean; device?: string; cuda?: boolean; gpu?: string | null; torch?: string | null; peakVramMb?: number; ramUsedGb?: number; gpuTempC?: number | null; lastError?: string | null } | null
    warningLowVram: string | null
    batteryWarning: string | null
  }
}

export function PanelTtsDiagnostico() {
  const [status, setStatus] = useState<TtsStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/normativa/tts")
      const data = await res.json()
      if (res.ok) setStatus(data)
      else setError(data.error ?? "Error al leer diagnóstico")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    }
  }, [])

  useEffect(() => {
    void (async () => { await load() })()
    const t = setInterval(() => { void load() }, 10000)
    return () => clearInterval(t)
  }, [load])

  const act = async (action: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/normativa/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Error")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setBusy(false)
    }
  }

  const hw = status?.hardware
  const bench = status?.benchmark
  const engine = status?.engine
  const cacheTotal = (engine?.cache.hits ?? 0) + (engine?.cache.misses ?? 0)
  const cachePct = cacheTotal > 0 ? Math.round(((engine?.cache.hits ?? 0) / cacheTotal) * 100) : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Mic2 size={17} color="var(--primary)" /> Diagnóstico TTS
        </h2>

        {hw && (
          <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }}>
            <div>
              <div style={labelStyle}>Equipo</div>
              <div style={monoStyle}>
                CPU: {hw.cpu}<br />
                RAM: {hw.ramTotalGb} GB ({hw.ramFreeGb} GB libres)<br />
                GPU: {hw.gpu.name ?? "no detectada"}<br />
                VRAM dedicada: {hw.gpu.vramTotalMb ? `${(hw.gpu.vramTotalMb / 1024).toFixed(1)} GB` : "n/d"}
                {hw.gpu.vramFreeMb != null ? ` · libre ${(hw.gpu.vramFreeMb / 1024).toFixed(1)} GB` : ""}<br />
                Memoria compartida posible: no se cuenta como VRAM<br />
                Disco libre: {hw.diskFreeGb ?? "n/d"} GB<br />
                CUDA: {engine?.status?.cuda ? "✅ Disponible" : "❌ No disponible"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Motor</div>
              <div style={monoStyle}>
                Motor: Chatterbox LatAm (es-MX)<br />
                Estado: {engine?.running ? "🟢 Listo" : "⚪ Apagado"}<br />
                Perfil: {hw.profile}<br />
                Preset: {status?.config.preset} · concurrency {status?.config.concurrency}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Generación (benchmark real)</div>
              <div style={monoStyle}>
                RTF: {bench ? bench.meanRtf.toFixed(2) : "—"}<br />
                VRAM pico: {bench ? `${bench.peakVramMb} MB` : "—"}<br />
                Temperatura máx: {bench ? `${bench.peakTempC} °C` : "—"}<br />
                Cache: {cachePct != null ? `${cachePct}% (${engine?.cache.hits} hits / ${cachePct === 100 ? 0 : engine?.cache.misses} generados)` : "—"}<br />
                Último error: {engine?.status?.lastError ?? "Ninguno"}
              </div>
            </div>
          </div>
        )}

        {bench?.throttlingSuspect && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.5rem" }}>
            ⚠ Posible thermal throttling: la velocidad decayó hacia el final del benchmark (los primeros bloques fueron más rápidos que los últimos).
          </div>
        )}

        {engine?.warningLowVram && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--muted)", background: "var(--accent)", borderRadius: "var(--radius)", padding: "0.5rem" }}>
            ℹ️ {engine.warningLowVram}
          </div>
        )}
        {engine?.batteryWarning && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.5rem", display: "flex", gap: "0.4rem" }}>
            <BatteryWarning size={15} style={{ flexShrink: 0 }} /> {engine.batteryWarning}
          </div>
        )}

        {bench && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.82rem" }}>
            Velocidad estimada (según benchmark en esta computadora):
            {Object.entries(bench.estimates).map(([k, v]) => (
              <span key={k} style={{ marginLeft: "0.8rem" }}><strong>{k}</strong>: ~{v} min</span>
            ))}
            <div style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>Estimación basada en esta computadora. No es una promesa exacta.</div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {!engine?.running ? (
            <button onClick={() => act("start")} disabled={busy} style={primaryBtn}>
              <Play size={15} /> Iniciar motor Chatterbox
            </button>
          ) : (
            <button onClick={() => act("restart")} disabled={busy} style={secondaryBtn}>
              <RefreshCw size={15} /> REINICIAR MOTOR TTS
            </button>
          )}
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: "0.82rem", marginTop: "0.5rem" }}>{error}</p>}
      </div>

      <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb" }}>
        <div style={{ fontSize: "0.8rem", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
          <TriangleAlert size={15} style={{ flexShrink: 0, marginTop: 1, color: "#92400e" }} />
          <span>
            Chatterbox se ejecuta localmente (costo API $0, funciona offline). El motor permanece cargado durante la sesión y usa caché por bloque: corregir una frase solo regenera esa frase. Si otro programa ocupa la GPU, cierra aplicaciones con aceleración gráfica o usa CPU.
          </span>
        </div>
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem",
}
const labelStyle: CSSProperties = { fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.3rem" }
const monoStyle: CSSProperties = { fontSize: "0.8rem", lineHeight: 1.6 }
const primaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--primary)", color: "var(--primary-fg)", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", fontSize: "0.85rem",
}
const secondaryBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem",
  background: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.85rem", cursor: "pointer",
}
