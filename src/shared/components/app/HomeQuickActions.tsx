"use client"

import Link from "next/link"
import type { IconProps } from "@phosphor-icons/react"
import { Calculator, Sparkle, Notebook, Article, ArrowsClockwise, ArrowsLeftRight } from "@phosphor-icons/react"
import { useIsNativeApp } from "@/shared/hooks/useIsNativeApp"
import { TransferDocumentsButton } from "@/features/transferir/components/TransferDocumentsButton"

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
  { icon: Calculator, label: "Calculadoras", href: "/calculadoras", color: "var(--area-tools)" },
  { icon: Sparkle, label: "Preguntas del CCT IA-Assistant", href: "/asistente", color: "var(--area-assistance)" },
  { icon: Notebook, label: "Registrar eventos en mi agenda", href: "/bitacora", color: "var(--brand-cyan)" },
]

export function HomeQuickActions({ heading = "¿Qué necesitas hoy?" }: HomeQuickActionsProps) {
  const isNative = useIsNativeApp()
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
        <TransferDocumentsButton
          renderTrigger={(open) => (
            <button
              onClick={open}
              className="hover-lift pressable"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "0.5rem", minHeight: 92,
                padding: "0.875rem 0.5rem", background: "var(--card)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                cursor: "pointer", color: "var(--fg)", fontFamily: "inherit",
                transition: "transform var(--transition), box-shadow var(--transition)",
              }}
            >
              <span style={{
                width: 44, height: 44, borderRadius: "var(--radius)",
                background: "linear-gradient(135deg, var(--primary)1f, var(--primary)14)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ArrowsLeftRight size={24} weight="duotone" color="var(--primary)" />
              </span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, textAlign: "center", lineHeight: 1.25 }}>
                Transferir documentos
              </span>
            </button>
          )}
        />
        {isNative && (
          <button
            onClick={() => { window.LaVeinteApp?.openOfficialPayslips() }}
            className="hover-lift pressable"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "0.5rem", minHeight: 92,
              padding: "0.875rem 0.5rem", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              cursor: "pointer", color: "var(--fg)", fontFamily: "inherit",
              transition: "transform var(--transition), box-shadow var(--transition)",
            }}
          >
            <span style={{
              width: 44, height: 44, borderRadius: "var(--radius)",
              background: "linear-gradient(135deg, var(--area-work)1f, var(--area-work)14)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Article size={24} weight="duotone" color="var(--area-work)" />
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, textAlign: "center", lineHeight: 1.25 }}>
              Consulta tu tarjetón
            </span>
          </button>
        )}
        {isNative && (
          <button
            onClick={() => { window.LaVeinteApp?.checkForUpdate?.() }}
            className="hover-lift pressable"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "0.5rem", minHeight: 92,
              padding: "0.875rem 0.5rem", background: "var(--card)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              cursor: "pointer", color: "var(--fg)", fontFamily: "inherit",
              transition: "transform var(--transition), box-shadow var(--transition)",
            }}
          >
            <span style={{
              width: 44, height: 44, borderRadius: "var(--radius)",
              background: "linear-gradient(135deg, var(--brand-cyan)1f, var(--brand-cyan)14)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ArrowsClockwise size={24} weight="duotone" color="var(--brand-cyan)" />
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, textAlign: "center", lineHeight: 1.25 }}>
              Actualizar APP
            </span>
          </button>
        )}
      </div>
    </section>
  )
}