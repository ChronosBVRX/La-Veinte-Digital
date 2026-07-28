"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Menu, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import type { ReactNode } from "react"

interface DashboardShellProps {
  fullName: string | null
  children: ReactNode
}

export function DashboardShell({ fullName, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--card)", borderBottom: "1px solid var(--border)",
          padding: "0 1rem", height: "var(--nav-height)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 60,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={toggleSidebar}
            className="mobile-only"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.375rem", borderRadius: "var(--radius-sm)",
              color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <Navbar fullName={fullName} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {fullName && (
            <span className="mobile-only" style={{
              fontSize: "0.8125rem", color: "var(--muted)", maxWidth: 120,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {fullName}
            </span>
          )}
          <button
            onClick={handleSignOut}
            style={{
              background: "none", border: "1px solid var(--border)",
              padding: "0.375rem 0.75rem", borderRadius: "var(--radius)",
              fontSize: "0.8125rem", cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", gap: "0.375rem",
              transition: "all var(--transition)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "var(--error)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--muted)" }}
          >
            <LogOut size={14} />
            <span className="desktop-only">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <main style={{
          flex: 1, padding: "1.5rem", overflow: "auto",
          minHeight: "calc(100dvh - var(--nav-height))",
        }}>
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
