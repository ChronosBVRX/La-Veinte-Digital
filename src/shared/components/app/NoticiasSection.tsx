"use client"

import Link from "next/link"
import { Globe, ArrowRight } from "@phosphor-icons/react"
import { FacebookFeeds } from "@/features/facebook/components/FacebookFeeds"

export function NoticiasSection() {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Globe size={16} weight="duotone" color="#1877F2" />
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Noticias de la Sección XX
          </span>
        </div>
        <Link
          href="/facebook"
          style={{
            fontSize: "0.75rem",
            color: "var(--primary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          Ver feed completo
          <ArrowRight size={12} />
        </Link>
      </div>
      <FacebookFeeds compact />
    </section>
  )
}