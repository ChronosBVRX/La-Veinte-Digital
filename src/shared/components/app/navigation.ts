import {
  House,
  Calculator,
  CalendarDots,
  Notebook,
  FileText,
  Books,
  Newspaper,
  UserCircle,
  SquaresFour,
  AirplaneTilt,
  Briefcase,
  Wrench,
} from "@phosphor-icons/react"
import type { IconProps } from "@phosphor-icons/react"

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>
}

/**
 * Rutas cuyo contenido depende del tarjetón o trabajador activo.
 * Para evitar que el Router Cache de Next.js entregue snapshots RSC viejos
 * generados por prefetch antes de un cambio de tarjetón, estas rutas NO se prefetchean.
 */
export const ACTIVE_WORKER_DATA_ROUTES = [
  "/vacaciones",
  "/guia",
  "/calculadoras",
  "/profile/mi-informacion-laboral",
] as const

export function shouldPrefetchRoute(href: string): boolean {
  return !ACTIVE_WORKER_DATA_ROUTES.some(
    (route) => href === route || href.startsWith(`${route}/`) || href.startsWith(`${route}?`)
  )
}

export interface NavGroup {
  label: string
  area: "work" | "tools" | "assistance" | "community"
  color: string
  items: NavItem[]
}

const WORK_NAV_GROUP: NavGroup = {
  label: "MI TRABAJO",
  area: "work",
  color: "var(--area-work)",
  items: [
    { href: "/calendario", label: "Calendario", icon: CalendarDots },
    { href: "/vacaciones", label: "Vacaciones", icon: AirplaneTilt },
    { href: "/bitacora", label: "Mi Agenda", icon: Notebook },
  ],
}

const TOOLS_NAV_GROUP: NavGroup = {
  label: "HERRAMIENTAS",
  area: "tools",
  color: "var(--area-tools)",
  items: [
    { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
    { href: "/escritos", label: "Crear un escrito", icon: FileText },
    { href: "/guia", label: "Guía de mi Tarjetón", icon: Books },
  ],
}

const COMMUNITY_NAV_GROUP: NavGroup = {
  label: "COMUNIDAD",
  area: "community",
  color: "var(--area-community)",
  items: [
    { href: "/facebook", label: "Noticias SNTSS", icon: Newspaper },
  ],
}

export const DESKTOP_NAV_GROUPS: NavGroup[] = [
  WORK_NAV_GROUP,
  TOOLS_NAV_GROUP,
  COMMUNITY_NAV_GROUP,
]

export const BOTTOM_NAV_ITEMS: { key: string; label: string; icon: NavItem["icon"]; href?: string }[] = [
  { key: "inicio", label: "Inicio", icon: House, href: "/" },
  { key: "trabajo", label: "Mi trabajo", icon: Briefcase },
  { key: "herramientas", label: "Herramientas", icon: Wrench },
  { key: "mas", label: "Más", icon: SquaresFour },
]

export const MOBILE_SHEET_GROUPS: Record<string, { label: string; color: string; items: NavItem[] }> = {
  trabajo: {
    label: "Mi Trabajo",
    color: "var(--area-work)",
    items: WORK_NAV_GROUP.items,
  },
  herramientas: {
    label: "Herramientas",
    color: "var(--area-tools)",
    items: TOOLS_NAV_GROUP.items,
  },
  mas: {
    label: "Más",
    color: "var(--muted)",
    items: [
      ...COMMUNITY_NAV_GROUP.items,
      { href: "/profile", label: "Mi perfil", icon: UserCircle },
      { href: "/profile/mi-informacion-laboral", label: "Mi información laboral", icon: Briefcase },
      { href: "/informacion-y-fuentes", label: "Información y fuentes", icon: FileText },
    ],
  },
}
