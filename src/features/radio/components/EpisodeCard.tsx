"use client"

import { useState } from "react"
import { Play, Pause, Clock, CalendarBlank, ArrowSquareOut, SpotifyLogo } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { PodcastEpisode } from "../types"

interface EpisodeCardProps {
  episode: PodcastEpisode
  isPlaying: boolean
  isActive: boolean
  onPlay: (episode: PodcastEpisode) => void
  onPause: () => void
}

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

  const hasLongDescription = episode.cleanDescription.length > 200

  return (
    <Card
      padding="1rem"
      style={{
        border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
        background: isActive ? "rgba(37, 99, 235, 0.03)" : "var(--card)",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isActive ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
        <button
          onClick={handleTogglePlay}
          aria-label={isActive && isPlaying ? "Pausar episodio" : "Reproducir episodio"}
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: isActive && isPlaying ? "var(--primary)" : "var(--accent)",
            color: isActive && isPlaying ? "var(--primary-fg)" : "var(--primary)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "transform 0.15s, background 0.15s",
          }}
        >
          {isActive && isPlaying ? (
            <Pause size={20} weight="fill" />
          ) : (
            <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
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
                <CalendarBlank size={13} weight="bold" />
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
                  background: "var(--accent)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                }}
              >
                <Clock size={13} weight="bold" />
                {episode.duration}
              </span>
            )}
            {isActive && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  background: "rgba(37, 99, 235, 0.1)",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  letterSpacing: "0.02em",
                }}
              >
                {isPlaying ? "EN REPRODUCCIÓN" : "EN PAUSA"}
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              lineHeight: 1.35,
              color: "var(--fg)",
              margin: 0,
            }}
          >
            {episode.title}
          </h3>
        </div>
      </div>

      {episode.cleanDescription && (
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5, paddingLeft: "3.625rem" }}>
          <p style={{ margin: 0 }}>
            {expanded || !hasLongDescription
              ? episode.cleanDescription
              : `${episode.cleanDescription.slice(0, 180)}...`}
          </p>
          {hasLongDescription && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.25rem 0 0",
              }}
            >
              {expanded ? "Mostrar menos" : "Leer descripción completa"}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--border)",
          paddingLeft: "3.625rem",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <Button
          variant={isActive && isPlaying ? "secondary" : "primary"}
          size="sm"
          onClick={handleTogglePlay}
        >
          {isActive && isPlaying ? (
            <>
              <Pause size={14} weight="bold" />
              Pausar
            </>
          ) : (
            <>
              <Play size={14} weight="bold" />
              {isActive ? "Reanudar" : "Reproducir en La 20"}
            </>
          )}
        </Button>

        {episode.link && (
          <a
            href={episode.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--muted)",
              textDecoration: "none",
              padding: "0.35rem 0.6rem",
              borderRadius: "6px",
              background: "var(--accent)",
              transition: "color 0.15s",
            }}
          >
            <SpotifyLogo size={14} weight="fill" color="#1DB954" />
            <span>Abrir en Spotify</span>
            <ArrowSquareOut size={12} />
          </a>
        )}
      </div>
    </Card>
  )
}
