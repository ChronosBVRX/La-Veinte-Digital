"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Newspaper } from "@phosphor-icons/react"
import type { FacebookPost } from "../types"
import { FacebookPostCard } from "./FacebookPostCard"

interface HomeFacebookNewsPreviewProps {
  initialPosts?: FacebookPost[]
}

export function HomeFacebookNewsPreview({ initialPosts = [] }: HomeFacebookNewsPreviewProps) {
  const [posts, setPosts] = useState<FacebookPost[]>(initialPosts)

  useEffect(() => {
    let cancelled = false
    async function loadLatest() {
      try {
        const res = await fetch("/api/facebook/posts?limit=3")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setPosts(data.items.slice(0, 3))
        }
      } catch {
        // Silencioso en Inicio: si no hay red, conserva initialPosts o no renderiza
      }
    }
    loadLatest()
    return () => {
      cancelled = true
    }
  }, [])

  if (posts.length === 0) return null

  return (
    <section
      aria-label="Noticias SNTSS recientes"
      style={{
        marginTop: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Newspaper size={20} weight="duotone" color="var(--primary)" />
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-md, 1rem)",
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.01em",
            }}
          >
            Noticias SNTSS recientes
          </h2>
        </div>

        <Link
          href="/facebook"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          Ver todas las noticias
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "0.875rem",
          alignItems: "stretch",
        }}
      >
        {posts.slice(0, 3).map((post) => (
          <FacebookPostCard key={post.id} post={post} compact />
        ))}
      </div>
    </section>
  )
}
