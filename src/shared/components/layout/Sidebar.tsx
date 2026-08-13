"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Bot, FileText, BookOpen, User, Target, Calculator, DollarSign, X, Calendar, CalendarCheck, Globe, ClipboardList, FileBadge, RefreshCw, type LucideIcon } from "lucide-react"
import { useIsNativeApp, useNativePlatform } from "@/shared/hooks/useIsNativeApp"
import type { CSSProperties } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

interface SidebarLink {
  href: string
  label: string
  icon: LucideIcon
  onClick?: boolean
  action?: "checkUpdate" | "openPayslips"
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const isNative = useIsNativeApp()
  const platform = useNativePlatform()

  const links: SidebarLink[] = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/asistente", label: "Asistente SNTSS", icon: Bot },
    { href: "/simulador", label: "Simulador", icon: Target },
    { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
    { href: "/nomina", label: "Nómina", icon: DollarSign },
    { href: "/escritos", label: "Generar Escritos", icon: FileText },
    { href: "/catalogo", label: "Catálogo", icon: BookOpen },
    { href: "/calendario", label: "Calendario", icon: Calendar },
    { href: "/facebook", label: "Noticias SNTSS", icon: Globe },
    { href: "/bitacora", label: "Bitácora", icon: ClipboardList },
    { href: "/vacaciones", label: "Vacaciones", icon: CalendarCheck },
  { href: "/profile", label: "Mi Perfil", icon: User },
  ...(isNative ? [
    { href: "#", label: "Tarjetones IMSS", icon: FileBadge, onClick: true },
    ...(platform === "android" ? [
      { href: "#", label: "Actualizar app", icon: RefreshCw, onClick: true, action: "checkUpdate" as const },
    ] : []),
  ] : []),
]

  const sidebarContent = (
    <nav style={{ padding: "0.75rem" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 0.5rem 0.75rem", marginBottom: "0.25rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Navegación
        </span>
        <button
          onClick={onClose}
          className="mobile-only"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", padding: "0.25rem",
          }}
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
          const activeStyle: CSSProperties = isActive
            ? { background: "var(--primary)", color: "var(--primary-fg)" }
            : { background: "transparent", color: "var(--fg)" }

          const isBridgeItem = link.onClick

          return (
            <li key={link.href}>
              {isBridgeItem ? (
                <button
                  onClick={() => {
                    const act = link.action
                    if (act === "checkUpdate") window.LaVeinteApp?.checkForUpdate?.()
                    else window.LaVeinteApp?.openOfficialPayslips?.()
                    onClose()
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.625rem", width: "100%",
                    padding: "0.625rem 0.75rem", borderRadius: "var(--radius)",
                    textDecoration: "none", fontSize: "0.875rem", fontWeight: 400, cursor: "pointer",
                    border: "none",
                    ...activeStyle,
                  }}
                >
                  <Icon size={18} />
                  {link.label}
                </button>
              ) : (
              <Link
                href={link.href}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem",
                  padding: "0.625rem 0.75rem", borderRadius: "var(--radius)",
                  textDecoration: "none", fontSize: "0.875rem", fontWeight: isActive ? 600 : 400,
                  transition: "all var(--transition)",
                  ...activeStyle,
                }}
              >
                <Icon size={18} />
                {link.label}
              </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="sidebar-overlay"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Desktop sidebar */}
      <div className="desktop-only" style={{
        width: "var(--sidebar-width)", background: "var(--card)",
        borderRight: "1px solid var(--border)", overflowY: "auto",
        flexShrink: 0, transition: "width var(--transition)",
      }}>
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      <div
        className="sidebar-drawer"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
          background: "var(--card)", zIndex: 50,
          borderRight: "1px solid var(--border)",
          paddingTop: "var(--nav-height)", overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {sidebarContent}
      </div>
    </>
  )
}
