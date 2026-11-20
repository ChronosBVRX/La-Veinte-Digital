"use client"

import {
  Play,
  Pause,
  ArrowCounterClockwise,
  ArrowClockwise,
  SpeakerHigh,
  SpeakerSlash,
  SpotifyLogo,
  ArrowSquareOut,
  X,
} from "@phosphor-icons/react"
import { useRadio } from "../context/RadioContext"

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? "0" : ""}${s}`
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

export function RadioPlayer() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    isMuted,
    togglePlay,
    seek,
    skip,
    setRate,
    toggleMute,
    closePlayer,
    isVisible,
  } = useRadio()

  if (!currentEpisode || !isVisible) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleToggleRate = () => {
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate)
    const nextIdx = (currentIdx + 1) % PLAYBACK_RATES.length
    setRate(PLAYBACK_RATES[nextIdx])
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--card)",
        borderTop: "2px solid var(--primary)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.12)",
        padding: "0.75rem 1rem",
        borderRadius: "12px 12px 0 0",
        maxWidth: "100%",
      }}
    >
      {/* Progress scrub bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--muted)", minWidth: "35px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {formatSeconds(currentTime)}
        </span>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: "100%",
              height: "5px",
              borderRadius: "3px",
              background: `linear-gradient(to right, var(--primary) ${progressPercent}%, var(--border) ${progressPercent}%)`,
              outline: "none",
              cursor: "pointer",
              WebkitAppearance: "none",
            }}
            aria-label="Progreso del episodio"
          />
        </div>
        <span style={{ fontSize: "0.6875rem", color: "var(--muted)", minWidth: "35px", fontVariantNumeric: "tabular-nums" }}>
          {duration > 0 ? formatSeconds(duration) : (currentEpisode.duration || "--:--")}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        {/* Episode Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--fg)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "min(380px, 60vw)",
              }}
              title={currentEpisode.title}
            >
              {currentEpisode.title}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>La Veinte Radio</span>
              {currentEpisode.formattedDate && <span>• {currentEpisode.formattedDate}</span>}
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Skip -15s */}
          <button
            onClick={() => skip(-15)}
            title="Retroceder 15 segundos"
            aria-label="Retroceder 15 segundos"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "50%",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowCounterClockwise size={20} weight="bold" />
          </button>

          {/* Main Play / Pause */}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
            }}
          >
            {isPlaying ? (
              <Pause size={22} weight="fill" />
            ) : (
              <Play size={22} weight="fill" style={{ marginLeft: 2 }} />
            )}
          </button>

          {/* Skip +15s */}
          <button
            onClick={() => skip(15)}
            title="Adelantar 15 segundos"
            aria-label="Adelantar 15 segundos"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "50%",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowClockwise size={20} weight="bold" />
          </button>

          {/* Speed selector */}
          <button
            onClick={handleToggleRate}
            title="Velocidad de reproducción"
            style={{
              background: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--fg)",
              cursor: "pointer",
              minWidth: "40px",
            }}
          >
            {playbackRate}x
          </button>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Activar sonido" : "Silenciar"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "50%",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isMuted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}
          </button>

          {/* Open in Spotify */}
          {currentEpisode.link && (
            <a
              href={currentEpisode.link}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir este episodio en Spotify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                color: "#1DB954",
                padding: "0.25rem 0.5rem",
                borderRadius: "6px",
                background: "rgba(29, 185, 84, 0.08)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              <SpotifyLogo size={16} weight="fill" />
              <span className="hide-on-mobile">Spotify</span>
              <ArrowSquareOut size={12} />
            </a>
          )}

          {/* Close player button */}
          <button
            onClick={closePlayer}
            aria-label="Cerrar reproductor"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
