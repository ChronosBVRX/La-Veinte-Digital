"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, UserCircle, X, Article, ArrowsClockwise, FolderOpen } from "@phosphor-icons/react"
import { DESKTOP_NAV_GROUPS } from "./navigation"
import { useIsNativeApp, useNativePlatform } from "@/shared/hooks/useIsNativeApp"
import type { CSSProperties } from "react"

interface DesktopSidebarProps {
  open: boolean
  onClose: () => void
}

export function DesktopSidebar({ open, onClose }: DesktopSidebarProps) {
  const pathname = usePathname()
  const isNative = useIsNativeApp()
  const platform = useNativePlatform()
  const isHomeActive = pathname === "/"

  const brandingHeader = (
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
  )

  const mainNavContent = (
    <>
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

      {isNative && (
        <div style={{ marginTop: "1rem" }}>
          <span style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--brand-navy)",
            textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.625rem",
            marginBottom: "0.375rem", display: "block",
          }}>
            FUNCIONES DE LA APP
          </span>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            <li>
              <button
                onClick={() => { window.LaVeinteApp?.openOfficialPayslips() }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem", width: "100%",
                  padding: "0.625rem 0.75rem", borderRadius: "var(--radius)",
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: "var(--text-sm)", color: "var(--fg)", textDecoration: "none",
                  textAlign: "left", fontFamily: "inherit",
                }}
              >
                <Article size={20} weight="regular" style={{ color: "var(--area-work)", flexShrink: 0 }} />
                Tarjetones oficiales IMSS
              </button>
            </li>
            <li>
              <Link
                href="/documentos-personales"
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem", width: "100%",
                  padding: "0.625rem 0.75rem", borderRadius: "var(--radius)",
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: "var(--text-sm)", color: "var(--fg)", textDecoration: "none",
                  textAlign: "left", fontFamily: "inherit",
                }}
              >
                <FolderOpen size={20} weight="regular" style={{ color: "var(--primary)", flexShrink: 0 }} />
                Documentos personales
              </Link>
            </li>
            {platform === "android" && (
              <li>
                <button
                  onClick={() => { window.LaVeinteApp?.checkForUpdate?.() }}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.625rem", width: "100%",
                    padding: "0.625rem 0.75rem", borderRadius: "var(--radius)",
                    background: "transparent", border: "none", cursor: "pointer",
                    fontSize: "var(--text-sm)", color: "var(--fg)", textDecoration: "none",
                    textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <ArrowsClockwise size={20} weight="regular" style={{ color: "var(--brand-cyan)", flexShrink: 0 }} />
                  Buscar actualización
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

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
    </>
  )

  const mobileDrawerContent = (
    <nav style={{ padding: "0.75rem 0.5rem" }}>
      {brandingHeader}
      {mainNavContent}
    </nav>
  )

  const desktopSidebarContent = (
    <nav style={{ padding: "0.75rem 0.5rem" }}>
      {mainNavContent}
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
        {desktopSidebarContent}
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
        {mobileDrawerContent}
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
        padding: "0.625rem 0.75rem",
        borderRadius: "var(--radius)",
        textDecoration: "none",
        fontSize: "var(--text-sm)",
        fontWeight: isActive ? 600 : 500,
        minHeight: 40,
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
