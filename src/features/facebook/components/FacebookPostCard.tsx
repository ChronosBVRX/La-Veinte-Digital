"use client"

import { useState, useMemo } from "react"
import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  Images,
  Newspaper,
  Play,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { FACEBOOK_PAGES, type FacebookPost } from "../types"

interface FacebookPostCardProps {
  post: FacebookPost
  compact?: boolean
}

export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false
  const clean = url.split("?")[0].toLowerCase()
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".ogg") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    url.includes("/video/") ||
    url.includes("video_url")
  )
}

export function isFacebookVideoUrl(url: string): boolean {
  if (!url) return false
  return (
    url.includes("/videos/") ||
    url.includes("/reel/") ||
    url.includes("/watch/") ||
    url.includes("fb.watch")
  )
}

export function formatPostRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""

    const diffMs = Date.now() - date.getTime()
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    const calendarLabel = new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date)

    if (diffMinutes < 60) {
      return `Hace ${diffMinutes} min · ${calendarLabel}`
    }
    if (diffHours < 24) {
      return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"} · ${calendarLabel}`
    }
    if (diffDays <= 7) {
      return `Hace ${diffDays} ${diffDays === 1 ? "día" : "días"} · ${calendarLabel}`
    }
    return calendarLabel
  } catch {
    return ""
  }
}

export function splitHeadlineAndBody(text: string): {
  headline: string | null
  body: string
} {
  const trimmed = (text || "").trim()
  if (!trimmed) return { headline: null, body: "" }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length >= 2 && lines[0].length <= 130) {
    return {
      headline: lines[0],
      body: lines.slice(1).join("\n\n"),
    }
  }

  return { headline: null, body: trimmed }
}

