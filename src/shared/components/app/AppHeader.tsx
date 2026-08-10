"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { List, UserCircle, MagnifyingGlass, CaretDown } from "@phosphor-icons/react"

interface AppHeaderProps {
  fullName: string | null
  onMenuToggle: () => void
}

export function AppHeader({ fullName, onMenuToggle }: AppHeaderProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const [profileOpen, setProfileOpen] = useState(false)
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
    <header
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1rem",
        height: "var(--nav-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 60,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          onClick={onMenuToggle}
          className="mobile-only"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.375rem",
            borderRadius: "var(--radius-sm)",
            color: "var(--fg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Abrir menú"
        >
          <List size={22} weight="regular" />
        </button>

        <Link
          href="/"
          className="mobile-only"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ height: "28px", display: "flex", alignItems: "center" }}>
            <Image
              src="/Logo SXX_recortado.png"
              alt="SXX"
              width={28}
              height={28}
              priority
              style={{
                maxHeight: "100%",
                width: "auto",
                height: "28px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--primary)",
              letterSpacing: "-0.02em",
            }}
          >
            La Veinte Digital
          </span>
        </Link>

        <SearchBar />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        {firstName && (
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
            }}
          >
            {firstName}
          </span>
        )}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="pressable"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 2px 6px rgba(23,50,77,0.25)",
            }}
            aria-label="Abrir menú de perfil"
          >
            <UserCircle size={18} weight="fill" />
          </button>
          {profileOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 0.5rem)",
                right: 0,
                minWidth: 180,
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
                  padding: "0.25rem 0.625rem 0.5rem",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "0.25rem",
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
              <ProfileItem label="Mis incidencias" href="/bitacora" onClick={() => setProfileOpen(false)} />
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
      role="menuitem"
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

function SearchBar() {
  return (
    <form
      className="desktop-only"
      role="search"
      style={{ display: "flex", alignItems: "center", position: "relative" }}
      onSubmit={(e) => {
        e.preventDefault()
        const value = new FormData(e.currentTarget).get("q")
        if (typeof value === "string" && value.trim()) {
          window.location.href = `/herramientas?q=${encodeURIComponent(value.trim())}`
        }
      }}
    >
      <MagnifyingGlass
        size={16}
        weight="regular"
        style={{
          position: "absolute",
          left: "0.625rem",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--muted)",
        }}
      />
      <input
        name="q"
        type="search"
        placeholder="Buscar herramienta, concepto o derecho…"
        aria-label="Buscar herramienta, concepto o derecho"
        style={{
          width: 360,
          maxWidth: "40vw",
          minHeight: 36,
          padding: "0 0.75rem 0 2.25rem",
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-pill)",
          fontSize: "var(--text-sm)",
          color: "var(--fg)",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      <CaretDown
        size={12}
        weight="regular"
        style={{ marginLeft: "0.375rem", color: "var(--muted)", pointerEvents: "none" }}
      />
    </form>
  )
}