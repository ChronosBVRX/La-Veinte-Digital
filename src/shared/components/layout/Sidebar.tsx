"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageCircle, Bot, FileText, BookOpen, User, Newspaper, Target, X } from "lucide-react"
import type { CSSProperties } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/foro", label: "Foro", icon: Newspaper },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/asistente", label: "Asistente SNTSS", icon: Bot },
  { href: "/simulador", label: "Simulador", icon: Target },
  { href: "/escritos", label: "Generar Escritos", icon: FileText },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/profile", label: "Mi Perfil", icon: User },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

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

          return (
            <li key={link.href}>
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
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      {/* Desktop sidebar */}
      <div className="desktop-only" style={{
        width: "var(--sidebar-width)", background: "var(--card)",
        borderRight: "1px solid var(--border)", overflowY: "auto",
        flexShrink: 0, transition: "width var(--transition)",
      }}>
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="sidebar-drawer" style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
          background: "var(--card)", zIndex: 50,
          borderRight: "1px solid var(--border)",
          paddingTop: "var(--nav-height)", overflowY: "auto",
        }}>
          {sidebarContent}
        </div>
      )}
    </>
  )
}
