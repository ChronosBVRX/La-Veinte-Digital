import { useEffect, useRef, useState, type CSSProperties } from "react";
import { obtenerProgreso, cancelarProduccion, descartarProduccion, reanudarProduccion, masterPrograma, regenerarTurno, obtenerLlmSalud, type LlmHealthInfo, SIDECAR_URL_EXPORT, type ProgresoProduccion, type DialogueTurn, type MasterResult, type BloqueProgreso } from "../lib/studio-api";
import type { VoiceSlot } from "@la-veinte/radio-core";
import { MiniPlayer, colorDeLocutor, nombreCorto } from "../components/MiniPlayer";

type MetaTurno = { intent?: string; respondsTo?: string | null; emotion?: string; overlapPreviousMs?: number; citations?: string[] };

function leerGuion(): { porId: Map<string, MetaTurno>; orden: string[] } | null {
  try {
    const raw = localStorage.getItem("studio:guion");
    if (!raw) return null;
    const d = JSON.parse(raw) as { script: { turns: DialogueTurn[] } };
    return {
      porId: new Map(d.script.turns.map((t) => [t.id, { intent: t.intent, respondsTo: t.respondsTo, emotion: t.emotion, overlapPreviousMs: t.overlapPreviousMs, citations: t.citations }])),
      orden: d.script.turns.map((t) => t.id),
    };
  } catch {
    return null;
  }
}

function badgeDeMeta(meta: MetaTurno | undefined): Array<{ texto: string; clase: string }> {
  if (!meta) return [];
  const badges: Array<{ texto: string; clase: string }> = [];
  if (meta.intent === "interrupt_question" || meta.intent === "interrupt_correction") badges.push({ texto: "INTERRUMPE", clase: "tag-b-int" });
  else if (meta.intent === "backchannel" || meta.intent === "reaction") badges.push({ texto: "REACCIÓN", clase: "tag-b-rea" });
  if ((meta.overlapPreviousMs ?? 0) > 0) badges.push({ texto: `SOLAPE ${meta.overlapPreviousMs} ms`, clase: "tag-b-sol" });
  if ((meta.citations?.length ?? 0) > 0) badges.push({ texto: "CITA", clase: "tag-b-cita" });
  return badges;
}

