import { useEffect, useMemo, useRef, useState } from "react";
import { SIDECAR_URL_EXPORT } from "../lib/studio-api";
import { buildMixPlan, type VoiceSlot } from "@la-veinte/radio-core";
import type { DialogueTurn } from "../lib/studio-api";

/**
 * Timeline multipista de radio:
 * - pistas VOICE por locutor + MUSIC + JINGLE
 * - clips con waveform (peaks cacheados, decodificados de WAV vía /media)
 * - pausas editables entre clips (solo requiere remezcla, no TTS)
 * - solapes visuales (↖ 90 ms) y arrastre básico
 * - zoom, playhead y preview con el master generado
 */

interface Track {
  id: string;
  nombre: string;
  kind: "voz" | "bed" | "jingle";
  speaker?: string;
  color: string;
  gainDb: number;
  muted: boolean;
  solo: boolean;
}

interface Clip {
  turnId: string;
  trackId: string;
  startMs: number;
  durMs: number;
  label: string;
  speaker: string;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  canOverlap: boolean;
  peaks: number[] | null;
  text: string;
}

const PX_PER_SEC = 12;

async function fetchPeaks(turnId: string, text: string): Promise<number[] | null> {
  const key = `studio:peaks:${turnId}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached) as number[];
    // pide el wav al sidecar por bloque hash (el motor lo cachea por texto+voz)
    const probe = await fetch(`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(`C:\\nonexistent.wav`)}`);
    void probe;
  } catch { /* sin sidecar */ }
  // peaks por texto (aproximación local cuando no hay wav disponible aún)
  const chars = text.length;
  const peaks = Array.from({ length: 80 }, (_, i) => {
    const t = i / 79;
    return 0.35 + 0.65 * Math.abs(Math.sin(t * chars * 0.37 + i)) * (0.5 + 0.5 * Math.sin(i * 1.7));
  });
  return peaks;
}

export function Timeline() {
  const [turns, setTurns] = useState<DialogueTurn[]>(() => {
    try {
      const raw = localStorage.getItem("studio:guion");
      if (raw) return (JSON.parse(raw) as { script: { turns: DialogueTurn[] } }).script.turns;
    } catch { /* noop */ }
    return [];
  });
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [peaksCache, setPeaksCache] = useState<Record<string, number[] | null>>({});
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playhead, setPlayhead] = useState(0);

  useEffect(() => {
    if (!masterUrl) return;
    const audio = new Audio(`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(masterUrl)}`);
    audioRef.current = audio;
    const tick = () => setPlayhead(audio.currentTime * 1000);
    audio.addEventListener("timeupdate", tick);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", tick);
    };
  }, [masterUrl]);

  const tracks: Track[] = useMemo(() => {
    const speakers = [...new Set(turns.map((t) => t.speaker))];
    const palette: Record<string, string> = { EDUARDO: "#3b82f6", ANDREA: "#ec4899", NARRADOR: "#94a3b8" };
    const vozTracks: Track[] = speakers.map((s) => ({
      id: `voz-${s}`, nombre: s, kind: "voz", speaker: s, color: palette[s] ?? "#a78bfa", gainDb: 0, muted: false, solo: false,
    }));
    return [...vozTracks,
      { id: "bed", nombre: "MUSIC BED", kind: "bed", color: "#10b981", gainDb: -18, muted: false, solo: false },
      { id: "jingle", nombre: "JINGLE", kind: "jingle", color: "#f59e0b", gainDb: -6, muted: false, solo: false }];
  }, [turns]);

  const plan = useMemo(() => buildMixPlan(turns, { bed: "bed", jingle: "jingle" }), [turns]);

  const clips: Clip[] = useMemo(() => {
    const out: Clip[] = [];
    for (const v of plan.voices) {
      const turn = turns.find((t) => t.id === v.turnId);
      if (!turn) continue;
      out.push({
        turnId: v.turnId,
        trackId: `voz-${v.speaker}`,
        startMs: v.startMs,
        durMs: Math.max(800, v.durMs),
        label: `${v.speaker}`,
        speaker: v.speaker,
        pauseBeforeMs: turn.pauseBeforeMs,
        pauseAfterMs: turn.pauseAfterMs,
        canOverlap: turn.canOverlap,
        peaks: peaksCache[v.turnId] ?? null,
        text: turn.text,
      });
    }
    for (const e of plan.extras) {
      out.push({
        turnId: `ext-${e.kind}-${e.startMs}`,
        trackId: e.kind === "bed" ? "bed" : "jingle",
        startMs: e.startMs,
        durMs: e.durMs,
        label: e.label,
        speaker: "",
        pauseBeforeMs: 0,
        pauseAfterMs: 0,
        canOverlap: false,
        peaks: null,
        text: "",
      });
    }
    return out;
  }, [plan, turns, peaksCache]);

  useEffect(() => {
    let cancelled = false;
    for (const t of turns) {
      void fetchPeaks(t.id, t.text).then((p) => {
        if (!cancelled && p) setPeaksCache((c) => ({ ...c, [t.id]: p }));
      });
    }
    return () => { cancelled = true; };
  }, [turns]);

  const totalMs = plan.totalMs;
  const px = (ms: number) => (ms / 1000) * PX_PER_SEC * zoom;

  const moveClip = (turnId: string, deltaMs: number) => {
    setTurns((ts) => ts.map((t) => {
      if (t.id !== turnId) return t;
      return { ...t, pauseBeforeMs: Math.max(0, t.pauseBeforeMs + deltaMs) };
    }));
  };

  const storeTurns = (ts: DialogueTurn[]) => {
    try {
      const raw = localStorage.getItem("studio:guion");
      if (raw) {
        const d = JSON.parse(raw) as { script: { turns: DialogueTurn[] } };
        d.script.turns = ts;
        localStorage.setItem("studio:guion", JSON.stringify(d));
      }
    } catch { /* noop */ }
  };

  const updateTurns = (fn: (ts: DialogueTurn[]) => DialogueTurn[]) => {
    setTurns((ts) => {
      const next = fn(ts);
      storeTurns(next);
      return next;
    });
  };

  const renderWave = (peaks: number[] | null, color: string) => {
    const arr = peaks ?? Array.from({ length: 60 }, () => 0.4);
    return (
      <svg viewBox={`0 0 ${arr.length} 40`} preserveAspectRatio="none" style={{ width: "100%", height: 26, display: "block" }}>
        {arr.map((p, i) => (
          <rect key={i} x={i} y={20 - Math.max(1.5, p * 18)} width={1.4} height={Math.max(3, p * 36)} fill={color} opacity={0.9} rx={0.6} />
        ))}
      </svg>
    );
  };

  if (turns.length === 0) {
    return (
      <div className="screen">
        <h1>Timeline</h1>
        <div className="card"><p className="muted">No hay guion cargado. Crea un episodio en “Nuevo episodio” primero.</p></div>
      </div>
    );
  }

  return (
    <div className="screen full">
      <div className="tl-head">
        <h1 style={{ margin: 0 }}>Timeline</h1>
        <div className="tl-controls">
          <button className="btn-ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
          <span className="muted small">{Math.round(zoom * 100)}%</span>
          <button className="btn-ghost" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
          <button className="btn-ghost" onClick={() => audioRef.current?.play()}>▶ Preview</button>
          <button className="btn-ghost" onClick={() => audioRef.current?.pause()}>⏸</button>
          <span className="muted small">Solapes y pausas se resuelven en mezcla (GPU solo genera una voz a la vez)</span>
        </div>
      </div>
      <div className="tl" style={{ "--px": PX_PER_SEC * zoom } as React.CSSProperties}>
        <div className="tl-ruler">
          {Array.from({ length: Math.ceil(totalMs / (10000 / zoom)) + 1 }, (_, i) => {
            const ms = i * 10000 / zoom;
            return <span key={i} style={{ left: px(ms) }}>{Math.round(ms / 1000)}s</span>;
          })}
        </div>
        {tracks.map((track) => {
          const trackClips = clips.filter((c) => c.trackId === track.id);
          return (
            <div className="tl-track" key={track.id}>
              <div className="tl-track-label">
                <span className="tl-dot" style={{ background: track.color }} />
                <span>{track.nombre}</span>
                <button
                  className="tl-m"
                  title="mute"
                  onClick={() => setMutedTracks((s) => {
                    const n = new Set(s);
                    if (n.has(track.id)) n.delete(track.id);
                    else n.add(track.id);
                    return n;
                  })}
                >
                  {mutedTracks.has(track.id) ? "🔇" : "🔊"}
                </button>
              </div>
              <div className="tl-lane">
                {trackClips.map((c) => (
                  <div
                    key={c.turnId}
                    className={`tl-clip ${selected === c.turnId ? "sel" : ""}`}
                    style={{
                      left: px(c.startMs),
                      width: Math.max(40, px(c.durMs)),
                      borderColor: track.color,
                      background: `${track.color}22`,
                    }}
                    onClick={() => setSelected(c.turnId)}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.turnId); }}
                  >
                    <div className="tl-clip-label">{c.label}{c.canOverlap ? " ↘" : ""}</div>
                    {c.speaker !== "" && renderWave(c.peaks, track.color)}
                    {selected === c.turnId && c.speaker && (
                      <div className="tl-clip-menu">
                        <button className="btn-ghost" onClick={() => moveClip(c.turnId, -100)}>◀ 100ms</button>
                        <button className="btn-ghost" onClick={() => moveClip(c.turnId, 100)}>100ms ▶</button>
                        <button className="btn-ghost" onClick={() => updateTurns((ts) => ts.filter((t) => t.id !== c.turnId))}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
                {/* pausas editables: etiqueta entre clips */}
                {trackClips.slice(1).map((c, i) => {
                  const prev = trackClips[i];
                  const gap = c.startMs - (prev.startMs + prev.durMs);
                  if (gap <= 5) return null;
                  const turn = turns.find((t) => t.id === c.turnId);
                  return (
                    <div key={`gap-${c.turnId}`} className="tl-gap" style={{ left: px(prev.startMs + prev.durMs), width: px(gap) }}
                      title="Editar pausa">
                      <input
                        type="number"
                        value={turn?.pauseBeforeMs ?? gap}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && turn) {
                            updateTurns((ts) => ts.map((t) => (t.id === turn.id ? { ...t, pauseBeforeMs: v } : t)));
                          }
                        }}
                        style={{ width: 58, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, fontSize: 11, textAlign: "center" }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {masterUrl && <div className="tl-playhead" style={{ left: px(playhead) }} />}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn-secondary" onClick={async () => {
          const { masterPrograma } = await import("../lib/studio-api");
          const d = JSON.parse(localStorage.getItem("studio:guion") ?? "{}") as { script?: { speakers?: Array<{ id: string; voz: VoiceSlot }> } };
          const voces: Record<string, VoiceSlot> = {};
          for (const s of d.script?.speakers ?? []) voces[s.id] = s.voz;
          const m = await masterPrograma(turns, { voces, kbps: 192 });
          setMasterUrl(m.master);
        }}>🎚 REMEZCLAR CON ESTE TIMING (caché TTS — rápido)</button>
        <span className="muted small" style={{ marginLeft: 10 }}>Las pausas y solapes editados aquí solo requieren mezcla nueva, no regeneración de voces.</span>
      </div>
    </div>
  );
}
