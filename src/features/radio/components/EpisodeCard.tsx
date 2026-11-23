"use client"

import { useState } from "react"
import { Play, Pause, Clock, CalendarBlank, ArrowSquareOut, SpotifyLogo, Radio } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import type { PodcastEpisode } from "../types"

interface EpisodeCardProps {
  episode: PodcastEpisode
  isPlaying: boolean
  isActive: boolean
  onPlay: (episode: PodcastEpisode) => void
  onPause: () => void
}

const DEFAULT_COVER = "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/46879753/46879753-1790947894171-e2a7105671072.jpg"

export function EpisodeCard({
  episode,
  isPlaying,
  isActive,
  onPlay,
  onPause,
}: EpisodeCardProps) {
  const [expanded, setExpanded] = useState(false)

  const handleTogglePlay = () => {
    if (isActive && isPlaying) {
      onPause()
    } else {
      onPlay(episode)
    }
  }

  const coverUrl = episode.imageUrl || DEFAULT_COVER
  const hasLongDescription = episode.cleanDescription.length > 180

  return (
    <Card
      padding="1rem"
      style={{
        border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
        background: isActive ? "rgba(37, 99, 235, 0.04)" : "var(--card)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
        boxShadow: isActive ? "0 4px 16px rgba(37, 99, 235, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* =====================================================================
          Fila principal: Portada (Cover) + Metadatos + Título
         ===================================================================== */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {/* Portada del capítulo estilo Spotify con botón play integrado */}
        <div
          onClick={handleTogglePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleTogglePlay()
            }
          }}
          aria-label={isActive && isPlaying ? `Pausar: ${episode.title}` : `Reproducir: ${episode.title}`}
          style={{
            position: "relative",
            width: "clamp(56px, 15vw, 84px)",
            height: "clamp(56px, 15vw, 84px)",
            borderRadius: "8px",
            overflow: "hidden",
            flexShrink: 0,
            cursor: "pointer",
            background: "var(--accent)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
            border: "1px solid var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={`Portada de ${episode.title}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          {/* Overlay de estado o reproducción */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: isActive && isPlaying ? "rgba(37, 99, 235, 0.45)" : "rgba(0, 0, 0, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isActive && isPlaying ? "#ffffff" : "rgba(255, 255, 255, 0.9)",
                color: isActive && isPlaying ? "var(--primary)" : "var(--fg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.25)",
              }}
            >
              {isActive && isPlaying ? (
                <Pause size={16} weight="fill" />
              ) : (
                <Play size={16} weight="fill" style={{ marginLeft: 2 }} />
              )}
            </div>
          </div>
        </div>

        {/* Información del episodio */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {/* Tags y fecha */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {episode.formattedDate && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <CalendarBlank size={12} weight="bold" />
                {episode.formattedDate}
              </span>
            )}

            {episode.duration && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Clock size={12} weight="bold" />
                {episode.duration}
              </span>
            )}

            {isActive && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: isPlaying ? "#059669" : "var(--primary)",
                  background: isPlaying ? "rgba(16, 185, 129, 0.12)" : "rgba(37, 99, 235, 0.1)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  letterSpacing: "0.03em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Radio size={12} weight="bold" />
                {isPlaying ? "EN REPRODUCCIÓN" : "EN PAUSA"}
              </span>
            )}
          </div>

          {/* Nombre del capítulo */}
          <h3
            onClick={handleTogglePlay}
            style={{
              fontSize: "clamp(0.9375rem, 2vw, 1.0625rem)",
              fontWeight: 700,
              lineHeight: 1.35,
              color: isActive ? "var(--primary)" : "var(--fg)",
              margin: 0,
              cursor: "pointer",
            }}
          >
            {episode.title}
          </h3>

          {/* Resumen / Descripción clamped */}
          {episode.cleanDescription && (
            <div style={{ marginTop: "0.25rem" }}>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                  margin: 0,
                  display: expanded ? "block" : "-webkit-box",
                  WebkitLineClamp: expanded ? undefined : 2,
                  WebkitBoxOrient: "vertical",
                  overflow: expanded ? "visible" : "hidden",
                }}
              >
                {episode.cleanDescription}
              </p>

              {hasLongDescription && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "0.25rem 0 0",
                    display: "inline-block",
                  }}
                >
                  {expanded ? "Mostrar menos" : "Leer descripción completa"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          Fila de acciones: Botón Reproducir / Pausar + Abrir en Spotify
         ===================================================================== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "0.625rem",
          borderTop: "1px solid var(--border)",
          gap: "0.625rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={isActive && isPlaying ? "Pausar episodio" : "Reproducir episodio"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            background: isActive && isPlaying ? "var(--accent)" : "var(--primary)",
            color: isActive && isPlaying ? "var(--fg)" : "var(--primary-fg)",
            border: isActive && isPlaying ? "1px solid var(--border)" : "none",
            borderRadius: "999px",
            padding: "0.45rem 1rem",
            fontSize: "0.8125rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: isActive && isPlaying ? "none" : "0 2px 6px rgba(37, 99, 235, 0.25)",
          }}
        >
          {isActive && isPlaying ? (
            <>
              <Pause size={14} weight="fill" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play size={14} weight="fill" />
              <span>{isActive ? "Reanudar" : "Reproducir episodio"}</span>
            </>
          )}
        </button>

        {episode.link && (
          <a
            href={episode.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#1DB954",
              background: "rgba(29, 185, 84, 0.08)",
              border: "1px solid rgba(29, 185, 84, 0.2)",
              padding: "0.4rem 0.75rem",
              borderRadius: "8px",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            <SpotifyLogo size={15} weight="fill" />
            <span>Escuchar en Spotify</span>
            <ArrowSquareOut size={12} />
          </a>
        )}
      </div>
    </Card>
  )
}
