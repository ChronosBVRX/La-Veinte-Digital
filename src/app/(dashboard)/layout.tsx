import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Navbar } from "@/shared/components/layout/Navbar"
import type { ReactNode } from "react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <Navbar fullName={profile?.full_name ?? null} />
      <div style={{ display: "flex", flex: 1 }}>
        <nav style={{ width: "220px", background: "var(--card)", borderRight: "1px solid var(--border)", padding: "1rem" }}>
          <SidebarLinks />
        </nav>
        <main style={{ flex: 1, padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  )
}

function SidebarLinks() {
  const links = [
    { href: "/", label: "Inicio" },
    { href: "/foro", label: "Foro" },
    { href: "/chat", label: "Chat" },
    { href: "/asistente", label: "Asistente SNTSS" },
    { href: "/escritos", label: "Generar Escritos" },
    { href: "/catalogo", label: "Catálogo" },
    { href: "/profile", label: "Mi Perfil" },
  ]

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            style={{
              display: "block", padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
              textDecoration: "none", color: "var(--fg)", fontSize: "0.875rem",
            }}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
