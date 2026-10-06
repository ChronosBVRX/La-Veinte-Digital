"use client"

import { useState, useMemo } from "react"
import { ArrowSquareOut, CaretLeft, CaretRight, Images, Newspaper, X } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { FACEBOOK_PAGES, type FacebookPost } from "../types"

interface FacebookPostCardProps {
  post: FacebookPost
  compact?: boolean
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  const pageConfig = FACEBOOK_PAGES[post.pageKey] ?? FACEBOOK_PAGES.seccionxx
  const { headline, body } = useMemo(
    () => splitHeadlineAndBody(post.contentText),
    [post.contentText],
  )

  const validImages = useMemo(
    () => post.mediaUrls.filter((u) => !failedImages[u]),
    [post.mediaUrls, failedImages],
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

          {/* Galería de imágenes nativa */}
          {visibleGridImages.length > 0 && (
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
              {visibleGridImages.map((imgUrl, idx) => {
                const isLastWithOverflow =
                  idx === visibleGridImages.length - 1 && extraImagesCount > 0
                return (
                  <div
                    key={imgUrl}
                    style={{
                      position: "relative",
                      gridColumn:
                        visibleGridImages.length === 3 && idx === 0 ? "1 / -1" : undefined,
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
                      alt={headline ?? `Imagen ${idx + 1} de ${pageConfig.name}`}
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
                        onClick={() => setLightboxIndex(idx)}
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
