"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { X } from "@phosphor-icons/react"
import { MOBILE_SHEET_GROUPS } from "./navigation"

interface MobileNavigationSheetProps {
  openKey: string | null
  onClose: () => void
  onNavigate: () => void
}

export function MobileNavigationSheet({ openKey, onClose, onNavigate }: MobileNavigationSheetProps) {
  const pathname = usePathname()
  const sheetRef = useRef<HTMLDivElement>(null)
  const isOpen = openKey !== null
  const group = openKey ? MOBILE_SHEET_GROUPS[openKey] : null

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !group) return null

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 60,
          opacity: 1,
          transition: "opacity 0.2s ease",
        }}
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 1rem)",
          animation: "slideUp 0.25s ease forwards",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem 0.75rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: group.color,
            }}
          >
            {group.label}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Cerrar"
          >
            <X size={20} weight="regular" />
          </button>
        </div>

        <div style={{ padding: "0.5rem 0.75rem" }}>
          {group.items.map((item) => {
            const IconComponent = item.icon
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  onClose()
                  onNavigate()
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 0.75rem",
                  borderRadius: "var(--radius)",
                  textDecoration: "none",
                  color: isActive ? group.color : "var(--fg)",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "0.875rem",
                  background: isActive ? "var(--accent)" : "transparent",
                  transition: "all var(--transition)",
                }}
              >
                <IconComponent
                  size={20}
                  weight={isActive ? "fill" : "regular"}
                  color={isActive ? group.color : "var(--muted)"}
                />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
