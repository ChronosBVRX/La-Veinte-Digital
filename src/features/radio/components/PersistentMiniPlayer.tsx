"use client"

import Link from "next/link"
import {
  Play,
  Pause,
  ArrowCounterClockwise,
  ArrowClockwise,
  X,
  Radio,
  CaretRight,
} from "@phosphor-icons/react"
import { useRadio } from "../context/RadioContext"

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? "0" : ""}${s}`
}

export function PersistentMiniPlayer() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    skip,
    closePlayer,
    isVisible,
  } = useRadio()

  if (!currentEpisode || !isVisible) {
    return null
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <aside
      aria-label="Reproductor persistente de La Veinte Radio"
      className="persistent-radio-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        zIndex: 40,
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        height: "calc(var(--mobile-value-bar-height) + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -2px 12px rgba(0, 0, 0, 0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {/* Micro progress bar en el borde superior */}
      <div
        style={{
          width: "100%",
          height: "3px",
          background: "var(--border)",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "var(--primary)",
            transition: "width 0.25s linear",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.5rem 0 0.75rem",
          gap: "0.5rem",
          minWidth: 0,
        }}
      >
        {/* Info del episodio con enlace a /radio */}
        <Link
          href="/radio"
          aria-label={`Ir a La Veinte Radio: ${currentEpisode.title}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "inherit",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {currentEpisode.imageUrl ? (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "6px",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid var(--border)",
                background: "var(--accent)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentEpisode.imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "6px",
                background: "rgba(37, 99, 235, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Radio size={18} weight="bold" />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--fg)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.25,
              }}
            >
              {currentEpisode.title}
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                lineHeight: 1.2,
                marginTop: "1px",
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>La 20 Radio</span>
              <span>•</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatSeconds(currentTime)} / {duration > 0 ? formatSeconds(duration) : (currentEpisode.duration || "--:--")}
              </span>
              <CaretRight size={10} weight="bold" />
            </div>
          </div>
        </Link>

        {/* Controles de reproducción */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          {/* Skip -15s */}
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
            <ArrowCounterClockwise size={18} weight="bold" />
          </button>

          {/* Play / Pause principal */}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar episodio" : "Reproducir episodio"}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.35)",
            }}
          >
            {isPlaying ? (
              <Pause size={18} weight="fill" />
            ) : (
              <Play size={18} weight="fill" style={{ marginLeft: 2 }} />
            )}
          </button>

          {/* Skip +15s */}
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
            <ArrowClockwise size={18} weight="bold" />
          </button>

          {/* Cerrar / Ocultar */}
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
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </aside>
  )
}
