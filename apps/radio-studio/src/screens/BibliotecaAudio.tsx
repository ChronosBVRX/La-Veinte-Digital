import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarAudio,
  obtenerMusicaMotor,
  obtenerMusicaProgreso,
  generarMusica,
  cancelarMusica,
  type AudioItem,
  type MusicaMotor,
  type MusicaTipo,
  type MusicaProgreso,
} from "../lib/studio-api";

const TIPOS: Array<{ tipo: MusicaTipo; etiqueta: string; desc: string }> = [
  { tipo: "bed", etiqueta: "Cama de programa", desc: "Fondo de la misma identidad sonora del programa (60 s)" },
  { tipo: "jingle", etiqueta: "Intro / cierre", desc: "Motivo corto de marca para abrir y cerrar (8 s)" },
  { tipo: "cortinilla", etiqueta: "Cortinilla", desc: "Transición musical entre secciones (5 s)" },
  { tipo: "sfx", etiqueta: "SFX / efecto", desc: "Whoosh, impacto, riser, sting (3-5 s)" },
  { tipo: "ambiente", etiqueta: "Ambiente", desc: "Fondo atmosférico (30 s)" },
];

const PROMPTS_BASE: Record<string, string> = {
  bed: "Cama musical oficial para La Veinte Digital, misma identidad sonora que el intro y cierre, instrumental moderno para programa informativo laboral, tecnologico pero institucional, sin voces, 90 BPM, tono optimista, piano y sintetizador suaves, percusion discreta, musica de fondo uniforme",
  jingle: "Motivo musical oficial para La Veinte Digital, usado como intro y cierre de todos los episodios, corto, reconocible, energetico pero institucional, percusion moderna, synth brillante, final limpio y contundente, sin voz, misma familia sonora que la cama del programa",
  cortinilla: "Cortinilla de transicion para radio, riser suave con impacto final, limpia, profesional, sin voces",
  sfx: "Swoosh de transicion para radio, corto, limpio, sin musica, efecto de sonido de paso",
  ambiente: "Atmosfera ambiental suave, pad evolutivo, misteriosa pero neutra, sin ritmo marcado, para fondo de documental",
};

const PROMPTS_PRE: string[] = [
  "identidad uniforme La Veinte", "informativo institucional", "urbano moderno sobrio", "ambient chill claro", "lofi profesional", "electrónico fresco",
];

