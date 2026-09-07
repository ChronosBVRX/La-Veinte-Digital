import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"

/**
 * Shell for public, no-account-required pages (privacy, terms, support, about, account requests).
 * Keeps a consistent, neutral layout with a link back to La Veinte Digital. It intentionally does
 * not pull in any authenticated navigation.
 */
export function PublicPageShell({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <header
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
          padding: "2.5rem 1rem 2rem",
          textAlign: "center",
        }}
      >
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "0.75rem",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image src="/logo-icon.png" alt="La Veinte Digital" width={26} height={26} style={{ maxHeight: 26, width: "auto" }} />
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>La Veinte Digital</span>
        </Link>
        <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700, margin: "1rem 0 0.25rem" }}>{title}</h1>
        {intro ? <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", margin: 0, maxWidth: 640, marginInline: "auto" }}>{intro}</p> : null}
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "2rem 1.5rem",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {children}
        </div>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "var(--primary)", textDecoration: "none" }}>← Volver a La Veinte Digital</Link>
          {" · "}
          <Link href="/informacion-y-fuentes" style={{ color: "var(--primary)", textDecoration: "underline" }}>Información y fuentes</Link>
          {" · "}
          <Link href="/privacidad" style={{ color: "var(--primary)", textDecoration: "underline" }}>Privacidad</Link>
          {" · "}
          <Link href="/terminos" style={{ color: "var(--primary)", textDecoration: "underline" }}>Términos</Link>
        </p>
      </main>
    </div>
  )
}
