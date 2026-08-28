"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { List, UserCircle, CaretDown, DeviceMobile } from "@phosphor-icons/react"
import { useAppEnvironment } from "@/shared/hooks/useAppEnvironment"

interface AppHeaderProps {
  fullName: string | null
  onMenuToggle: () => void
}

export function AppHeader({ fullName, onMenuToggle }: AppHeaderProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const [profileOpen, setProfileOpen] = useState(false)
  const { environment, platform, resolved } = useAppEnvironment()
  const shouldShowAndroidDownload = resolved && environment === "web" && platform === "android"
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen) return
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [profileOpen])

  return (
    <header className="app-header" style={{
      background: "rgba(255,255,255,0.88)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      padding: "0 clamp(1rem, 2vw, 1.5rem)",
      height: "var(--nav-height)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 60,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          onClick={onMenuToggle}
          className="mobile-only"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            borderRadius: "var(--radius-sm)",
            color: "var(--fg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
          }}
          aria-label="Abrir menú"
        >
          <List size={24} weight="bold" />
        </button>

        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ height: "30px", display: "flex", alignItems: "center" }}>
            <Image
              src="/logo-horizontal.png"
              alt="La Veinte Digital"
              width={120}
              height={30}
              priority
              style={{
                maxHeight: "100%",
                width: "auto",
                height: "30px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          <span
            className="desktop-only"
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--primary)",
              letterSpacing: "-0.02em",
            }}
          >
            La Veinte Digital
          </span>
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {shouldShowAndroidDownload && (
        <a
          href="/LaVeinteDigital.apk"
          title="Descargar app Android"
          aria-label="Descargar app Android"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "var(--brand-navy)",
            transition: "color var(--transition), background var(--transition)",
          }}
        >
          <DeviceMobile size={22} weight="fill" />
        </a>
        )}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Menú de perfil"
            className="profile-trigger"            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0.5rem 0.25rem 0.75rem",
              borderRadius: "var(--radius-pill)",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "inherit",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              minHeight: 44,
              transition: "all var(--transition)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)"
              e.currentTarget.style.borderColor = "var(--border)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.borderColor = "transparent"
            }}
          >
            <span className="desktop-only" style={{ whiteSpace: "nowrap" }}>
              {firstName}
            </span>
            <span style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-fg)",
              boxShadow: "0 2px 6px rgba(23,50,77,0.2)",
            }}>
              <UserCircle size={18} weight="fill" />
            </span>
            <CaretDown size={12} weight="bold" style={{ color: "var(--muted)", marginLeft: "-0.125rem" }} />
          </button>
          {profileOpen && (
            <div
              aria-label="Opciones de cuenta"
              style={{
                position: "absolute",
                top: "calc(100% + 0.5rem)",
                right: 0,
                minWidth: 200,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                padding: "0.375rem",
                zIndex: 70,
                animation: "scaleIn 0.18s ease forwards",
                transformOrigin: "top right",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--muted)",
                  padding: "0.5rem 0.625rem",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "0.25rem",
                  fontWeight: 600,
                }}
              >
                {fullName || "Tu cuenta"}
              </div>
              <ProfileItem label="Mi perfil" href="/profile" onClick={() => setProfileOpen(false)} />
              <ProfileItem
                label="Mi información laboral"
                href="/profile/mi-informacion-laboral"
                onClick={() => setProfileOpen(false)}
              />
              <ProfileItem label="Mi Agenda" href="/bitacora" onClick={() => setProfileOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ProfileItem({ label, href, onClick }: { label: string; href: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "block",
        padding: "0.5rem 0.625rem",
        fontSize: "var(--text-sm)",
        color: "var(--fg)",
        textDecoration: "none",
        borderRadius: "var(--radius-sm)",
        fontWeight: 500,
      }}
    >
      {label}
    </Link>
  )
}