export function BibliotecaAudio() {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [cargado, setCargado] = useState(false);
  const [motor, setMotor] = useState<MusicaMotor | null>(null);
  const [prog, setProg] = useState<MusicaProgreso | null>(null);
  const [tipo, setTipo] = useState<MusicaTipo>("bed");
  const [duracion, setDuracion] = useState(60);
  const [estilo, setEstilo] = useState(PROMPTS_PRE[0]);
  const [promptExtra, setPromptExtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refrescar = useCallback(() => {
    void listarAudio().then((r) => { setItems(r); setCargado(true); });
  }, []);

  useEffect(() => {
    refrescar();
    void obtenerMusicaMotor().then(setMotor);
    const motorTimer = setInterval(() => {
      void obtenerMusicaMotor().then(setMotor);
    }, 5000);
    return () => {
      clearInterval(motorTimer);
      if (timer.current) clearInterval(timer.current);
    };
  }, [refrescar]);

  const pollProgreso = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const p = await obtenerMusicaProgreso();
      setProg(p);
      if (!p?.running || p.job?.estado === "DONE" || p.job?.estado === "FAILED") {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        refrescar();
      }
    }, 2500);
  }, [refrescar]);

  const activo = prog?.running || prog?.job?.estado === "QUEUED" || prog?.job?.estado === "RUNNING";

  const onGenerar = async () => {
    setError(null);
    const estilos = PROMPTS_BASE[tipo];
    const prompt = `${estilos}. Estilo: ${estilo}. ${promptExtra}`.trim();
    const durReal = tipo === "jingle" ? 8 : tipo === "cortinilla" ? 5 : tipo === "sfx" ? 4 : duracion;
    try {
      await generarMusica({ prompt, tipo, duracionSec: durReal });
      pollProgreso();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCancelar = async () => {
    await cancelarMusica();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProg(null);
  };

  const categorias: Array<{ cat: AudioItem["categoria"]; etiqueta: string }> = [
    { cat: "bed", etiqueta: "Camas" },
    { cat: "jingle", etiqueta: "Jingles" },
    { cat: "cortinilla", etiqueta: "Cortinillas" },
    { cat: "sfx", etiqueta: "SFX" },
    { cat: "ambiente", etiqueta: "Ambientes" },
  ];

  return (
    <div className="screen">
      <h1>Biblioteca de audio</h1>
      <div className="card">
        <div className="muted small" style={{ marginBottom: 10 }}>
          Música, jingles y camas para la mezcla. Los archivos viven en <code>data/tts/music</code> (sidecar).
          Los placeholders están marcados <strong>TEST_ONLY</strong>: nunca se exportan sin confirmar licencia.
        </div>

        <div className="engine-card" style={{ marginBottom: 14 }}>
          <div className="engine-head">
            <span className="engine-dot" style={{ background: motor?.online ? "var(--ok)" : motor?.starting ? "var(--warn)" : "var(--danger)" }} />
            Motor de música — ACE-Step 1.5 {motor?.online ? "en línea" : motor?.starting ? "encendiendo" : "apagado"}
          </div>
          <div className="engine-grid">
            <div>Modelo: <strong>{motor?.modeloCompleto ?? "acestep-v15-turbo (DiT)"}</strong></div>
            <div>RTF benchmark: <strong>{motor?.rtfBenchmark != null ? motor.rtfBenchmark : "—"}</strong></div>
            <div>Costo: <strong>${"0.00"}</strong> · Offline: <strong>sí</strong></div>
          </div>
          {!motor?.online && motor?.starting && (
            <div className="warn small" style={{ marginTop: 8 }}>
              ACE-Step se está encendiendo en segundo plano. La primera carga puede tardar alrededor de un minuto.
            </div>
          )}
          {!motor?.online && !motor?.starting && (
            <div className="warn small" style={{ marginTop: 8 }}>
              Motor apagado. La app intentará encenderlo automáticamente al abrir esta pantalla.
              {motor?.startError && <div>{motor.startError}</div>}
            </div>
          )}
        </div>

        <div className="scene-title">Generar música local</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {TIPOS.map((t) => (
            <button
              key={t.tipo}
              className={tipo === t.tipo ? "btn-primary" : "btn-ghost"}
              onClick={() => { setTipo(t.tipo); setEstilo(PROMPTS_PRE[0]); }}
              title={t.desc}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label className="small">Estilo</label>
            <select value={estilo} onChange={(e) => setEstilo(e.target.value)}>
              {PROMPTS_PRE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {["bed", "ambiente"].includes(tipo) && (
            <div className="field">
              <label className="small">Duración (s)</label>
              <input type="number" min={10} max={120} step={10} value={duracion} onChange={(e) => setDuracion(Number(e.target.value) || 60)} />
            </div>
          )}
          <div className="field" style={{ flex: 1 }}>
            <label className="small">Detalle extra (opcional)</label>
            <input placeholder="ej. clarinete, batería con groove, sin pads oscuros…" value={promptExtra} onChange={(e) => setPromptExtra(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <button className="btn-primary" onClick={onGenerar} disabled={!motor?.online || !!activo}>
            {activo ? "Generando…" : "Generar"}
          </button>
          {activo && <button className="btn-danger" onClick={onCancelar}>Cancelar</button>}
        </div>

        {activo && prog?.job && (
          <div className="muted small" style={{ marginTop: 10 }}>
            Estado: <strong>{prog.job.estado}</strong> · {prog.job.tipo} {prog.job.duracionSec}s · espera ~{Math.round(prog.job.duracionSec * 2.7)}s
            {prog.gpu?.tempC != null && <> · GPU {prog.gpu.tempC}°C</>}
          </div>
        )}
        {prog?.job?.estado === "DONE" && (
          <div className="master-ok small" style={{ marginTop: 8 }}>
            ✔ {prog.job.wavPath} — {prog.job.genSec}s · rtf {prog.job.rtf} · seed {prog.job.seed ?? "—"}
          </div>
        )}
        {prog?.job?.estado === "FAILED" && <div className="error small">{prog.job.error}</div>}
        {error && <div className="error">{error}</div>}

        {!cargado && <div className="muted">Cargando…</div>}
        {cargado && items.length === 0 && (
          <div className="muted">No hay archivos en la biblioteca. Usa “Generar” arriba o <code>data/tts/music/generar-camas-prueba.ps1</code>.</div>
        )}
        {categorias.map(({ cat, etiqueta }) => {
          const group = items.filter((i) => i.categoria === cat);
          if (group.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="scene-title">{etiqueta}</div>
              {group.map((i) => (
                <div key={i.nombre} className="audio-item">
                  <div>
                    <strong>{i.nombre}</strong>{" "}
                    <span className={`lic ${i.licencia === "TEST_ONLY_PLACEHOLDER" || i.licencia === "UNKNOWN" ? "bad" : "ok"}`}>
                      {i.licencia === "TEST_ONLY_PLACEHOLDER" ? "TEST_ONLY" : i.licencia}
                    </span>
                  </div>
                  <div className="muted small">{i.origen} · {(i.bytes / 1024 / 1024).toFixed(1)} MB</div>
                  {i.notas && <div className="warn small">⚠ {i.notas}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
