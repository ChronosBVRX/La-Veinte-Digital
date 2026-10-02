"use client"

import Link from "next/link"
import { useCallback, type CSSProperties } from "react"
import { User, Handshake } from "@phosphor-icons/react"

export interface RoleModeSwitchProps {
  currentMode: "worker" | "union"
  variant?: "light" | "dark"
  className?: string
  style?: CSSProperties
}

const STORAGE_KEY = "lvd_preferred_mode"

export function RoleModeSwitch({
  currentMode,
  variant = "light",
  className,
  style,
}: RoleModeSwitchProps) {
  const isWorker = currentMode === "worker"
  const isDark = variant === "dark"

  const handleModeClick = useCallback((targetMode: "worker" | "union") => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, targetMode)
      }
    } catch {
      // Ignora errores si el almacenamiento está restringido
    }
  }, [])

  const trackBg = isDark ? "rgba(255, 255, 255, 0.12)" : "var(--accent, #f1f5f9)"
  const trackBorder = isDark ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--border, #e2e8f0)"

  const activeWorkerBg = isDark ? "#ffffff" : "var(--card, #ffffff)"
  const activeWorkerFg = isDark ? "#1e3a8a" : "var(--primary, #2563eb)"
  const inactiveWorkerFg = isDark ? "rgba(255, 255, 255, 0.82)" : "var(--muted, #64748b)"

  const activeUnionBg = isDark ? "#ffffff" : "var(--card, #ffffff)"
  const activeUnionFg = isDark ? "#1e3a8a" : "#1e3a8a"
  const inactiveUnionFg = isDark ? "rgba(255, 255, 255, 0.82)" : "var(--muted, #64748b)"

  const shadow = isDark
    ? "0 2px 4px rgba(0, 0, 0, 0.2)"
    : "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)"

  return (
    <>
      <style>{`
        .role-mode-switch-long { display: inline; }
        .role-mode-switch-short { display: none; }
        @media (max-width: 480px) {
          .role-mode-switch-long { display: none; }
          .role-mode-switch-short { display: inline; }
        }
      `}</style>

      <nav
        role="group"
        aria-label="Conmutador de modo de cuenta"
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: trackBg,
          border: trackBorder,
          borderRadius: "var(--radius-pill, 9999px)",
          padding: 3,
          boxSizing: "border-box",
          height: 34,
          maxWidth: "100%",
          flexShrink: 0,
          ...style,
        }}
      >
        <Link
          href="/"
          onClick={() => handleModeClick("worker")}
          aria-current={isWorker ? "page" : undefined}
          aria-label="Cambiar a Modo Usuario"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0 0.625rem",
            height: 28,
            borderRadius: "var(--radius-pill, 9999px)",
            fontSize: "var(--text-xs, 0.75rem)",
            fontWeight: isWorker ? 700 : 500,
            textDecoration: "none",
            color: isWorker ? activeWorkerFg : inactiveWorkerFg,
            background: isWorker ? activeWorkerBg : "transparent",
            boxShadow: isWorker ? shadow : "none",
            transition: "all 0.18s ease",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
          }}
        >
          <User size={15} weight={isWorker ? "bold" : "regular"} style={{ flexShrink: 0 }} />
          <span>
            <span className="role-mode-switch-long">Modo Usuario</span>
            <span className="role-mode-switch-short">Usuario</span>
          </span>
        </Link>

        <Link
          href="/representacion"
          onClick={() => handleModeClick("union")}
          aria-current={!isWorker ? "page" : undefined}
          aria-label="Cambiar a Modo Representante"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0 0.625rem",
            height: 28,
            borderRadius: "var(--radius-pill, 9999px)",
            fontSize: "var(--text-xs, 0.75rem)",
            fontWeight: !isWorker ? 700 : 500,
            textDecoration: "none",
            color: !isWorker ? activeUnionFg : inactiveUnionFg,
            background: !isWorker ? activeUnionBg : "transparent",
            boxShadow: !isWorker ? shadow : "none",
            transition: "all 0.18s ease",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
          }}
        >
          <Handshake size={15} weight={!isWorker ? "fill" : "regular"} style={{ flexShrink: 0 }} />
          <span>
            <span className="role-mode-switch-long">Modo Representante</span>
            <span className="role-mode-switch-short">Representante</span>
          </span>
        </Link>
      </nav>
    </>
  )
}
