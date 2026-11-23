"use client"

import Link from "next/link"
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
  Radio,
} from "@phosphor-icons/react"
import { useRadio } from "../context/RadioContext"

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? "0" : ""}${s}`
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

export function PersistentMiniPlayer() {
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

  if (!currentEpisode || !isVisible) {
    return null
  }

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  const handleToggleRate = () => {
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate)
    const nextIdx = (currentIdx + 1) % PLAYBACK_RATES.length
    setRate(PLAYBACK_RATES[nextIdx])
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }

  return (
    <aside
      aria-label="Reproductor persistente de La Veinte Radio"
      className="spotify-radio-bar"
    >
      {/* 1. Micro-barra de progreso superior */}
      <div
        style={{
          width: "100%",
          height: "3px",
          background: "var(--border)",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={(e) => {
          if (duration <= 0) return
          const rect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const percent = Math.min(1, Math.max(0, clickX / rect.width))
          seek(percent * duration)
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "var(--primary)",
            transition: "width 0.15s linear",
          }}
        />
      </div>

      <div className="spotify-radio-bar__content">
        {/* =====================================================================
            COLUMNA IZQUIERDA: Portada + Título + Subtítulo (Estilo Spotify)
           ===================================================================== */}
        <div className="spotify-radio-bar__left">
          <Link
            href="/radio"
            aria-label={`Ver episodio: ${currentEpisode.title}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              textDecoration: "none",
              color: "inherit",
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
            }}
          >
            {/* Portada del capítulo */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "8px",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid var(--border)",
                background: "var(--accent)",
                boxShadow: "0 3px 8px rgba(0, 0, 0, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {currentEpisode.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentEpisode.imageUrl}
                  alt={currentEpisode.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Radio size={22} weight="bold" />
                </div>
              )}
            </div>

            {/* Nombre del capítulo y metadatos */}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.25,
                }}
                title={currentEpisode.title}
              >
                {currentEpisode.title}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  lineHeight: 1.2,
                  marginTop: "2px",
                }}
              >
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>La 20 Radio</span>
                <span>•</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatSeconds(currentTime)} / {duration > 0 ? formatSeconds(duration) : (currentEpisode.duration || "--:--")}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* =====================================================================
            COLUMNA CENTRAL: Controles Principales + Línea de Tiempo
           ===================================================================== */}
        <div className="spotify-radio-bar__center">
          {/* Fila de controles de reproducción */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Selector de velocidad (Desktop) */}
            <button
              onClick={handleToggleRate}
              className="spotify-radio-bar__desktop-only"
              title="Velocidad de reproducción"
              aria-label={`Velocidad actual: ${playbackRate}x`}
              style={{
                background: "var(--accent)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "0.2rem 0.45rem",
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--fg)",
                cursor: "pointer",
                minWidth: "34px",
              }}
            >
              {playbackRate}x
            </button>

            {/* Retroceder 15s */}
            <button
              onClick={() => skip(-15)}
              title="Retroceder 15s"
              aria-label="Retroceder 15 segundos"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.35rem",
                borderRadius: "50%",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowCounterClockwise size={19} weight="bold" />
            </button>

            {/* Botón Circular Principal Play / Pause */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pausar episodio" : "Reproducir episodio"}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--primary)",
                color: "var(--primary-fg)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)",
                transition: "transform 0.15s, background-color 0.15s",
                flexShrink: 0,
              }}
            >
              {isPlaying ? (
                <Pause size={19} weight="fill" />
              ) : (
                <Play size={19} weight="fill" style={{ marginLeft: 2 }} />
              )}
            </button>

            {/* Adelantar 15s */}
            <button
              onClick={() => skip(15)}
              title="Adelantar 15s"
              aria-label="Adelantar 15 segundos"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.35rem",
                borderRadius: "50%",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowClockwise size={19} weight="bold" />
            </button>

            {/* Acceso a Spotify (Desktop icon) */}
            {currentEpisode.link && (
              <a
                href={currentEpisode.link}
                target="_blank"
                rel="noopener noreferrer"
                className="spotify-radio-bar__desktop-only"
                title="Abrir este episodio en Spotify"
                style={{
                  background: "rgba(29, 185, 84, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  padding: "0.35rem",
                  color: "#1DB954",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                <SpotifyLogo size={18} weight="fill" />
              </a>
            )}
          </div>

          {/* Fila inferior: Línea de tiempo deslizable (Scrub bar) */}
          <div className="spotify-radio-bar__scrub">
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                minWidth: "36px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
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
                aria-label="Progreso del episodio"
                style={{
                  width: "100%",
                  height: "5px",
                  borderRadius: "3px",
                  background: `linear-gradient(to right, var(--primary) ${progressPercent}%, var(--border) ${progressPercent}%)`,
                  outline: "none",
                  cursor: "pointer",
                  WebkitAppearance: "none",
                }}
              />
            </div>

            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                minWidth: "36px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {duration > 0 ? formatSeconds(duration) : (currentEpisode.duration || "--:--")}
            </span>
          </div>
        </div>

        {/* =====================================================================
            COLUMNA DERECHA: Opciones adicionales y Cierre
           ===================================================================== */}
        <div className="spotify-radio-bar__right">
          {/* Silenciar / Activar sonido (Desktop) */}
          <button
            onClick={toggleMute}
            className="spotify-radio-bar__desktop-only"
            title={isMuted ? "Activar sonido" : "Silenciar"}
            aria-label={isMuted ? "Activar sonido" : "Silenciar"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.35rem",
              borderRadius: "50%",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isMuted ? <SpeakerSlash size={19} /> : <SpeakerHigh size={19} />}
          </button>

          {/* Enlace Spotify con etiqueta (Desktop) */}
          {currentEpisode.link && (
            <a
              href={currentEpisode.link}
              target="_blank"
              rel="noopener noreferrer"
              className="spotify-radio-bar__desktop-only"
              title="Abrir este episodio en Spotify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.75rem",
                color: "#1DB954",
                padding: "0.25rem 0.55rem",
                borderRadius: "6px",
                background: "rgba(29, 185, 84, 0.08)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              <SpotifyLogo size={16} weight="fill" />
              <span>Spotify</span>
              <ArrowSquareOut size={12} />
            </a>
          )}

          {/* Cerrar reproductor */}
          <button
            onClick={closePlayer}
            title="Cerrar reproductor"
            aria-label="Cerrar reproductor"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.35rem",
              borderRadius: "50%",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "0.25rem",
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>
    </aside>
  )
}
