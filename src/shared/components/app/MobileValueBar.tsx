"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { CaretRight, Compass, Lightbulb, X } from "@phosphor-icons/react"
import {
  MOBILE_VALUE_ITEMS,
  pickMobileValueItem,
  trackMobileValueEvent,
  type MobileValueItem,
} from "./mobileValueItems"

const DISMISS_KEY = "mobile_value_bar_dismissed"
const ROTATE_MS = 25_000

interface MobileValueBarProps {
  items?: MobileValueItem[]
}

/**
 * Barra informativa móvil: ocupa la superficie inferior (antes navegación
 * redundante) con UN consejo/herramienta a la vez. Presentación + selección
 * sencilla: sin Supabase, auth, bridges ni lógica laboral.
 *
 * - Solo `mobile-only` (desktop >= 769px: no visible por CSS existente).
 * - No registra capa Back (no abre modales).
 * - Los CTA usan `Link`: navegan normal y activan el feedback nativo existente.
 * - Respeta `prefers-reduced-motion` (sin rotación automática).
 * - Cierre opcional solo por sesión (`sessionStorage`).
 */
export function MobileValueBar({ items = MOBILE_VALUE_ITEMS }: MobileValueBarProps) {
  // DashboardShell lo monta con ssr:false: este código solo corre en cliente.
  const pathname = usePathname() ?? "/"
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [rotation, setRotation] = useState(0)
  // Dismiss solo por sesión; inicialización perezosa (sin setState en efecto).
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      // sessionStorage no disponible: la barra sigue visible.
      return false
    }
  })

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  const item = useMemo(
    () => pickMobileValueItem(pathname, { items, seed: sessionSeed, offset: rotation }),
    [pathname, items, sessionSeed, rotation],
  )

  useEffect(() => {
    if (dismissed || !item || reduceMotion) return
    const timer = window.setTimeout(() => {
      setRotation((prev) => prev + 1)
    }, ROTATE_MS)
    return () => window.clearTimeout(timer)
  }, [dismissed, item, reduceMotion, rotation, pathname])

  useEffect(() => {
    if (item && !dismissed) trackMobileValueEvent("mobile_value_impression", item.id)
  }, [item, dismissed])

  if (dismissed || !item) return null

  const isSponsor = item.type === "sponsor"
  const Icon = item.type === "tool" ? Compass : Lightbulb

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // Sin sessionStorage: solo oculta en memoria esta vez.
    }
    trackMobileValueEvent("mobile_value_dismiss", item.id)
    setDismissed(true)
  }

  return (
    <aside
      aria-label={isSponsor ? "Contenido patrocinado" : "Consejo de La Veinte Digital"}
      className="mobile-only mobile-value-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        zIndex: 30,
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        height: "var(--mobile-value-bar-height)",
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.375rem 0.625rem",
        paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -1px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} weight="duotone" />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isSponsor ? (
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Patrocinado{item.sponsorName ? ` · ${item.sponsorName}` : ""}
          </span>
        ) : (
          item.eyebrow && (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                lineHeight: 1.2,
              }}
            >
              {item.eyebrow}
            </span>
          )
        )}
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--fg)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {item.text}
        </p>
      </div>

      {item.href && item.ctaLabel && (
        <Link
          href={item.href}
          onClick={() => trackMobileValueEvent("mobile_value_click", item.id)}
          aria-label={`${item.ctaLabel}: ${item.text}`}
          className="pressable"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.125rem",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            padding: "0.5rem 0.25rem 0.5rem 0.5rem",
            minHeight: 44,
          }}
        >
          {item.ctaLabel}
          <CaretRight size={14} weight="bold" />
        </Link>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar consejo"
        className="pressable"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 40,
          minHeight: 44,
          padding: "0.25rem",
        }}
      >
        <X size={16} weight="bold" />
      </button>
    </aside>
  )
}
