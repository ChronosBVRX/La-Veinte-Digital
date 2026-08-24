import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

/**
 * MiniPlayer — reproductor compacto estilo estudio premium.
 * Un solo <audio> por instancia; barra de progreso clickeable y
 * ecualizador animado mientras suena.
 */
export function MiniPlayer({
  src,
  label,
  accent,
  compact,
  onPlayStateChange,
}: {
  src: string;
  label?: string;
  accent?: string;
  compact?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setPos(0);
      onPlayStateChange?.(false);
    };
    const onPause = () => {
      setPlaying(false);
      onPlayStateChange?.(false);
    };
    const onPlay = () => {
      setPlaying(true);
      onPlayStateChange?.(true);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, [onPlayStateChange]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = frac * dur;
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const bars = compact ? 3 : 5;

  return (
    <div className={`mini-player ${compact ? "compact" : ""} ${playing ? "is-playing" : ""}`}>
      <audio ref={ref} preload="none" src={src} />
      <button
        className="mini-play"
        style={accent ? ({ "--mp-accent": accent } as CSSProperties) : undefined}
        onClick={toggle}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? (
          <span className="eq">
            {Array.from({ length: bars }).map((_, i) => (
              <i key={i} />
            ))}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="mini-track" onClick={seek}>
        <div className="mini-fill" style={{ width: dur > 0 ? `${(pos / dur) * 100}%` : "0%" }} />
      </div>
      <span className="mini-time">{fmt(pos)} / {fmt(dur)}</span>
      {label && <span className="mini-label">{label}</span>}
    </div>
  );
}

/** Colores oficiales por rol para todo el estudio. */
export function colorDeLocutor(locutor: string): string {
  const l = locutor.toUpperCase();
  if (l.includes("EDUARDO")) return "#3b82f6";
  if (l.includes("MARIANA") || l.includes("ANDREA")) return "#ec4899";
  if (l.includes("NARRADOR") || l.includes("ALONSO")) return "#8b5cf6";
  if (l.includes("RODRIGO") || l.includes("CORRESPONSAL")) return "#f59e0b";
  if (l.includes("VALERIA") || l.includes("COMERCIAL")) return "#10b981";
  return "#64748b";
}

export function nombreCorto(locutor: string): string {
  const l = locutor.toUpperCase();
  if (l.includes("EDUARDO")) return "Eduardo";
  if (l.includes("MARIANA") || l.includes("ANDREA")) return "Andrea";
  if (l.includes("NARRADOR") || l.includes("ALONSO")) return "Alonso";
  if (l.includes("RODRIGO") || l.includes("CORRESPONSAL")) return "Rodrigo";
  if (l.includes("VALERIA") || l.includes("COMERCIAL")) return "Valeria";
  return locutor;
}
