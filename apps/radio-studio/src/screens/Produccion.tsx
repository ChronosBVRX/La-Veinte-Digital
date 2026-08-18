import { useEffect, useState } from "react";
import { obtenerProgreso, cancelarProduccion, descartarProduccion, reanudarProduccion, masterPrograma, type ProgresoProduccion, type DialogueTurn, type MasterResult } from "../lib/studio-api";
import type { VoiceSlot } from "@la-veinte/radio-core";

export function Produccion() {
  const [p, setP] = useState<ProgresoProduccion | null>(null);
  const [, setTick] = useState(0);
  const [master, setMaster] = useState<MasterResult | null>(null);
  const [mezclando, setMezclando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbps, setKbps] = useState<128 | 192 | 256 | 320>(192);
  const [ducking, setDucking] = useState(true);
  const [bedGain, setBedGain] = useState(-25);
  const [bedDuck, setBedDuck] = useState(6);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const r = await obtenerProgreso();
      if (mounted && r) setP(r);
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1200);
    return () => clearInterval(t);
  }, []);

  const runMaster = async () => {
    setMezclando(true);
    setError(null);
    try {
      const raw = localStorage.getItem("studio:guion");
      if (!raw) throw new Error("no hay guion guardado");
      const d = JSON.parse(raw) as { script: { turns: DialogueTurn[]; speakers: Array<{ id: string; voz: VoiceSlot }> } };
      const voces: Record<string, VoiceSlot> = {};
      for (const s of d.script.speakers) voces[s.id] = s.voz;
      setMaster(await masterPrograma(d.script.turns, { voces, kbps, ducking, bedGainDb: bedGain, bedDuckDb: bedDuck }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al mezclar");
    } finally {
      setMezclando(false);
    }
  };

  const refrescar = async () => {
    const r = await obtenerProgreso();
    setP(r);
  };

  const pausar = async () => {
    setError(null);
    await cancelarProduccion();
    await refrescar();
  };

  const descartar = async () => {
    const ok = window.confirm("Esto detendrá la producción actual y la quitará de esta pantalla. El guion editable se conserva.");
    if (!ok) return;
    setDescartando(true);
    setError(null);
    try {
      await descartarProduccion();
      setP(null);
      setMaster(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la producción");
    } finally {
      setDescartando(false);
    }
  };

  // tick local para animar barras mientras el sidecar no reporta cambios
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1200);
    return () => clearInterval(t);
  }, []);

  const running = p?.running ?? false;
  const done = p?.done ?? 0;
  const total = p?.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const cache = p?.cacheHits ?? 0;
  const generadas = p?.generados ?? p?.generated ?? 0;
  const fallos = p?.fallos ?? 0;
  const temp = p?.gpu?.tempC ?? null;
  const vramUsada = p?.gpu?.vramUsadaMb ?? null;
  const vramTotal = p?.gpu?.vramTotalMb ?? null;
  const resumible = p?.estado === "INTERRUPTED" || p?.estado === "PAUSED";

  return (
    <div className="screen">
      <h1>Generar audio</h1>
      <div className="card">
        <div className="prod-title">{p?.tema ?? "Episodio actual"}</div>
        <div className="muted">La app está creando las voces y preparando el audio final.</div>

        <div className="bar" style={{ margin: "18px 0 6px" }}>
          <div className="bar-fill green" style={{ width: `${pct}%` }} />
        </div>
        <div className="muted small">{pct}% · {done}/{total} intervenciones {running ? "" : done > 0 ? "· voces listas" : ""}</div>

        <div className="prod-grid">
          {Object.entries(p?.porLocutor ?? {}).map(([loc, st]) => (
            <div className="prod-col" key={loc}>
              <div className="muted">{loc}</div>
              <div className="big">{st.hecho}/{st.total} intervenciones</div>
              <div className="bar">
                <div className={`bar-fill ${loc.toUpperCase().includes("MARIANA") ? "pink" : "blue"}`} style={{ width: `${st.total > 0 ? (st.hecho / st.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="prod-stats">
          <div><span className="big">{generadas}</span><span className="muted"> generadas ahora</span></div>
          <div><span className="big">{cache}</span><span className="muted"> encontradas en caché</span></div>
          <div><span className="big">{fallos}</span><span className="muted"> fallos</span></div>
        </div>

        <div className="prod-gpu">
          <span className="muted">Estado del equipo:</span> {temp != null ? `trabajando (${temp} °C)` : "preparando"}
          {vramUsada != null && <><span className="muted" style={{ marginLeft: 12 }}>Memoria de video:</span> {(vramUsada / 1024).toFixed(1)} / {((vramTotal ?? 4096) / 1024).toFixed(1)} GB</>}
          {p?.rtfChatterbox != null && <><span className="muted" style={{ marginLeft: 12 }}>Velocidad:</span> {p.rtfChatterbox.toFixed(2)}×</>}
          {p?.reiniciosWorker != null && p.reiniciosWorker > 0 && <><span className="muted" style={{ marginLeft: 12 }}>Reinicios worker:</span> {p.reiniciosWorker}</>}
        </div>

        {resumible && done > 0 && (
          <div className="master-ok" style={{ background: "#1e1b4b", borderColor: "#818cf8", color: "#c7d2fe" }}>
            Producción pausada ({done}/{total} intervenciones ya listas). Puedes continuar o eliminar esta generación.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn-primary" onClick={() => void reanudarProduccion()}>CONTINUAR DESDE AQUÍ</button>
              <button className="btn-danger" onClick={() => void descartar()} disabled={descartando}>
                {descartando ? "Eliminando…" : "DETENER Y ELIMINAR"}
              </button>
            </div>
          </div>
        )}

        {p?.tiempoRestanteMin != null && running && (
          <div className="muted small">Tiempo aproximado restante: {p.tiempoRestanteMin} min</div>
        )}
        {p?.etaMin != null && running && (
          <div className="muted small">
            Tiempo aproximado restante: <strong>~{p.etaMin} min</strong>
            {p.reiniciosPrevistos != null && p.reiniciosPrevistos > 0 ? ` · se hará una pausa técnica automática` : ""}
          </div>
        )}
        {master && (
          <div className="master-ok">
            Audio final listo: {master.master.split("\\").pop()} · {(master.bytes / 1024 / 1024).toFixed(1)} MB · {Math.round(master.duracionTotalMs / 1000)}s
            {master.bedUsada ? " · música de fondo" : ""}{master.jingleUsado ? " · intro/outro" : ""}
          </div>
        )}
        {error && <div className="error">{error}</div>}

        {!running && done > 0 && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="scene-title">Audio final</div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field">
                <span>Calidad del archivo</span>
                <select value={kbps} onChange={(e) => setKbps(Number(e.target.value) as 128 | 192 | 256 | 320)}>
                  <option value={128}>MP3 128 kbps</option>
                  <option value={192}>MP3 192 kbps (predeterminado)</option>
                  <option value={256}>MP3 256 kbps</option>
                  <option value={320}>MP3 320 kbps</option>
                </select>
              </label>
              <label className="check" style={{ marginTop: 18 }}>
                <input type="checkbox" checked={ducking} onChange={(e) => setDucking(e.target.checked)} />
                Bajar música cuando haya voz
              </label>
              <label className="field">
                <span>Música de fondo</span>
                <input type="number" value={bedGain} onChange={(e) => setBedGain(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Bajar durante voces</span>
                <input type="number" value={bedDuck} onChange={(e) => setBedDuck(Number(e.target.value))} />
              </label>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
          <button className="chip" onClick={() => { setBedGain(-25); setBedDuck(6); }}>Radio</button>
          <button className="chip" onClick={() => { setBedGain(-26); setBedDuck(6); }}>Podcast</button>
          <button className="chip" onClick={() => { setBedGain(-20); setBedDuck(5); }}>Suave</button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn-primary" onClick={() => void runMaster()} disabled={mezclando}>
                {mezclando ? "Mezclando audio…" : "CREAR AUDIO FINAL"}
              </button>
            </div>
          </div>
        )}
        {!running && done > 0 && (
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn-secondary" onClick={() => setTick((x) => x + 1)}>ACTUALIZAR</button>
          </div>
        )}
        {running && (
          <div className="row">
            <button className="btn-secondary" onClick={() => void pausar()}>Pausar</button>
            <button className="btn-danger" onClick={() => void descartar()} disabled={descartando}>
              {descartando ? "Eliminando…" : "DETENER Y ELIMINAR"}
            </button>
          </div>
        )}
        {!running && done === 0 && (
          <p className="muted small">Primero crea un guion. Cuando empieces a generar audio, el avance aparecerá aquí.</p>
        )}
      </div>
    </div>
  );
}
