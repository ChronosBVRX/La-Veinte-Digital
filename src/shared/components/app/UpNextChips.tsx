"use client"

import Link from "next/link"
import { AirplaneTilt, CalendarDots, CalendarCheck } from "@phosphor-icons/react"
import type { IconProps } from "@phosphor-icons/react"

type IconType = React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>

const CHIPS: { href: string; label: string; icon: IconType; color: string }[] = [
  { href: "/vacaciones", label: "Vacaciones", icon: AirplaneTilt, color: "#22c55e" },
  { href: "/calendario", label: "Interactivo", icon: CalendarDots, color: "#eab308" },
  { href: "#agenda", label: "Agenda", icon: CalendarCheck, color: "var(--brand-cyan)" },
]

export function UpNextChips() {
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
        Próximamente
      </h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {CHIPS.map((chip) => {
          const Icon = chip.icon
          return (
            <Link
              key={chip.label}
              href={chip.href}
              className="hover-lift pressable"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 0.875rem",
                background: "var(--card)",
                border: `1px solid ${chip.color}33`,
                borderRadius: "var(--radius-pill)",
                color: "var(--fg)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                textDecoration: "none",
                transition: "transform var(--transition), box-shadow var(--transition)",
              }}
            >
              <Icon size={16} weight="duotone" color={chip.color} />
              {chip.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}