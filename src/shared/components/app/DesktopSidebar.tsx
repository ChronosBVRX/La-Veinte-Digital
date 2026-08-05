"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, UserCircle, X } from "@phosphor-icons/react"
import { DESKTOP_NAV_GROUPS } from "./navigation"
import type { CSSProperties } from "react"

interface DesktopSidebarProps {
  open: boolean
  onClose: () => void
}

export function DesktopSidebar({ open, onClose }: DesktopSidebarProps) {
  const pathname = usePathname()
  const isHomeActive = pathname === "/"

  const sidebarContent = (
    <nav style={{ padding: "0.75rem 0.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.625rem 0.75rem",
          marginBottom: "0.25rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link
          href="/"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "var(--primary)",
            fontSize: "0.9375rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          La Veinte Digital
        </Link>
        <button
          onClick={onClose}
          className="mobile-only"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            padding: "0.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Cerrar menú"
        >
          <X size={18} weight="regular" />
        </button>
      </div>

      <NavItem
        href="/"
        label="Inicio"
        icon={House}
        isActive={isHomeActive}
        color="var(--primary)"
        onClick={onClose}
      />

      {DESKTOP_NAV_GROUPS.map((group) => (
        <div key={group.label} style={{ marginTop: "1rem" }}>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: group.color,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "0 0.625rem",
              marginBottom: "0.25rem",
              display: "block",
            }}
          >
            {group.label}
          </span>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.0625rem",
            }}
          >
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`))

              return (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive}
                    color={group.color}
                    onClick={onClose}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
        <NavItem
          href="/profile"
          label="Mi perfil"
          icon={UserCircle}
          isActive={pathname === "/profile" || pathname.startsWith("/profile/")}
          color="var(--muted)"
          onClick={onClose}
        />
      </div>
    </nav>
  )

  return (
    <>
      <div
        className="sidebar-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />

      <div
        className="desktop-only"
        style={{
          width: "var(--sidebar-width)",
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          flexShrink: 0,
          transition: "width var(--transition)",
        }}
      >
        {sidebarContent}
      </div>

      <div
        className="sidebar-drawer"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          background: "var(--card)",
          zIndex: 50,
          borderRight: "1px solid var(--border)",
          paddingTop: "var(--nav-height)",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          pointerEvents: open ? "auto" : "none",
          paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {sidebarContent}
      </div>
    </>
  )
}

function NavItem({
  href,
  label,
  icon: IconComponent,
  isActive,
  color,
  onClick,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>
  isActive: boolean
  color: string
  onClick: () => void
}) {
  const activeStyle: CSSProperties = isActive
    ? {
        background: color,
        color: "#ffffff",
      }
    : {
        background: "transparent",
        color: "var(--fg)",
      }

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.5rem 0.625rem",
        borderRadius: "var(--radius)",
        textDecoration: "none",
        fontSize: "0.8125rem",
        fontWeight: isActive ? 600 : 400,
        transition: "all var(--transition)",
        ...activeStyle,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "var(--accent)"
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent"
        }
      }}
    >
      <IconComponent size={18} weight={isActive ? "fill" : "regular"} />
      {label}
    </Link>
  )
}
