"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  House,
  Bell,
  Megaphone,
  Users,
  MagnifyingGlass,
  DeviceMobile,
  AndroidLogo,
  ClockCounterClockwise,
} from "@phosphor-icons/react"
import type { AdminCapabilities } from "@/shared/server/admin/admin-capabilities"

export interface AdminSubNavProps {
  capabilities?: AdminCapabilities | null
}

interface NavItemDef {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>
  exact?: boolean
  requiredCapability?: (caps: AdminCapabilities) => boolean
}

const NAV_ITEMS: NavItemDef[] = [
  {
    href: "/admin",
    label: "Panel",
    icon: House,
    exact: true,
    requiredCapability: (caps) => caps.isAdmin,
  },
  {
    href: "/admin/push",
    label: "Alertas Push",
    icon: Bell,
    requiredCapability: (caps) => caps.isAdmin || caps.canAccessLegacyPush,
  },
  {
    href: "/admin/avisos",
    label: "Avisos",
    icon: Megaphone,
    requiredCapability: (caps) => caps.canManageAnnouncements,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    requiredCapability: (caps) => caps.isAdmin,
  },
  {
    href: "/admin/radar",
    label: "Radar & Pagos",
    icon: MagnifyingGlass,
    requiredCapability: (caps) => caps.isAdmin,
  },
  {
    href: "/admin/barra",
    label: "Barra Móvil",
    icon: DeviceMobile,
    requiredCapability: (caps) => caps.canManageAnnouncements,
  },
  {
    href: "/admin/android",
    label: "Android",
    icon: AndroidLogo,
    requiredCapability: (caps) => caps.canAccessAndroidAdmin,
  },
  {
    href: "/admin/usuarios/auditoria",
    label: "Auditoría",
    icon: ClockCounterClockwise,
    requiredCapability: (caps) => caps.isAdmin,
  },
]

function isItemActive(pathname: string, item: NavItemDef): boolean {
  if (item.exact || item.href === "/admin") {
    return pathname === item.href
  }
  if (item.href === "/admin/usuarios") {
    return (
      pathname === "/admin/usuarios" ||
      (pathname.startsWith("/admin/usuarios/") && !pathname.startsWith("/admin/usuarios/auditoria"))
    )
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function AdminSubNav({ capabilities }: AdminSubNavProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!capabilities) return true
    return item.requiredCapability ? item.requiredCapability(capabilities) : true
  })

  // Si solo hay 1 ítem (ej. solo legacy push), no estorbar con barra
  if (visibleItems.length <= 1) return null

  return (
    <nav
      aria-label="Navegación contextual de administración"
      style={{
        position: "sticky",
        top: "var(--nav-height, 56px)",
        zIndex: 35,
        background: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        overflowX: "auto",
        padding: "0.5rem 1rem",
        boxSizing: "border-box",
        scrollbarWidth: "none",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          margin: "0 auto",
          maxWidth: "1000px",
          width: "100%",
          minWidth: "max-content",
        }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--muted)",
            marginRight: "0.25rem",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Admin:
        </span>
        {visibleItems.map((item) => {
          const isActive = isItemActive(pathname, item)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-pill, 9999px)",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
                background: isActive ? "var(--primary)" : "var(--accent, #f1f5f9)",
                color: isActive ? "#ffffff" : "var(--fg)",
                border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                boxShadow: isActive ? "0 1px 3px rgba(37,99,235,0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} weight={isActive ? "fill" : "regular"} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
