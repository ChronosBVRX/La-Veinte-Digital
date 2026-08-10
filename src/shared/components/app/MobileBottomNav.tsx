"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"
import { BOTTOM_NAV_ITEMS } from "./navigation"

interface MobileBottomNavProps {
  onSheetOpen: (key: string) => void
}

export function MobileBottomNav({ onSheetOpen }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="mobile-only"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        height: "var(--bottom-nav-height)",
        display: "flex",
        alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -1px 8px rgba(0,0,0,0.06)",
      }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const IconComponent = item.icon
        const isActive = item.href
          ? pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
          : false
        const isAssistant = item.key === "asistente"

        const tabStyle: CSSProperties = {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.125rem",
          textDecoration: "none",
          color: "inherit",
          background: isActive && !isAssistant ? "var(--accent)" : "transparent",
          boxShadow: isActive && !isAssistant ? "inset 0 2px 0 0 var(--primary)" : "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: "0.25rem 0.125rem",
          position: "relative",
          transition: "background var(--transition), box-shadow var(--transition)",
        }

        const sharedAttrs = {
          className: "pressable",
          style: tabStyle,
          "aria-current": (isActive ? "page" : undefined) as "page" | undefined,
          "aria-label": item.label,
        }

        const content = isAssistant ? (
          <>
            <span
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue), var(--brand-cyan))",
                border: "2px solid var(--card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive
                  ? "0 4px 14px rgba(117,87,200,0.45)"
                  : "0 3px 10px rgba(46,79,119,0.30)",
                transform: "translateY(-2px)",
                transition: "box-shadow var(--transition), transform var(--transition)",
              }}
            >
              <IconComponent size={24} weight="fill" color="#ffffff" />
            </span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "var(--area-assistance)" : "var(--muted)",
                marginTop: "-2px",
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </>
        ) : (
          <>
            <IconComponent
              size={22}
              weight={isActive ? "fill" : "regular"}
              color={isActive ? "var(--primary)" : "var(--muted)"}
            />
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--primary)" : "var(--muted)",
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </>
        )

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} {...sharedAttrs}>
              {content}
            </Link>
          )
        }

        return (
          <button
            key={item.key}
            {...sharedAttrs}
            onClick={() => onSheetOpen(item.key)}
            aria-haspopup="dialog"
          >
            {content}
          </button>
        )
      })}
    </nav>
  )
}