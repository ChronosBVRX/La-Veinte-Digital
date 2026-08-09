import {
  House,
  IdentificationCard,
  Receipt,
  Calculator,
  CalendarDots,
  Notebook,
  FileText,
  Books,
  Sparkle,
  Scales,
  Newspaper,
  UserCircle,
  SquaresFour,
  AirplaneTilt,
  Briefcase,
  Wrench,
  ArrowsLeftRight,
} from "@phosphor-icons/react"
import type { IconProps } from "@phosphor-icons/react"

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>
}

export interface NavGroup {
  label: string
  area: "work" | "tools" | "assistance" | "community"
  color: string
  items: NavItem[]
}

export const DESKTOP_NAV_GROUPS: NavGroup[] = [
  {
    label: "MI TRABAJO",
    area: "work",
    color: "var(--area-work)",
    items: [
      { href: "/tarjeton", label: "Mi Tarjetón", icon: IdentificationCard },
      { href: "/calendario", label: "Calendario", icon: CalendarDots },
      { href: "/vacaciones", label: "Vacaciones", icon: AirplaneTilt },
      { href: "/bitacora", label: "Mis incidencias", icon: Notebook },
    ],
  },
  {
    label: "HERRAMIENTAS",
    area: "tools",
    color: "var(--area-tools)",
    items: [
      { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
      { href: "/simulador-nomina", label: "Simulador de nómina", icon: ArrowsLeftRight },
      { href: "/escritos", label: "Crear un escrito", icon: FileText },
      { href: "/catalogo", label: "Consultar conceptos", icon: Books },
    ],
  },
  {
    label: "ASISTENCIA",
    area: "assistance",
    color: "var(--area-assistance)",
    items: [
      { href: "/asistente", label: "Preguntar sobre mis derechos", icon: Sparkle },
      { href: "/simulador", label: "Practicar una audiencia", icon: Scales },
    ],
  },
  {
    label: "COMUNIDAD",
    area: "community",
    color: "var(--area-community)",
    items: [
      { href: "/facebook", label: "Noticias SNTSS", icon: Newspaper },
    ],
  },
]

export const BOTTOM_NAV_ITEMS: { key: string; label: string; icon: NavItem["icon"]; href?: string }[] = [
  { key: "inicio", label: "Inicio", icon: House, href: "/" },
  { key: "trabajo", label: "Mi trabajo", icon: Briefcase },
  { key: "asistente", label: "Asistente", icon: Sparkle, href: "/asistente" },
  { key: "herramientas", label: "Herramientas", icon: Wrench },
  { key: "mas", label: "Más", icon: SquaresFour },
]

export const MOBILE_SHEET_GROUPS: Record<string, { label: string; color: string; items: NavItem[] }> = {
  trabajo: {
    label: "Mi Trabajo",
    color: "var(--area-work)",
    items: DESKTOP_NAV_GROUPS[0].items,
  },
  herramientas: {
    label: "Herramientas",
    color: "var(--area-tools)",
    items: DESKTOP_NAV_GROUPS[1].items,
  },
  mas: {
    label: "Más",
    color: "var(--muted)",
    items: [
      ...DESKTOP_NAV_GROUPS[3].items,
      { href: "/profile", label: "Mi Perfil", icon: UserCircle },
    ],
  },
}
