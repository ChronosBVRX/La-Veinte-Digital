import { useEffect, useState } from "react";
import type { StudioStatus } from "../lib/studio-api";
import { ajustarGuion, investigar, dirigirPrograma, iniciarGeneracion, obtenerSistema, obtenerCasting, SIDECAR_URL_EXPORT, type ResearchResult, type DirectorResult, type SistemaInfo, type SpeakerProfile, type CastingResult } from "../lib/studio-api";
import { DEFAULT_SPEAKERS, type VoiceSlot } from "@la-veinte/radio-core";

interface Props {
  temaInicial: string;
  status: StudioStatus | null;
  onProducir: () => void;
}

const NIVELES = [
  { id: "informativo", label: "Tranquilo y claro", desc: "Explicación ordenada, ideal para temas delicados" },
  { id: "natural", label: "Conversación natural", desc: "Preguntas, ejemplos y pausas naturales" },
  { id: "dinamico", label: "Ágil y movido", desc: "Respuestas cortas y más cambios de ritmo" },
] as const;

const OFFICIAL_CAST_IDS = ["EDUARDO", "ANDREA", "NARRADOR", "RODRIGO", "VALERIA"] as const;
const DEFAULT_SELECTED: Record<string, boolean> = {
  EDUARDO: true,
  ANDREA: true,
  NARRADOR: true,
  RODRIGO: true,
  VALERIA: true,
};

function cargarLocutoresOficiales(seleccionados: Record<string, boolean>): SpeakerProfile[] {
  try {
    const raw = localStorage.getItem("studio:locutores");
    if (!raw) return DEFAULT_SPEAKERS.filter((s) => seleccionados[s.id] !== false);
    const locutores = JSON.parse(raw) as SpeakerProfile[];
    const overrides = new Map(locutores.filter((l) => OFFICIAL_CAST_IDS.includes(l.id as typeof OFFICIAL_CAST_IDS[number])).map((l) => [l.id, l]));
    return DEFAULT_SPEAKERS
      .map((s) => ({ ...s, ...(overrides.get(s.id) ?? {}) }))
      .filter((s) => seleccionados[s.id] !== false);
  } catch {
    return DEFAULT_SPEAKERS.filter((s) => seleccionados[s.id] !== false);
  }
}

function etiquetaFuente(estado: "ok" | "faltante" | "revisar") {
  if (estado === "ok") return "Lista";
  if (estado === "revisar") return "Revisar";
  return "Pendiente";
}

function notaCobertura(cobertura: ResearchResult["cobertura"]) {
  if (cobertura.recomendado) return "Fuentes suficientes para producir y publicar como episodio verificado.";
  return "Puedes generar el borrador y producirlo internamente. Para publicarlo como verificado falta recuperar o revisar la fuente marcada.";
}