function urlAudio(wavPath: string): string {
  return `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(wavPath)}`;
}

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
  const [reproduciendoTodo, setReproduciendoTodo] = useState(false);
  const [indiceTodo, setIndiceTodo] = useState<number | null>(null);
  const [limiteSecuencia, setLimiteSecuencia] = useState<number | null>(null);
  const [modoDirector, setModoDirector] = useState(false);
  const [llm, setLlm] = useState<LlmHealthInfo | null>(null);
  const [verGpu, setVerGpu] = useState(false);
  const [regenerandoId, setRegenerandoId] = useState<string | null>(null);
  const guionMeta = useRef(leerGuion());
  const listaRef = useRef<HTMLDivElement | null>(null);
  const audioTodoRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    const load = () => void obtenerLlmSalud().then(setLlm);
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  // Seguir el bloque actual mientras genera
  const bloques = p?.bloques ?? [];
  const actualIdx = bloques.findIndex((b) => b.estado === "pendiente");
  useEffect(() => {
    if (!p?.running || actualIdx < 0 || !listaRef.current) return;
    const el = listaRef.current.querySelector<HTMLElement>(`[data-idx="${actualIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [actualIdx, p?.running]);

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
    detenerTodo();
    await cancelarProduccion();
    await refrescar();
  };

  const descartar = async () => {
    const ok = window.confirm("Esto detendrá la producción actual y la quitará de esta pantalla. El guion editable se conserva.");
    if (!ok) return;
    setDescartando(true);
    setError(null);
    try {
      detenerTodo();
      await descartarProduccion();
      setP(null);
      setMaster(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la producción");
    } finally {
      setDescartando(false);
    }
  };

  const generados = bloques.filter((b) => b.estado === "generado");

  // ── Regenerar con contexto: anterior + actual + siguiente ──
  const regenerar = async (b: BloqueProgreso) => {
    if (regenerandoId) return;
    setRegenerandoId(b.id);
    setError(null);
    try {
      const orden = guionMeta.current?.orden ?? [];
      const i = orden.indexOf(b.id);
      const prevId = i > 0 ? orden[i - 1] : undefined;
      const nextId = i >= 0 && i < orden.length - 1 ? orden[i + 1] : undefined;
      // el texto fresco viene de /progress; el vecino, del guion guardado
      const raw = localStorage.getItem("studio:guion");
      let prevTexto = "", nextTexto = "";
      if (raw) {
        const d = JSON.parse(raw) as { script: { turns: DialogueTurn[] } };
        prevTexto = d.script.turns.find((t) => t.id === prevId)?.text ?? "";
        nextTexto = d.script.turns.find((t) => t.id === nextId)?.text ?? "";
      }
      const voces: Record<string, VoiceSlot> = {};
      for (const bb of bloques) voces[bb.locutor] = bb.voz as VoiceSlot;
      await regenerarTurno({ turnId: b.id, texto: b.texto, locutor: b.locutor, prevTexto, nextTexto, voces });
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo regenerar");
    } finally {
      setRegenerandoId(null);
    }
  };

  // ── Preview de contexto: anterior + actual + siguiente en secuencia ──
  const reproducirContexto = (idx: number) => {
    const primero = [idx - 1, idx].find((i) => i >= 0 && i < bloques.length && bloques[i].estado === "generado" && bloques[i].wavPath);
    if (primero == null) return;
    setLimiteSecuencia(idx + 1);
    setReproduciendoTodo(true);
    setIndiceTodo(primero);
  };

  // ─── Reproducción secuencial "escuchar lo que llevamos" ───
  const detenerTodo = () => {
    audioTodoRef.current?.pause();
    audioTodoRef.current = null;
    setReproduciendoTodo(false);
    setIndiceTodo(null);
    setLimiteSecuencia(null);
  };

  const reproducirTodo = () => {
    if (reproduciendoTodo) {
      detenerTodo();
      return;
    }
    if (generados.length === 0) return;
    setLimiteSecuencia(null);
    setReproduciendoTodo(true);
    setIndiceTodo(bloques.indexOf(generados[0]));
  };

  useEffect(() => {
    if (!reproduciendoTodo || indiceTodo == null) return;
    const b = bloques[indiceTodo];
    if (!b || b.estado !== "generado" || !b.wavPath) {
      detenerTodo();
      return;
    }
    const a = new Audio(urlAudio(b.wavPath));
    audioTodoRef.current = a;
    a.onended = () => {
      if (limiteSecuencia != null && indiceTodo >= limiteSecuencia) {
        detenerTodo();
        return;
      }
      const siguiente = bloques.slice(indiceTodo + 1).findIndex((x) => x.estado === "generado");
      if (siguiente < 0) {
        detenerTodo();
      } else {
        setIndiceTodo(indiceTodo + 1 + siguiente);
      }
    };
    void a.play().catch(() => detenerTodo());
    return () => {
      a.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendoTodo, indiceTodo, limiteSecuencia]);

  const running = p?.running ?? false;
  const done = p?.done ?? 0;
  const total = p?.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const cache = p?.cacheHits ?? 0;
  const fallos = p?.fallos ?? 0;
  const temp = p?.gpu?.tempC ?? null;
  const vramUsada = p?.gpu?.vramUsadaMb ?? null;
  const vramTotal = p?.gpu?.vramTotalMb ?? null;
  const resumible = p?.estado === "INTERRUPTED" || p?.estado === "PAUSED";
  const durTotalGeneradaMs = generados.reduce((acc, b) => acc + (b.durMs ?? 0), 0);

  return (
    <div className="screen">
      <h1>Estudio de producción</h1>
      <div className="card">
        <div className="prod-head">
          <div>
            <div className="prod-title">{p?.tema ?? "Episodio actual"}</div>
            <div className="muted">
              {running ? "El estudio está grabando las voces…" : done > 0 ? "Voces listas para mezclar." : "Primero crea un guion y lanza la generación."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {llm && (
            <button
              className="pill-ia"
              title={llm.health.ok ? `Ollama ${llm.health.version} · ${llm.config.model}` : (llm.health.error ?? "IA local no disponible")}
              onClick={() => setVerGpu((v) => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                border: `1px solid ${llm.health.ok && llm.modeloObjetivoOk ? "rgba(52,211,153,.4)" : "rgba(239,68,68,.4)"}`,
                background: llm.health.ok && llm.modeloObjetivoOk ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.1)",
                color: llm.health.ok && llm.modeloObjetivoOk ? "#34d399" : "#fca5a5",
                cursor: "pointer",
              }}
            >
              <span className="dot-ia" />
              {llm.gpu.owner === "llm" ? "PENSANDO · QWEN" : llm.health.ok ? (llm.modeloObjetivoOk ? "IA LOCAL LISTA" : "MODELO NO INSTALADO") : "IA LOCAL OFF"}
              {llm.health.ok && <span style={{ fontWeight: 500, textTransform: "none" }}>{llm.config.model}</span>}
            </button>
          )}
          {verGpu && llm && (
            <div className="gpu-card">
              <div><span className="muted small">GPU:</span> RTX 3060</div>
              <div><span className="muted small">Estado:</span> {llm.gpu.state} · dueño: <strong>{llm.gpu.owner ?? "LIBRE"}</strong></div>
              {llm.stats.map((st) => (
                <div key={st.name}><span className="muted small">{st.name}:</span> VRAM {(st.sizeVramMb ?? 0 / 1024 / 1024 / 1024).toFixed(1)} MB… </div>
              ))}
              <div className="muted small">Contexto: {llm.config.contextTokens} tokens · Proveedor remoto: {llm.config.remoteEnabled ? "ACTIVADO" : "desactivado"} · 100% local</div>
            </div>
          )}
          {total > 0 && (
            <div className={`prod-pill ${running ? "live" : ""}`}>
              {running && <span className="dot" />}
              {running ? "EN EL AIRE" : resumible ? "PAUSADO" : "LISTO"}
            </div>
          )}
          </div>
        </div>

        {total > 0 && (
          <>
            <div className="bar" style={{ margin: "18px 0 6px" }}>
              <div className="bar-fill green" style={{ width: `${pct}%` }} />
            </div>
            <div className="muted small">{pct}% · {done}/{total} intervenciones</div>

            <div className="prod-grid">
              {Object.entries(p?.porLocutor ?? {}).map(([loc, st]) => (
                <div className="prod-col" key={loc}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="speaker-dot" style={{ background: colorDeLocutor(loc) }} />
                    <span>{nombreCorto(loc)}</span>
                  </div>
                  <div className="big">{st.hecho}/{st.total}</div>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${st.total > 0 ? (st.hecho / st.total) * 100 : 0}%`, background: colorDeLocutor(loc) }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="prod-stats">
              <div><span className="big">{generados.length}</span><span className="muted"> audios listos</span></div>
              <div><span className="big">{cache}</span><span className="muted"> desde caché</span></div>
              <div><span className="big">{fallos}</span><span className="muted"> fallos</span></div>
              {durTotalGeneradaMs > 0 && <div><span className="big">{Math.round(durTotalGeneradaMs / 60000 * 10) / 10} min</span><span className="muted"> de voz generada</span></div>}
              {temp != null && <div><span className="big">{temp}°</span><span className="muted"> GPU</span></div>}
              {vramUsada != null && <div><span className="muted">VRAM</span><span className="big">{(vramUsada / 1024).toFixed(1)}</span><span className="muted">/{((vramTotal ?? 4096) / 1024).toFixed(1)} GB</span></div>}
              {p?.rtfChatterbox != null && <div><span className="big">{p.rtfChatterbox.toFixed(2)}×</span><span className="muted"> velocidad real</span></div>}
            </div>
          </>
        )}

        {/* ═══ Guion al aire — preview línea por línea ═══ */}
        {bloques.length > 0 && (
          <div className="aire-wrap">
            <div className="aire-head">
              <div className="scene-title" style={{ margin: 0 }}>Guion al aire</div>
              <div className="row" style={{ gap: 8 }}>
                <button className={`chip ${reproduciendoTodo ? "chip-active" : ""}`} onClick={reproducirTodo} disabled={generados.length === 0}>
                  {reproduciendoTodo ? "■ Detener" : `▶ Escuchar lo generado (${generados.length})`}
                </button>
                <button className={`chip ${modoDirector ? "chip-active" : ""}`} onClick={() => setModoDirector((v) => !v)}>
                  {modoDirector ? "Vista director ✓" : "Vista director"}
                </button>
                {!running && <button className="chip" onClick={() => void refrescar()}>↻ Actualizar</button>}
              </div>
            </div>
            <div className="aire-lista" ref={listaRef}>
              {bloques.map((b: BloqueProgreso, i: number) => {
                const color = colorDeLocutor(b.locutor);
                const esActual = running && i === actualIdx;
                const sonandoIndice = reproduciendoTodo && indiceTodo === i;
                const meta = guionMeta.current?.porId.get(b.id);
                const badges = badgeDeMeta(meta);
                const enRegeneracion = regenerandoId === b.id;
                return (
                  <div
                    key={b.id}
                    data-idx={i}
                    className={`linea-aire ${b.estado} ${sonandoIndice ? "sonando" : ""} ${esActual ? "actual" : ""}`}
                    style={{ "--linea-accent": color } as CSSProperties}
                  >
                    <div className="linea-side">
                      <span className="speaker-chip" style={{ background: color }}>{nombreCorto(b.locutor)}</span>
                    </div>
                    <div className="linea-main">
                      <div className="linea-texto">{b.texto}</div>
                      <div className="linea-meta">
                        {b.durMs != null && <span>{(b.durMs / 1000).toFixed(1)} s</span>}
                        {b.cacheHit && <span className="tag tag-cache">caché</span>}
                        {!modoDirector && badges.map((bd) => (
                          <span key={bd.texto} className={`tag ${bd.clase}`}>{bd.texto}</span>
                        ))}
                        {modoDirector && (
                          <span className="tag tag-intent">{meta?.intent ?? "—"}</span>
                        )}
                        {modoDirector && meta?.respondsTo && (
                          <span className="tag tag-responds">↩ {meta.respondsTo}</span>
                        )}
                        {modoDirector && meta?.emotion && (
                          <span className="tag">{meta.emotion}</span>
                        )}
                        {b.error && <span className="tag tag-error">{b.error.slice(0, 60)}</span>}
                      </div>
                    </div>
                    <div className="linea-action">
                      {b.estado === "generado" && b.wavPath && (
                        <>
                          <MiniPlayer compact src={urlAudio(b.wavPath)} accent={color} />
                          <button className="chip" title="Escuchar anterior + actual + siguiente" onClick={() => reproducirContexto(i)}>▶3</button>
                          {!running && (
                            <button className="chip" disabled={!!regenerandoId || enRegeneracion} title="Regenerar con contexto" onClick={() => void regenerar(b)}>
                              {enRegeneracion ? "…" : "↻"}
                            </button>
                          )}
                        </>
                      )}
                      {b.estado === "pendiente" && esActual && (
                        <span className="eq static">
                          <i /><i /><i /><i /><i />
                        </span>
                      )}
                      {b.estado === "pendiente" && !esActual && <span className="linea-pendiente">en cola</span>}
                      {b.estado === "fallo" && <span className="tag tag-error">falló</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {resumible && done > 0 && (
          <div className="master-ok" style={{ background: "#1e1b4b", borderColor: "#818cf8", color: "#c7d2fe" }}>
            Producción pausada ({done}/{total} ya listas — puedes escucharlas arriba). Continúa donde quedó o elimina esta generación.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn-primary" onClick={() => void reanudarProduccion()}>CONTINUAR DESDE AQUÍ</button>
              <button className="btn-danger" onClick={() => void descartar()} disabled={descartando}>
                {descartando ? "Eliminando…" : "DETENER Y ELIMINAR"}
              </button>
            </div>
          </div>
        )}

        {(p?.tiempoRestanteMin != null || p?.etaMin != null) && running && (
          <div className="muted small">
            Tiempo aproximado restante: <strong>~{p?.etaMin ?? p?.tiempoRestanteMin} min</strong>
            {p?.reiniciosPrevistos != null && p.reiniciosPrevistos > 0 ? " · habrá una pausa técnica automática" : ""}
          </div>
        )}

        {master && (
          <div className="master-ok">
            <div style={{ marginBottom: 8 }}>
              Audio final listo · {(master.bytes / 1024 / 1024).toFixed(1)} MB · {Math.round(master.duracionTotalMs / 1000)}s
              {master.bedUsada ? " · cama musical" : ""}{master.jingleUsado ? " · intro/outro" : ""}
            </div>
            <MiniPlayer
              src={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
              label="Máster"
              accent="#22c55e"
            />
            <div className="muted small" style={{ marginTop: 6 }}>{master.master.split(/[\\/]/).pop()}</div>
          </div>
        )}
        {error && <div className="error">{error}</div>}

        {!running && done > 0 && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="scene-title">Mezcla final</div>
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
                <span>Música de fondo (dB)</span>
                <input type="number" value={bedGain} onChange={(e) => setBedGain(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Ducking durante voces (dB)</span>
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
        {running && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-secondary" onClick={() => void pausar()}>Pausar</button>
            <button className="btn-danger" onClick={() => void descartar()} disabled={descartando}>
              {descartando ? "Eliminando…" : "DETENER Y ELIMINAR"}
            </button>
          </div>
        )}
        {!running && done === 0 && bloques.length === 0 && (
          <p className="muted small">Cuando lances una generación, aquí verás el guion al aire: cada intervención aparece con su voz tan pronto está lista, lista para escuchar.</p>
        )}
      </div>
    </div>
  );
}
