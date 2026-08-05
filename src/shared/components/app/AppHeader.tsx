"use client"

import Link from "next/link"
import Image from "next/image"
import { List, UserCircle } from "@phosphor-icons/react"

interface AppHeaderProps {
  fullName: string | null
  onMenuToggle: () => void
}

export function AppHeader({ fullName, onMenuToggle }: AppHeaderProps) {
  const firstName = fullName?.split(" ")[0] ?? ""

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
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-fg)",
          }}
        >
          <UserCircle size={18} weight="fill" />
        </div>
      </div>
    </header>
  )
}
