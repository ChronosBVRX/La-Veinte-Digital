"use client"

import Link from "next/link"
import { getSourceById } from "@/shared/lib/government-sources"

interface SourceAttributionProps {
  sourceId: string
  detalle?: string
  compact?: boolean
}

/**
 * Atribución contextual compacta. Usa el registro canónico; nunca fabrica citas.
 * Si el sourceId no existe, no renderiza nada (prohibido inventar fuentes).
 */
export function SourceAttribution({ sourceId, detalle, compact }: SourceAttributionProps) {
  const source = getSourceById(sourceId)
  if (!source) return null
  return (
    <p
      style={{
        fontSize: compact ? "0.72rem" : "0.78rem",
        color: "var(--muted)",
        lineHeight: 1.5,
        margin: "0.5rem 0 0",
      }}
    >
      <strong style={{ color: "var(--fg)" }}>Fuente:</strong> {source.titulo}
      {detalle ? `, ${detalle}` : ""} ·{" "}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${source.titulo} — Abre un sitio externo`}
        style={{ color: "var(--primary)", textDecoration: "underline" }}
      >
        Consultar fuente original (sitio externo)
      </a>
    </p>
  )
}

export function SourcesPageLink({ label = "Información y fuentes" }: { label?: string }) {
  return (
    <Link
      href="/informacion-y-fuentes"
      style={{ color: "var(--primary)", textDecoration: "underline", fontSize: "0.8125rem" }}
    >
      {label}
    </Link>
  )
}
