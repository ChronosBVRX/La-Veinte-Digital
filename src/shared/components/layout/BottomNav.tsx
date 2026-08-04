"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Calculator, FileUp, Home, User } from "lucide-react"

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tarjeton", label: "Tarjetón", icon: FileUp },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/asistente", label: "Asistente", icon: Bot },
  { href: "/profile", label: "Perfil", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="mobile-only"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
        background: "var(--card)", borderTop: "1px solid var(--border)",
        height: "var(--bottom-nav-height)", display: "flex",
        alignItems: "center", justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "0.125rem", textDecoration: "none", color: "inherit",
              padding: "0.375rem 0.75rem", borderRadius: "var(--radius-sm)",
              transition: "all var(--transition)",
            }}
          >
            <Icon
              size={20}
              style={{
                color: isActive ? "var(--primary)" : "var(--muted)",
                transition: "color var(--transition)",
              }}
            />
            <span style={{
              fontSize: "0.625rem", fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--primary)" : "var(--muted)",
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
