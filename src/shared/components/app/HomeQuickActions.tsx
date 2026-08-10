"use client"

import Link from "next/link"
import type { IconProps } from "@phosphor-icons/react"
import { IdentificationCard, Calculator, Sparkle, Notebook } from "@phosphor-icons/react"

type IconType = React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>

interface HomeQuickActionsProps {
  heading?: string
}

interface QuickTile {
  icon: IconType
  label: string
  href: string
  color: string
}

const TILES: QuickTile[] = [
  { icon: IdentificationCard, label: "Mi tarjetón", href: "/tarjeton", color: "var(--area-work)" },
  { icon: Calculator, label: "Calcular un pago", href: "/calculadoras", color: "var(--area-tools)" },
  { icon: Sparkle, label: "Asistente IA", href: "/asistente", color: "var(--area-assistance)" },
  { icon: Notebook, label: "Registrar incidencia", href: "/bitacora", color: "var(--brand-cyan)" },
]

export function HomeQuickActions({ heading = "¿Qué necesitas hoy?" }: HomeQuickActionsProps) {
  return (
    <section style={{ marginBottom: "var(--space-6)" }}>
      <h2
        style={{
          margin: "0 0 0.625rem",
          fontSize: "var(--text-md)",
          fontWeight: 600,
          color: "var(--fg)",
          letterSpacing: "-0.01em",
        }}
      >
        {heading}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
      >
        {TILES.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="hover-lift pressable"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                minHeight: 92,
                padding: "0.875rem 0.5rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                textDecoration: "none",
                color: "var(--fg)",
                transition: "transform var(--transition), box-shadow var(--transition)",
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius)",
                  background: `linear-gradient(135deg, ${tile.color}1f, ${tile.color}14)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={24} weight="duotone" color={tile.color} />
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.25,
                }}
              >
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}