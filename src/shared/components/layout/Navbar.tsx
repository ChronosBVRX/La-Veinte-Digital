"use client"

import Link from "next/link"
import Image from "next/image"

export function Navbar({ fullName }: { fullName: string | null }) {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", color: "inherit" }}>
      <div style={{ height: "32px", display: "flex", alignItems: "center" }}>
        <Image
          src="/Logo SXX_recortado.png"
          alt="SXX"
          width={32}
          height={32}
          priority
          style={{ maxHeight: "100%", width: "auto", height: "32px", objectFit: "contain", display: "block" }}
        />
      </div>
      <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>La Veinte Digital</span>
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
