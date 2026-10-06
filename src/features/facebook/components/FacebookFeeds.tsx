"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowSquareOut, Newspaper } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { FACEBOOK_PAGES, type FacebookPost } from "../types"
import { FacebookPostCard } from "./FacebookPostCard"

interface Props {
  compact?: boolean
  initialPosts?: FacebookPost[]
}

export function FacebookFeeds({ compact = false, initialPosts }: Props) {
  const [posts, setPosts] = useState<FacebookPost[]>(initialPosts ?? [])
  const [loading, setLoading] = useState(!initialPosts || initialPosts.length === 0)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      return
    }
    let cancelled = false

    async function loadPosts() {
      try {
        const res = await fetch("/api/facebook/posts?limit=30")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setPosts(data.items)
        }
      } catch {
        // Conservar initialPosts o estado vacío con fallback institucional
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPosts()
    return () => {
      cancelled = true
    }
  }, [initialPosts])

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const p of posts) {
      if (p.category) set.add(p.category)
    }
    return Array.from(set).sort()
  }, [posts])

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false
      return true
    })
  }, [posts, selectedCategory])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
      {/* Barra de cabecera de la Sección XX y enlace oficial */}
      <Card padding="0.875rem 1rem">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: FACEBOOK_PAGES.seccionxx.accentColor,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                {FACEBOOK_PAGES.seccionxx.name}
              </span>
            </div>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                background: "var(--accent)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              {filteredPosts.length} {filteredPosts.length === 1 ? "publicación" : "publicaciones"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              flexWrap: "wrap",
            }}
          >
            <a
              href={FACEBOOK_PAGES.seccionxx.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              Página oficial en Facebook
              <ArrowSquareOut size={13} weight="bold" />
            </a>
          </div>
        </div>
        {availableCategories.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              flexWrap: "wrap",
              paddingTop: "0.625rem",
              marginTop: "0.625rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginRight: "0.25rem" }}>
              Categoría:
            </span>
            <Button
              variant={selectedCategory === "all" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
            >
              Todas
            </Button>
            {availableCategories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {/* Estado de carga inicial */}
      {loading && posts.length === 0 ? (
        <Card padding="2.5rem 1.25rem">
          <LoadingSpinner text="Cargando comunicados y noticias sindicales..." />
        </Card>
      ) : filteredPosts.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "minmax(0, 1fr)"
              : "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
            gap: "1rem",
            alignItems: "stretch",
          }}
        >
          {filteredPosts.map((post) => (
            <FacebookPostCard key={post.id} post={post} compact={compact} />
          ))}
        </div>
      ) : (
        /* Fallback limpio si aún no hay publicaciones para ese filtro */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: "1rem",
          }}
        >
          {(() => {
            const cfg = FACEBOOK_PAGES.seccionxx
            return (
              <Card padding="1.25rem">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius)",
                        background: `${cfg.accentColor}16`,
                        color: cfg.accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Newspaper size={20} weight="duotone" />
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>
                        {cfg.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                        {cfg.subtitle}
                      </p>
                    </div>
                  </div>
                  <a
                    href={cfg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--primary)",
                      textDecoration: "none",
                    }}
                  >
                    Abrir página oficial en Facebook
                    <ArrowSquareOut size={15} weight="bold" />
                  </a>
                </div>
              </Card>
            )
          })()}
        </div>
      )}
    </div>
  )
}