export function CrearEpisodio({ temaInicial, onProducir }: Props) {
  const [tema, setTema] = useState(temaInicial);
  const [duracion, setDuracion] = useState(15);
  const [nivel, setNivel] = useState<(typeof NIVELES)[number]["id"]>("natural");
  const [modoDirector, setModoDirector] = useState<"determinista" | "ia">("ia");
  const [soloCorpus, setSoloCorpus] = useState(true);
  const [contextoExtra, setContextoExtra] = useState("");
  const [alcanceAjuste, setAlcanceAjuste] = useState("todo");
  const [notaAjuste, setNotaAjuste] = useState<string | null>(null);
  const [comerciales, setComerciales] = useState(true);
  const [duracionComercial, setDuracionComercial] = useState(30);
  const [investigando, setInvestigando] = useState(false);
  const [resultado, setResultado] = useState<ResearchResult | null>(null);
  const [director, setDirector] = useState<DirectorResult | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sistema, setSistema] = useState<SistemaInfo | null>(null);
  const [confirmadoProduccion, setConfirmadoProduccion] = useState(false);
  const [casting, setCasting] = useState<CastingResult | null>(null);
  const [seleccionVoces, setSeleccionVoces] = useState<Record<string, boolean>>(DEFAULT_SELECTED);
  const vocesSeleccion = comerciales ? { ...seleccionVoces, VALERIA: true } : seleccionVoces;

  useEffect(() => {
    void obtenerCasting().then(setCasting);
  }, []);

  const guardarDirector = (d: DirectorResult) => {
    setDirector(d);
    localStorage.setItem("studio:guion", JSON.stringify(d));
  };

  const runInvestigar = async () => {
    if (!tema.trim()) return;
    setInvestigando(true);
    setError(null);
    try {
      setResultado(await investigar(tema.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al investigar");
    } finally {
      setInvestigando(false);
    }
  };

  const runDirector = async () => {
    if (!tema.trim()) return;
    setEscribiendo(true);
    setError(null);
    setNotaAjuste(null);
    try {
      localStorage.setItem("studio:contexto-extra", contextoExtra);
      const d = await dirigirPrograma(tema.trim(), nivel, duracion, modoDirector, contextoExtra, comerciales, duracionComercial, cargarLocutoresOficiales(vocesSeleccion));
      setResultado((prev) => prev ?? { tema, fragmentos: d.fragmentos, afirmaciones: 0, cobertura: d.cobertura });
      guardarDirector(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error con el director");
    } finally {
      setEscribiendo(false);
    }
  };

  const runInvestigarYDirigir = async () => {
    if (!tema.trim()) return;
    setInvestigando(true);
    setEscribiendo(true);
    setError(null);
    setNotaAjuste(null);
    try {
      localStorage.setItem("studio:contexto-extra", contextoExtra);
      const r = await investigar(tema.trim());
      setResultado(r);
      const d = await dirigirPrograma(tema.trim(), nivel, duracion, "ia", contextoExtra, comerciales, duracionComercial, cargarLocutoresOficiales(vocesSeleccion));
      setModoDirector("ia");
      guardarDirector(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al investigar y armar el guion");
    } finally {
      setInvestigando(false);
      setEscribiendo(false);
    }
  };

  const runAjustar = async () => {
    if (!director || !contextoExtra.trim()) return;
    setAjustando(true);
    setError(null);
    try {
      localStorage.setItem("studio:contexto-extra", contextoExtra);
      const r = await ajustarGuion({ script: director.script, contexto: contextoExtra.trim(), scope: alcanceAjuste });
      const next = {
        ...director,
        script: r.script,
        editorialQa: r.editorialQa ?? director.editorialQa,
        editorialCambios: r.editorialCambios ?? director.editorialCambios,
        fragmentos: r.fragmentos ?? director.fragmentos,
      };
      guardarDirector(next);
      setNotaAjuste(`${r.proveedor}: ${r.nota}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ajustar el guion");
    } finally {
      setAjustando(false);
    }
  };

  const editarTurno = (id: string, text: string) => {
    if (!director) return;
    const turns = director.script.turns.map((t) => (t.id === id ? { ...t, text } : t));
    const scenes = director.script.scenes.map((s) => ({ ...s, turns: s.turns.map((t) => (t.id === id ? { ...t, text } : t)) }));
    guardarDirector({ ...director, script: { ...director.script, turns, scenes } });
  };

  const insertarComercial = () => {
    if (!director) return;
    const adCount = director.script.turns.filter((t) => t.adSlot).length + 1;
    const insertAt = Math.min(Math.max(4, Math.floor(director.script.turns.length * 0.55)), director.script.turns.length - 2);
    const adTurn = {
      id: `ad-manual-${Date.now()}`,
      speaker: "VALERIA",
      text: `Espacio comercial disponible de ${duracionComercial} segundos. Edita este bloque cuando haya patrocinador.`,
      kind: "ad" as const,
      adSlot: true,
      adDurationSec: duracionComercial,
      sponsorName: null,
      pauseBeforeMs: 220,
      pauseAfterMs: 220,
      energy: 2 as const,
      pace: "normal" as const,
      canOverlap: false,
      transition: `espacio comercial ${adCount}`,
      citations: [],
    };
    const turns = [...director.script.turns.slice(0, insertAt), adTurn, ...director.script.turns.slice(insertAt)];
    const scenes = director.script.scenes.map((s) => ({
      ...s,
      turns: s.turns.some((t) => t.id === director.script.turns[insertAt]?.id)
        ? [...s.turns.slice(0, Math.max(0, s.turns.findIndex((t) => t.id === director.script.turns[insertAt]?.id))), adTurn, ...s.turns.slice(Math.max(0, s.turns.findIndex((t) => t.id === director.script.turns[insertAt]?.id)))]
        : s.turns,
    }));
    guardarDirector({ ...director, script: { ...director.script, turns, scenes } });
    setNotaAjuste("Espacio comercial agregado al borrador.");
  };

  const runProduccion = async () => {
    if (!director) return;
    setGenerando(true);
    setError(null);
    try {
      if (!confirmadoProduccion) {
        const s = await obtenerSistema();
        if (s?.cargaAlta) {
          setSistema(s);
          setGenerando(false);
          return;
        }
      }
      const bloques = director.script.turns.map((t) => ({ id: t.id, texto: t.text, locutor: t.speaker }));
      const voces: Record<string, VoiceSlot> = {};
      for (const s of director.script.speakers) voces[s.id] = s.voz;
      await iniciarGeneracion(bloques, voces);
      onProducir();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar la producción");
    } finally {
      setGenerando(false);
    }
  };

  const speakerOf = (id: string) => director?.script.speakers.find((s) => s.id === id);
  const vocesOficiales = DEFAULT_SPEAKERS.filter((s) => OFFICIAL_CAST_IDS.includes(s.id as typeof OFFICIAL_CAST_IDS[number]));
  const perfilPorId = new Map((casting?.perfiles ?? []).map((p) => [p.id, p]));
  const personaPorId = new Map((casting?.personas ?? []).map((p) => [p.id, p]));
  const toggleVoz = (id: string, checked: boolean) => {
    if (id === "EDUARDO" || id === "ANDREA" || id === "NARRADOR") return;
    setSeleccionVoces((prev) => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="screen narrow">
      <h1>Nuevo episodio</h1>
      <div className="card">
        <div className="form-step-title"><span>1</span> Tema y estilo</div>
        <label className="field">
          <span>¿De qué quieres hablar?</span>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej. Cláusula 97, accidente de trabajo, tiempo extra..." />
        </label>
        <div className="row">
          <label className="field">
            <span>Duración aproximada</span>
            <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
              {[10, 15, 20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} minutos</option>)}
            </select>
          </label>
          <label className="field">
            <span>Estilo del programa</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value as typeof nivel)}>
              {NIVELES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Cómo escribir el guion</span>
            <select value={modoDirector} onChange={(e) => setModoDirector(e.target.value as "determinista" | "ia")}>
              <option value="ia">Con DeepSeek</option>
              <option value="determinista">Borrador rápido sin IA</option>
            </select>
          </label>
        </div>
        {duracion > 10 && modoDirector === "determinista" && (
          <div className="warn small" style={{ marginBottom: 10 }}>
            Para programas largos conviene usar DeepSeek; el borrador rápido puede sentirse repetitivo.
          </div>
        )}
        <div className="muted small" style={{ marginBottom: 12 }}>
          {NIVELES.find((n) => n.id === nivel)?.desc}.
        </div>
        <div className="form-step-title"><span>2</span> Elige las voces</div>
        <div className="cast-select-grid">
          {vocesOficiales.map((s) => {
            const perfil = perfilPorId.get(s.id);
            const persona = personaPorId.get(s.id);
            const fijo = s.id === "EDUARDO" || s.id === "ANDREA" || s.id === "NARRADOR";
            const preview = perfil?.previewAudioPath ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(perfil.previewAudioPath)}` : null;
            return (
              <label key={s.id} className={`cast-card ${vocesSeleccion[s.id] !== false ? "selected" : ""}`}>
                <div className="cast-card-head">
                  <input
                    type="checkbox"
                    checked={vocesSeleccion[s.id] !== false}
                    disabled={fijo}
                    onChange={(e) => toggleVoz(s.id, e.target.checked)}
                  />
                  <div>
                    <strong>{s.nombre}</strong>
                    <small>{s.rol === "comercial" ? "Voz comercial" : s.rol}</small>
                  </div>
                </div>
                <p>{persona?.objetivo ?? s.funcionEditorial ?? s.personalidad}</p>
                {preview ? (
                  <audio controls preload="none" src={preview} />
                ) : (
                  <div className="muted small">Preview disponible cuando el motor local esté listo.</div>
                )}
              </label>
            );
          })}
        </div>
        <label className="field">
          <span>Indicaciones para el episodio</span>
          <textarea
            value={contextoExtra}
            onChange={(e) => setContextoExtra(e.target.value)}
            rows={3}
            placeholder="Ej. Que el episodio sea para personal de hospital, con ejemplos de guardia, tono menos formal, incluir dudas frecuentes de recibo de pago..."
          />
        </label>
        <div className="form-step-title"><span>3</span> Seguridad y comerciales</div>
        <div className="option-grid">
          <label className="toggle-option">
            <input type="checkbox" checked={soloCorpus} onChange={(e) => setSoloCorpus(e.target.checked)} />
            <span>
              <strong>Usar solo documentos verificados</strong>
              <small>Evita afirmaciones sin respaldo.</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={comerciales} onChange={(e) => setComerciales(e.target.checked)} />
            Dejar espacios para patrocinadores
          </label>
          <label className="field" style={{ maxWidth: 180 }}>
            <span>Duración del anuncio</span>
            <select value={duracionComercial} onChange={(e) => setDuracionComercial(Number(e.target.value))}>
              {[15, 30, 45, 60].map((d) => <option key={d} value={d}>{d} segundos</option>)}
            </select>
          </label>
        </div>

        {resultado && (
          <div className={`coverage ${resultado.cobertura.recomendado ? "ok" : "warn"}`}>
            <div className="coverage-head">
              <span>Fuentes del episodio: {resultado.cobertura.porcentaje}%</span>
              <span className={`coverage-status ${resultado.cobertura.recomendado ? "ok" : "pendiente"}`}>
                {resultado.cobertura.recomendado ? "Verificado" : "Borrador con pendiente"}
              </span>
            </div>
            <div className="coverage-note">{notaCobertura(resultado.cobertura)}</div>
            {resultado.cobertura.items.map((i) => (
              <div key={i.label} className={`coverage-item ${i.estado}`}>
                <span className={`coverage-badge ${i.estado}`}>{etiquetaFuente(i.estado)}</span>
                <span>{i.label}</span>
              </div>
            ))}
            {resultado.cobertura.advertencias.map((a, i) => (
              <div key={i} className="coverage-warn">Nota editorial: {a}</div>
            ))}
            {resultado.analisisIa && (
              <div className="coverage-item ok" style={{ marginTop: 8 }}>
                Investigación {resultado.investigador ?? "IA"}: {resultado.analisisIa.enfoque ?? (resultado.analisisIa.error ? `revisar (${resultado.analisisIa.error})` : "lista")}
              </div>
            )}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="form-step-title"><span>4</span> Crear</div>
        <div className="episode-actions">
          <button className="btn-primary btn-main-action" onClick={runInvestigarYDirigir} disabled={investigando || escribiendo || !tema.trim()}>
            {investigando || escribiendo ? "Creando guion…" : "CREAR GUION CON DEEPSEEK"}
          </button>
          <details className="advanced-actions">
            <summary>Opciones adicionales</summary>
            <div className="secondary-actions">
              <button className="btn-secondary" onClick={runInvestigar} disabled={investigando || !tema.trim()} title="Solo revisa qué documentos respaldan el tema.">
                {investigando ? "Revisando…" : "REVISAR FUENTES"}
              </button>
              <button className="btn-secondary" onClick={runDirector} disabled={escribiendo || !tema.trim()} title="Arma el guion con el director seleccionado, sin repetir la revisión manual de fuentes.">
                {escribiendo ? "Armando…" : "ARMAR GUION RÁPIDO"}
              </button>
            </div>
          </details>
        </div>
      </div>

      {director && (
        <div className="card">
          <h2>Guion listo para revisar — {director.script.turns.length} intervenciones · ~{Math.round(director.script.estimacionDurSec / 60)} min</h2>
          <div className="muted small" style={{ marginBottom: 10 }}>
            {director.script.scenes.map((s) => s.titulo).join(" → ")} · Las pausas y voces se ajustan al generar el audio.
          </div>
          {director.editorialQa && (
            <div className={`coverage ${director.editorialQa.score >= 82 ? "ok" : "warn"}`} style={{ marginBottom: 12 }}>
              <div className="coverage-head">
                Revisión editorial: {director.editorialQa.score}/100 · intro/outro musical · {director.editorialCambios ?? 0} ajustes automáticos
              </div>
              {director.editorialQa.issues.map((i) => (
                <div key={`${i.tipo}-${i.detalle}`} className="coverage-item revisar">
                  {i.severidad === "alta" ? "🔴" : "🟡"} {i.detalle}
                </div>
              ))}
            </div>
          )}
          <div className="ai-rewrite">
            <div className="row">
              <label className="field">
                <span>Parte que quieres ajustar</span>
                <select value={alcanceAjuste} onChange={(e) => setAlcanceAjuste(e.target.value)}>
                  <option value="todo">Todo el guion</option>
                  {director.script.scenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.titulo} ({s.turns.length} turnos)</option>
                  ))}
                </select>
              </label>
              <button className="btn-secondary" onClick={runAjustar} disabled={ajustando || !contextoExtra.trim()}>
                {ajustando ? "Ajustando…" : "AJUSTAR SIN BORRAR"}
              </button>
              <button className="btn-secondary" onClick={insertarComercial}>
                AGREGAR COMERCIAL
              </button>
            </div>
            {notaAjuste && <div className="muted small">{notaAjuste}</div>}
          </div>
          <div className="script-editor">
            {director.script.scenes.map((scene) => (
              <div key={scene.id}>
                <div className="scene-title">{scene.titulo.toUpperCase()}</div>
                {scene.turns.map((t) => {
                  const sp = speakerOf(t.speaker);
                  return (
                    <div key={t.id} className={`script-line ${t.adSlot ? "ad" : sp?.rol === "co-conductor" ? "b" : sp?.rol === "narrador" ? "n" : "a"}`}>
                      <div className="script-locutor">
                        <span className={`locutor-tag ${sp?.rol === "co-conductor" ? "pink" : sp?.rol === "narrador" ? "gray" : "blue"}`}>
                          {t.adSlot ? "Comercial" : sp?.nombre ?? t.speaker}
                        </span>
                        {t.adSlot && <span className="meta-chip sponsor">{t.adDurationSec ?? duracionComercial}s</span>}
                        <span className="meta-chip">Pausa</span>
                        <span className="meta-chip">Energía {t.energy}/5</span>
                        {t.canOverlap && <span className="meta-chip solape">Respuesta breve</span>}
                        {t.transition && <span className="meta-chip">{t.transition}</span>}
                        {t.citations.length > 0 && <span className="meta-chip cita">📚 {t.citations.length}</span>}
                      </div>
                      <textarea value={t.text} onChange={(e) => editarTurno(t.id, e.target.value)} rows={2} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {sistema?.cargaAlta && (
            <div className="card" style={{ borderColor: "#f59e0b", background: "#1c1917" }}>
              <div className="scene-title">Antes de generar audio</div>
              <div className="muted small">Qwen utiliza GPU y CPU.</div>
              <div className="warn small">⚠ Se detectó una carga elevada del sistema ({sistema.cpuLoad != null ? `CPU ${sistema.cpuLoad}%` : ""}{sistema.ramLibreGb ? ` · RAM libre ${sistema.ramLibreGb} GB` : ""}).</div>
              <div className="muted small" style={{ marginTop: 6 }}>
                Para acelerar la producción puedes cerrar temporalmente:
                {sistema.procesosCompetidores.map((p) => (
                  <span key={p.nombre} className="chip" style={{ marginLeft: 6 }}>{p.nombre}</span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn-primary" onClick={() => { setConfirmadoProduccion(true); setSistema(null); void runProduccion(); }}>
                  Generar de todos modos
                </button>
              </div>
            </div>
          )}
          <div className="row">
            <button className="btn-primary" onClick={runProduccion} disabled={generando}>
              {generando ? "Preparando audio…" : "GENERAR AUDIO DEL EPISODIO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
