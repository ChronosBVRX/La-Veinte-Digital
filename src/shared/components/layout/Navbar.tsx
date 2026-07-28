"use client"

import Link from "next/link"

export function Navbar({ fullName }: { fullName: string | null }) {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", color: "inherit" }}>
      <div style={{ height: "32px", display: "flex", alignItems: "center" }}>
        <img src="/Logo SXX_recortado.png" alt="SXX" style={{ maxHeight: "100%", width: "auto", display: "block" }} />
      </div>
      <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>SXX</span>
      <span className="desktop-only" style={{ fontSize: "0.875rem", color: "var(--muted)" }}>|</span>
      <span className="desktop-only" style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em" }}>La Veinte Digital</span>
      {fullName && (
        <span className="desktop-only" style={{
          fontSize: "0.8125rem", color: "var(--muted)", marginLeft: "0.75rem",
          paddingLeft: "0.75rem", borderLeft: "1px solid var(--border)",
        }}>
          {fullName}
        </span>
      )}
    </Link>
  )
}
