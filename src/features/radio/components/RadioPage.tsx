"use client"

import { useState, useMemo } from "react"
import {
  Radio,
  SpotifyLogo,
  ArrowSquareOut,
  MagnifyingGlass,
  Users,
  Sparkle,
  Rss,
  Check,
  Copy,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Input } from "@/shared/components/ui/Input"
import { EpisodeCard } from "./EpisodeCard"
import { useRadio } from "../context/RadioContext"
import type { PodcastEpisode, PodcastShow } from "../types"

interface RadioPageProps {
  initialShow: PodcastShow
}

export function RadioPage({ initialShow }: RadioPageProps) {
  const [show] = useState<PodcastShow>(initialShow)
  const { currentEpisode, isPlaying, playEpisode, pause } = useRadio()
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedRss, setCopiedRss] = useState(false)

  const handlePlayEpisode = (episode: PodcastEpisode) => {
    playEpisode(episode)
  }

  const handlePause = () => {
    pause()
  }

  const handleCopyRss = () => {
    navigator.clipboard.writeText(show.feedUrl).then(() => {
      setCopiedRss(true)
      setTimeout(() => setCopiedRss(false), 2500)
    })
  }

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return show.episodes
    const q = searchQuery.toLowerCase()
    return show.episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.cleanDescription.toLowerCase().includes(q)
    )
  }, [show.episodes, searchQuery])

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        paddingBottom: currentEpisode ? "96px" : "2rem",
      }}
    >
      {/* Header Banner */}
      <Card
        padding="1.5rem"
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(29, 185, 84, 0.06) 100%), var(--card)",
          border: "1px solid var(--border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Podcast Cover Art */}
          {show.imageUrl && (
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                flexShrink: 0,
                border: "1px solid var(--border)",
                background: "var(--accent)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={show.imageUrl}
                alt={show.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}

          {/* Show Info */}
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  background: "rgba(37, 99, 235, 0.1)",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                  letterSpacing: "0.04em",
                }}
              >
                <Radio size={14} weight="bold" />
                PODCAST OFICIAL
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#059669",
                  background: "rgba(16, 185, 129, 0.1)",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                }}
              >
                <Sparkle size={13} weight="fill" />
                Voz e Inteligencia Artificial
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                fontWeight: 800,
                color: "var(--fg)",
                margin: "0 0 0.5rem 0",
                letterSpacing: "-0.02em",
              }}
            >
              {show.title}
            </h1>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--muted)",
                lineHeight: 1.55,
                margin: "0 0 1rem 0",
                maxWidth: "750px",
              }}
            >
              {show.description}
            </p>

            {/* Panel & Host Tags */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                <Users size={15} weight="bold" />
                <span><strong>Panel virtual:</strong> Eduardo, Andrea, Javier, Rodrigo y Valeria</span>
              </div>
            </div>

            {/* External Links & Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <a
                href={show.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "#1DB954",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "8px",
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(29, 185, 84, 0.3)",
                  transition: "opacity 0.15s",
                }}
              >
                <SpotifyLogo size={18} weight="fill" />
                <span>Canal en Spotify</span>
                <ArrowSquareOut size={14} />
              </a>

              <button
                onClick={handleCopyRss}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  background: "var(--card)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  padding: "0.45rem 0.8rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {copiedRss ? (
                  <>
                    <Check size={16} weight="bold" color="#10b981" />
                    <span>¡Feed copiado!</span>
                  </>
                ) : (
                  <>
                    <Rss size={16} weight="bold" color="#f97316" />
                    <span>Copiar Feed RSS</span>
                    <Copy size={13} style={{ marginLeft: 2 }} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Episodes Search & List Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Episodios Disponibles
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
            {filteredEpisodes.length} {filteredEpisodes.length === 1 ? "episodio" : "episodios"} listos para reproducir
          </p>
        </div>

        <div style={{ width: "min(320px, 100%)" }}>
          <Input
            placeholder="Buscar por tema, cláusula o palabra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Episodes List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filteredEpisodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            isPlaying={isPlaying && currentEpisode?.id === ep.id}
            isActive={currentEpisode?.id === ep.id}
            onPlay={handlePlayEpisode}
            onPause={handlePause}
          />
        ))}

        {filteredEpisodes.length === 0 && (
          <Card padding="2rem" style={{ textAlign: "center", color: "var(--muted)" }}>
            <MagnifyingGlass size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>
              No se encontraron episodios que coincidan con &quot;{searchQuery}&quot;.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
