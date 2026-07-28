"use client"

import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function Navbar({ fullName }: { fullName: string | null }) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", padding: "0 1.5rem", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }}>
        <div style={{ height: "36px", display: "flex", alignItems: "center" }}>
          <img src="/Logo SXX_recortado.png" alt="SXX" style={{ maxHeight: "100%", width: "auto", display: "block" }} />
        </div>
        <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>SXX</span>
        <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>|</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em" }}>La Veinte Digital</span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{fullName}</span>
        <button
          onClick={handleSignOut}
          style={{ background: "none", border: "1px solid var(--border)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.875rem", cursor: "pointer", color: "var(--fg)" }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
