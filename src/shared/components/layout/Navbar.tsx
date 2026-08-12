"use client"

import Link from "next/link"
import Image from "next/image"

export function Navbar({ fullName }: { fullName: string | null }) {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", color: "inherit" }}>
      <div style={{ height: "36px", display: "flex", alignItems: "center" }}>
        <Image
          src="/logo-horizontal.png"
          alt="La Veinte Digital"
          width={140}
          height={36}
          priority
          style={{ maxHeight: "100%", width: "auto", height: "36px", objectFit: "contain", display: "block" }}
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
