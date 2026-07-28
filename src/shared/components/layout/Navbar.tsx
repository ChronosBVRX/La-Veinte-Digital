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
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: "inherit" }}>
        <img src="/Logo SXX_sin_fondo.png" alt="La Veinte Digital" height={36} style={{ display: "block", width: "auto" }} />
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