export function FacebookPostCard({ post, compact = false }: FacebookPostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPlayingVideo, setIsPlayingVideo] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  const pageConfig = FACEBOOK_PAGES[post.pageKey] ?? FACEBOOK_PAGES.seccionxx
  const { headline, body } = useMemo(
    () => splitHeadlineAndBody(post.contentText),
    [post.contentText],
  )

  const { directVideoUrls, validImages } = useMemo(() => {
    const directVideos: string[] = []
    const imgs: string[] = []

    for (const u of post.mediaUrls) {
      if (failedImages[u]) continue
      if (isDirectVideoUrl(u)) {
        directVideos.push(u)
      } else {
        imgs.push(u)
      }
    }

    return { directVideoUrls: directVideos, validImages: imgs }
  }, [post.mediaUrls, failedImages])

  const isVideoPost = useMemo(() => {
    return Boolean(
      post.isVideo ||
      post.videoUrl ||
      directVideoUrls.length > 0 ||
      isFacebookVideoUrl(post.permalinkUrl),
    )
  }, [post.isVideo, post.videoUrl, directVideoUrls, post.permalinkUrl])

  const isReel = useMemo(() => {
    return Boolean(
      post.permalinkUrl.includes("/reel/") ||
      (post.videoUrl && post.videoUrl.includes("/reel/")),
    )
  }, [post.permalinkUrl, post.videoUrl])

  const targetVideoUrl = useMemo(() => {
    if (directVideoUrls.length > 0) return directVideoUrls[0]
    if (post.videoUrl) return post.videoUrl
    if (isFacebookVideoUrl(post.permalinkUrl)) return post.permalinkUrl
    return null
  }, [directVideoUrls, post.videoUrl, post.permalinkUrl])

  const isDirectVideo = Boolean(
    directVideoUrls.length > 0 || (targetVideoUrl && isDirectVideoUrl(targetVideoUrl)),
  )

  const maxChars = compact ? 180 : 340
  const isLongText = body.length > maxChars
  const visibleBody =
    !expanded && isLongText ? `${body.slice(0, maxChars).trimEnd()}…` : body

  const dateLabel = useMemo(() => formatPostRelativeDate(post.publishedAt), [post.publishedAt])

  const visibleGridImages = validImages.slice(0, compact ? 1 : 4)
  const extraImagesCount = Math.max(0, validImages.length - visibleGridImages.length)

  return (
    <>
      <Card
        padding={compact ? "1rem" : "1.25rem"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? "0.75rem" : "0.95rem",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? "0.65rem" : "0.85rem" }}>
          {/* Cabecera institucional */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: compact ? 34 : 38,
                  height: compact ? 34 : 38,
                  borderRadius: "var(--radius)",
                  background: `${pageConfig.accentColor}16`,
                  border: `1px solid ${pageConfig.accentColor}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: pageConfig.accentColor,
                  flexShrink: 0,
                }}
              >
                <Newspaper size={compact ? 18 : 20} weight="duotone" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: compact ? "0.8125rem" : "0.875rem",
                      fontWeight: 700,
                      color: "var(--fg)",
                      lineHeight: 1.2,
                    }}
                  >
                    {pageConfig.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "0.125rem 0.45rem",
                      borderRadius: "999px",
                      background: `${pageConfig.accentColor}15`,
                      color: pageConfig.accentColor,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {pageConfig.shortName}
                  </span>
                  {post.category && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "999px",
                        background: "var(--accent)",
                        color: "var(--fg)",
                        border: "1px solid var(--border)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {post.category}
                    </span>
                  )}
                  {isVideoPost && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "0.125rem 0.45rem",
                        borderRadius: "999px",
                        background: "#dc262615",
                        color: "#dc2626",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        letterSpacing: "0.01em",
                      }}
                    >
                      <VideoCamera size={12} weight="fill" />
                      {isReel ? "Reel" : "Video"}
                    </span>
                  )}
                </div>
                {dateLabel && (
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      lineHeight: 1.25,
                    }}
                  >
                    {dateLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Titular y cuerpo */}
          {(headline || visibleBody) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {headline && (
                <h3
                  style={{
                    margin: 0,
                    fontSize: compact ? "0.9rem" : "1rem",
                    fontWeight: 700,
                    color: "var(--fg)",
                    lineHeight: 1.35,
                  }}
                >
                  {headline}
                </h3>
              )}
              {post.summary && !expanded && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "calc(var(--radius) - 2px)",
                    background: "var(--accent)",
                    borderLeft: `3px solid ${pageConfig.accentColor}`,
                    fontSize: "0.8125rem",
                    color: "var(--fg)",
                    lineHeight: 1.35,
                    fontStyle: "italic",
                  }}
                >
                  💡 <strong>Resumen:</strong> {post.summary}
                </div>
              )}
              {visibleBody && (
                <p
                  style={{
                    margin: 0,
                    fontSize: compact ? "0.8125rem" : "0.875rem",
                    color: "var(--fg)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-line",
                    wordBreak: "break-word",
                  }}
                >
                  {visibleBody}
                </p>
              )}
              {isLongText && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((prev) => !prev)}
                    style={{
                      padding: "0.2rem 0.45rem",
                      minHeight: 28,
                      fontSize: "0.75rem",
                      color: "var(--primary)",
                    }}
                  >
                    {expanded ? "Mostrar menos" : "Leer comunicado completo"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Reproductor de Video */}
          {isVideoPost && (
            <div style={{ width: "100%", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {isPlayingVideo ? (
                isDirectVideo && targetVideoUrl ? (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    <video
                      src={targetVideoUrl}
                      controls
                      autoPlay
                      playsInline
                      preload="metadata"
                      style={{
                        width: "100%",
                        maxHeight: compact ? 280 : 420,
                        display: "block",
                      }}
                    />
                  </div>
                ) : targetVideoUrl ? (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: isReel ? "9 / 16" : "16 / 9",
                      maxHeight: compact ? 340 : 480,
                      background: "#0f172a",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                    }}
                  >
                    <iframe
                      src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(targetVideoUrl)}&show_text=false&width=500`}
                      width="100%"
                      height="100%"
                      style={{ border: "none", overflow: "hidden", width: "100%", height: "100%" }}
                      scrolling="no"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      title={headline ?? "Video oficial de la Sección XX"}
                    />
                  </div>
                ) : null
              ) : validImages.length > 0 ? (
                /* Video con miniatura de portada */
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: isReel ? "9 / 16" : compact ? "16 / 9" : "16 / 10",
                    maxHeight: compact ? 260 : 360,
                    background: "#0f172a",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                  onClick={() => setIsPlayingVideo(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={validImages[0]}
                    alt={headline ?? `Video de ${pageConfig.name}`}
                    loading="lazy"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [validImages[0]]: true,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {/* Capa de reproducción */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.25) 60%, transparent 100%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        width: compact ? 46 : 56,
                        height: compact ? 46 : 56,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.95)",
                        color: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                      }}
                    >
                      <Play size={compact ? 22 : 26} weight="fill" />
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#ffffff",
                        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        background: "rgba(15, 23, 42, 0.65)",
                        padding: "0.2rem 0.65rem",
                        borderRadius: "999px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <VideoCamera size={13} weight="fill" />
                      {isReel ? "Reproducir Reel" : "Reproducir Video"}
                    </span>
                  </div>
                </div>
              ) : (
                /* Video sin imagen previa (p. ej. Reels o transmisiones) */
                <div
                  style={{
                    position: "relative",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    border: "1px solid var(--border)",
                    padding: compact ? "1.1rem 1rem" : "1.4rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: "0.75rem",
                    minHeight: compact ? 130 : 160,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={isReel ? "Reproducir reel" : "Reproducir video"}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      cursor: "pointer",
                      transition: "transform 0.15s ease",
                    }}
                    onClick={() => setIsPlayingVideo(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setIsPlayingVideo(true)
                      }
                    }}
                  >
                    <Play size={24} weight="fill" />
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <VideoCamera size={14} weight="duotone" />
                      {isReel ? "Reel oficial" : "Video oficial"} · {pageConfig.shortName}
                    </span>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "#e2e8f0" }}>
                      Publicación oficial en formato video
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsPlayingVideo(true)}
                      leadingIcon={<Play size={14} weight="fill" />}
                    >
                      Reproducir video
                    </Button>
                    <a
                      href={post.permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#94a3b8",
                        textDecoration: "none",
                        padding: "0.35rem 0.6rem",
                      }}
                    >
                      Ver en Facebook
                      <ArrowSquareOut size={13} weight="bold" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Galería de imágenes nativa (cuando no es video exclusivo con miniatura única) */}
          {(!isVideoPost || validImages.length > 1) && visibleGridImages.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  visibleGridImages.length === 1
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))",
                gap: "0.5rem",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {(isVideoPost ? visibleGridImages.slice(1) : visibleGridImages).map((imgUrl, idx) => {
                const adjustedIndex = isVideoPost ? idx + 1 : idx
                const isLastWithOverflow =
                  adjustedIndex === visibleGridImages.length - 1 && extraImagesCount > 0
                return (
                  <div
                    key={imgUrl}
                    style={{
                      position: "relative",
                      gridColumn:
                        visibleGridImages.length === 3 && adjustedIndex === 0
                          ? "1 / -1"
                          : undefined,
                      background: "var(--accent)",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      aspectRatio:
                        visibleGridImages.length === 1
                          ? compact
                            ? "16 / 9"
                            : "16 / 10"
                          : "4 / 3",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={headline ?? `Imagen ${adjustedIndex + 1} de ${pageConfig.name}`}
                      loading="lazy"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [imgUrl]: true,
                        }))
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                        padding: "0.4rem",
                        background: isLastWithOverflow
                          ? "rgba(15, 23, 42, 0.55)"
                          : "linear-gradient(to top, rgba(15, 23, 42, 0.35), transparent 55%)",
                      }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setLightboxIndex(adjustedIndex)}
                        leadingIcon={<Images size={14} weight="duotone" />}
                        style={{
                          minHeight: 28,
                          padding: "0.2rem 0.55rem",
                          fontSize: "0.72rem",
                          background: "rgba(255, 255, 255, 0.92)",
                          color: "#0f172a",
                        }}
                      >
                        {isLastWithOverflow ? `+${extraImagesCount} fotos` : "Ampliar"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pie con enlace a fuente original */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            paddingTop: "0.65rem",
            borderTop: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--muted)",
              fontWeight: 500,
            }}
          >
            Fuente oficial · {pageConfig.shortName}
          </span>
          <a
            href={post.permalinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            Ver post original
            <ArrowSquareOut size={14} weight="bold" />
          </a>
        </div>
      </Card>

      {/* Visor modal de imágenes */}
      {lightboxIndex !== null && validImages[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imágenes de noticia"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(15, 23, 42, 0.88)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 920,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
              color: "#ffffff",
            }}
          >
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
              {pageConfig.name} · Imagen {lightboxIndex + 1} de {validImages.length}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLightboxIndex(null)}
              leadingIcon={<X size={16} weight="bold" />}
            >
              Cerrar
            </Button>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 920,
              maxHeight: "78vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0f172a",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={validImages[lightboxIndex]}
              alt={headline ?? pageConfig.name}
              style={{
                maxWidth: "100%",
                maxHeight: "76vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>

          {validImages.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.85rem",
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + validImages.length) % validImages.length,
                  )
                }
                leadingIcon={<CaretLeft size={16} weight="bold" />}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLightboxIndex((lightboxIndex + 1) % validImages.length)}
                trailingIcon={<CaretRight size={16} weight="bold" />}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
