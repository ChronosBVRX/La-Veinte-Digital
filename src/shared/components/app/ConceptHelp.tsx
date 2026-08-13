"use client"

import Link from "next/link"
import { Info } from "@phosphor-icons/react"
import { useEffect, useState } from "react"

interface ConceptHelpProps {
  conceptCode: string
  variant?: "icon" | "label"
  /** Override del nombre (si no se puede resolver del catálogo). */
  label?: string
  size?: number
}

/**
 * Componente global de ayuda de conceptos.
 *
 * <ConceptHelp conceptCode="033" />           → 033 ⓘ
 * <ConceptHelp conceptCode="033" label />     → Estímulo por puntualidad ⓘ
 *
 * Navega a la ficha educativa del concepto en la Guía de mi Tarjetón.
 * Es un vínculo, no lógica de negocio: puede usarse desde visor, histórico,
 * comparador, simuladores y resultados de cálculos.
 */
export function ConceptHelp({ conceptCode, variant = "icon", label, size = 14 }: ConceptHelpProps) {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import("@/data/guia-tarjeton/concepts").then((mod) => {
      if (cancelled) return
      const entry = (mod.guideConcepts as Array<{ code: string; name: string }>).find((c) => c.code === conceptCode)
      setName(entry ? entry.name : null)
    })
    return () => {
      cancelled = true
    }
  }, [conceptCode])

  const href = `/guia/conceptos/${conceptCode}`
  const displayName = label ?? name ?? conceptCode

  if (variant === "label") {
    return (
      <Link
        href={href}
        aria-label={`Ver explicación del concepto ${conceptCode}`}
        title={`¿Qué es ${displayName}?`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          color: "var(--primary)",
          textDecoration: "none",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {displayName}
        <Info size={14} weight="fill" aria-hidden="true" style={{ flexShrink: 0 }} />
      </Link>
    )
  }

  return (
    <Link
      href={href}
      aria-label={`Ver explicación del concepto ${conceptCode} (${displayName})`}
      title={`¿Qué es el concepto ${conceptCode}?`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        transition: "color var(--transition)",
        textDecoration: "none",
        lineHeight: 1,
      }}
    >
      <Info size={size} weight="bold" aria-hidden="true" />
    </Link>
  )
}
