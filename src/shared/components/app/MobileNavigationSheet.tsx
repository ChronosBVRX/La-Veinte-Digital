"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { X, Article, ArrowsClockwise, ShieldCheck, UserCircle, Briefcase, Newspaper } from "@phosphor-icons/react"
import { MOBILE_SHEET_GROUPS } from "./navigation"
import { useIsNativeApp, useNativePlatform } from "@/shared/hooks/useIsNativeApp"

interface MobileNavigationSheetProps {
  openKey: string | null
  onClose: () => void
  onNavigate: () => void
}

export function MobileNavigationSheet({ openKey, onClose, onNavigate }: MobileNavigationSheetProps) {
  const pathname = usePathname()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const isNative = useIsNativeApp()
  const platform = useNativePlatform()
  const isOpen = openKey !== null
  const group = openKey ? MOBILE_SHEET_GROUPS[openKey] : null
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement as HTMLElement | null
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 50)

    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
        return
      }

      if (e.key === "Tab" && sheetRef.current) {
        const focusableElements = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen || !group) return null

  const sheetTransition = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.8 }

  const appVersion = isNative && typeof window !== "undefined" && window.LaVeinteApp?.appVersion
    ? window.LaVeinteApp.appVersion()
    : null

  const isMasSheet = openKey === "mas"

  return (
    <>
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          zIndex: 60,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-sheet-title"
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
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={sheetTransition}
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
            id="mobile-sheet-title"
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: group.color,
            }}
          >
            {group.label}
          </span>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 44,
              minHeight: 44,
            }}
            aria-label="Cerrar menú"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <div style={{ padding: "0.75rem" }}>
          {!isMasSheet ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
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
                    aria-current={isActive ? "page" : undefined}
                    className="pressable"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.875rem 0.75rem",
                      borderRadius: "var(--radius)",
                      textDecoration: "none",
                      color: isActive ? group.color : "var(--fg)",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: "var(--text-sm)",
                      background: isActive ? "var(--accent)" : "transparent",
                      transition: "background var(--transition)",
                      minHeight: 48,
                    }}
                  >
                    <IconComponent
                      size={22}
                      weight={isActive ? "fill" : "regular"}
                      color={isActive ? group.color : "var(--muted)"}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Sección Comunidad */}
              <div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--area-community)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0 0.5rem",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Comunidad
                </span>
                <Link
                  href="/facebook"
                  onClick={() => {
                    onClose()
                    onNavigate()
                  }}
                  className="pressable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    color: "var(--fg)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    minHeight: 48,
                  }}
                >
                  <Newspaper size={22} weight="duotone" color="var(--area-community)" />
                  Noticias SNTSS
                </Link>
              </div>

              {/* Sección Cuenta */}
              <div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0 0.5rem",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Cuenta
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  <Link
                    href="/profile"
                    onClick={() => {
                      onClose()
                      onNavigate()
                    }}
                    className="pressable"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius)",
                      textDecoration: "none",
                      color: "var(--fg)",
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                      minHeight: 48,
                    }}
                  >
                    <UserCircle size={22} weight="duotone" color="var(--primary)" />
                    Mi perfil
                  </Link>
                  <Link
                    href="/profile/mi-informacion-laboral"
                    onClick={() => {
                      onClose()
                      onNavigate()
                    }}
                    className="pressable"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius)",
                      textDecoration: "none",
                      color: "var(--fg)",
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                      minHeight: 48,
                    }}
                  >
                    <Briefcase size={22} weight="duotone" color="var(--area-work)" />
                    Mi información laboral
                  </Link>
                </div>
              </div>

              {/* Sección Funciones de la App (Solo Nativo) */}
              {isNative && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--brand-navy)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "0 0.5rem",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Funciones de la app
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        window.LaVeinteApp?.openOfficialPayslips()
                        onClose()
                      }}
                      className="pressable"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        borderRadius: "var(--radius)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--fg)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        textAlign: "left",
                        width: "100%",
                        fontFamily: "inherit",
                        minHeight: 48,
                      }}
                    >
                      <Article size={22} weight="duotone" color="var(--area-work)" />
                      <div>
                        <div style={{ fontWeight: 600 }}>Tarjetones oficiales IMSS</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                          Consultar y descargar desde portal oficial
                        </div>
                      </div>
                    </button>

                    {platform === "android" && (
                      <button
                        type="button"
                        onClick={() => {
                          window.LaVeinteApp?.checkForUpdate?.()
                          onClose()
                        }}
                        className="pressable"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          borderRadius: "var(--radius)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--fg)",
                          fontSize: "var(--text-sm)",
                          fontWeight: 500,
                          textAlign: "left",
                          width: "100%",
                          fontFamily: "inherit",
                          minHeight: 48,
                        }}
                      >
                        <ArrowsClockwise size={22} weight="duotone" color="var(--brand-cyan)" />
                        <div>
                          <div style={{ fontWeight: 600 }}>Buscar actualización</div>
                          {appVersion && (
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                              Versión {appVersion}
                            </div>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}