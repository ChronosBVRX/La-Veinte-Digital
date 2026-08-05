"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -1px 8px rgba(0,0,0,0.06)",
      }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const IconComponent = item.icon
        const isActive = item.href
          ? pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
          : false

        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.125rem",
                textDecoration: "none",
                color: "inherit",
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-sm)",
                transition: "all var(--transition)",
              }}
            >
              <IconComponent
                size={20}
                weight={isActive ? "fill" : "regular"}
                color={isActive ? "var(--primary)" : "var(--muted)"}
              />
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--primary)" : "var(--muted)",
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        }

        return (
          <button
            key={item.key}
            onClick={() => onSheetOpen(item.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.125rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--muted)",
              fontFamily: "inherit",
              transition: "all var(--transition)",
            }}
          >
            <IconComponent size={20} weight="regular" color="var(--muted)" />
            <span style={{ fontSize: "0.625rem", fontWeight: 400 }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
