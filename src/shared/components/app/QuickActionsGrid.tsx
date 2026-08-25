"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import type { IconProps } from "@phosphor-icons/react"
import {
  IdentificationCard,
  Sparkle,
  Calculator,
  FileText,
  Notebook,
  ArrowsLeftRight,
} from "@phosphor-icons/react"

interface QuickActionProps {
  icon: React.ComponentType<IconProps & { size?: number; weight?: string }>
  label: string
  href: string
  color: string
}

export function QuickAction({ icon: IconComponent, label, href, color }: QuickActionProps) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.875rem 0.75rem",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        textDecoration: "none",
        color: "var(--fg)",
        transition: "all var(--transition)",
      }}
      className="hover-lift"
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius)",
          background: `${color}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconComponent size={22} weight="duotone" color={color} />
      </div>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          textAlign: "center",
          color: "var(--fg)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </Link>
  )
}

export function QuickActionsGrid() {
  const actions = [
    {
      icon: IdentificationCard,
      label: "Importar\ntarjetón",
      href: "/profile/mi-informacion-laboral",
      color: "var(--area-tools)",
    },
    {
      icon: Sparkle,
      label: "Consultar al\nasistente",
      href: "/asistente",
      color: "var(--area-assistance)",
    },
    {
      icon: Calculator,
      label: "Calcular\nprestación",
      href: "/calculadoras",
      color: "var(--brand-blue)",
    },
    {
      icon: FileText,
      label: "Generar\nescrito",
      href: "/escritos",
      color: "var(--area-work)",
    },
    {
      icon: Notebook,
      label: "Registrar en\nmi agenda",
      href: "/bitacora",
      color: "var(--area-community)",
    },
    {
      icon: ArrowsLeftRight,
      label: "Simulador\nde nómina",
      href: "/simulador-nomina",
      color: "var(--area-tools)",
    },
  ]

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "0.75rem",
    marginBottom: "1.5rem",
  }

  return (
    <>
      <div className="quick-actions-desktop" style={gridStyle}>
        {actions.map((action) => (
          <QuickAction key={action.href} {...action} />
        ))}
      </div>
      <div
        className="quick-actions-mobile"
        style={{
          display: "none",
          marginBottom: "1.5rem",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: "0.5rem",
        }}
      >
        {actions.map((action) => (
          <div
            key={action.href}
            style={{ minWidth: 140, scrollSnapAlign: "start", flexShrink: 0 }}
          >
            <QuickAction {...action} />
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 768px) {
          .quick-actions-desktop { display: none !important; }
          .quick-actions-mobile {
            display: flex !important;
            gap: 0.5rem;
          }
        }
      `}</style>
    </>
  )
}
