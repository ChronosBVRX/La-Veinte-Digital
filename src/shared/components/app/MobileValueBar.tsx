"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { CaretRight, Compass, Lightbulb, X } from "@phosphor-icons/react"
import {
  MOBILE_VALUE_ITEMS,
  mergeMobileBarItems,
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
 * Barra informativa móvil compacta: una sola fila (icono + texto + chevron)
 * con × independiente. El cuerpo completo es el CTA cuando hay `href`
 * (sin etiquetas de texto tipo "Planear"/"Ver"); el × es hermano del enlace
 * para que cerrarlo nunca pueda navegar.
 *
 * - Solo `mobile-only` (desktop >= 769px: no visible por CSS existente).
 * - No registra capa Back (no abre modales).
 * - Los CTA usan `Link`: navegan normal y activan el feedback nativo existente.
 * - Respeta `prefers-reduced-motion` (sin rotación automática).
 * - Cierre opcional solo por sesión (`sessionStorage`).
 */
export function MobileValueBar({ items = MOBILE_VALUE_ITEMS }: MobileValueBarProps) {
  const pathname = usePathname() ?? "/"
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [rotation, setRotation] = useState(0)
  const [activeItems, setActiveItems] = useState<MobileValueItem[]>(items)

  useEffect(() => {
    if (items !== MOBILE_VALUE_ITEMS) {
      setActiveItems(items)
      return
    }

    let isMounted = true
    async function loadRemoteItems() {
      try {
        const res = await fetch("/api/announcements/bar")
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && Array.isArray(data?.items) && data.items.length > 0) {
          setActiveItems(mergeMobileBarItems(MOBILE_VALUE_ITEMS, data.items))
        }
      } catch {
        // En caso de desconexión o fallo, conserva los items locales de fallback
      }
    }

    void loadRemoteItems()

    return () => {
      isMounted = false
    }
  }, [items])

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
    () => pickMobileValueItem(pathname, { items: activeItems, seed: sessionSeed, offset: rotation }),
    [pathname, activeItems, sessionSeed, rotation],
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
  // ctaLabel vive en el modelo para accesibilidad, no se muestra en móvil.
  const linkLabel = item.ctaLabel ? `${item.ctaLabel}: ${item.text}` : item.text

  const handleDismiss = (e: React.MouseEvent) => {
    // El × es hermano del enlace, pero se detiene la propagación por seguridad.
    e.stopPropagation()
    e.preventDefault()
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // Sin sessionStorage: solo oculta en memoria esta vez.
    }
    trackMobileValueEvent("mobile_value_dismiss", item.id)
    setDismissed(true)
  }

  const body = (
    <>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
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

      <span style={{ flex: 1, minWidth: 0, display: "block" }}>
        {isSponsor ? (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "0.04em",
              color: "var(--muted)",
              textTransform: "uppercase",
              display: "block",
            }}
          >
            Patrocinado{item.sponsorName ? ` · ${item.sponsorName}` : ""}
          </span>
        ) : (
          item.eyebrow && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "0.04em",
                color: "var(--primary)",
                textTransform: "uppercase",
                display: "block",
              }}
            >
              {item.eyebrow}
            </span>
          )
        )}
        <span className="mobile-value-bar__text">{item.text}</span>
      </span>

      {item.href && (
        <CaretRight
          size={16}
          weight="bold"
          aria-hidden
          color="var(--muted)"
          style={{ flexShrink: 0 }}
        />
      )}
    </>
  )

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
        height: "calc(var(--mobile-value-bar-height) + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -1px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {item.href ? (
        <Link
          href={item.href}
          onClick={() => trackMobileValueEvent("mobile_value_click", item.id)}
          aria-label={linkLabel}
          className="pressable"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "inherit",
            padding: "0 0 0 0.625rem",
            minHeight: 44,
          }}
        >
          {body}
        </Link>
      ) : (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0 0 0 0.625rem",
          }}
        >
          {body}
        </span>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar consejo"
        className="pressable"
        style={{
          flexShrink: 0,
          alignSelf: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 40,
          minHeight: 44,
          marginRight: "0.25rem",
        }}
      >
        <X size={15} weight="bold" />
      </button>
    </aside>
  )
}
