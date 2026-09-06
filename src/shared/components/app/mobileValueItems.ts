"use client"

/**
 * Catálogo LOCAL de mensajes de la barra informativa móvil.
 *
 * Solo hechos verificables del propio producto (herramientas y rutas que
 * existen): ningún dato jurídico con cifras. Los tips normativos futuros
 * deberán traer `source.document` + `source.reference` verificados o no
 * se incluyen. Sin patrocinadores activos (el tipo existe, sin items).
 */

export type MobileValueItemType = "tip" | "tool" | "announcement" | "sponsor"

export interface MobileValueItem {
  id: string
  type: MobileValueItemType
  eyebrow?: string
  text: string
  href?: string
  ctaLabel?: string
  source?: {
    document: string
    reference: string
  }
  /** Prefijos de ruta donde este mensaje es contextual. Sin `routes`: general. */
  routes?: string[]
  priority?: number
  startsAt?: string
  endsAt?: string
  enabled: boolean
  sponsorName?: string
}

export const MOBILE_VALUE_ITEMS: MobileValueItem[] = [
  {
    id: "aguinaldo",
    type: "tool",
    eyebrow: "Calculadoras",
    text: "¿Sabías que puedes calcular tu aguinaldo desde La Veinte Digital?",
    href: "/calculadoras",
    ctaLabel: "Calcular",
    routes: ["/", "/guia", "/asistente"],
    enabled: true,
  },
  {
    id: "tiempo-extra",
    type: "tool",
    eyebrow: "Calculadoras",
    text: "Calcula cuánto podrían pagarte por tiempo extra.",
    href: "/calculadoras",
    ctaLabel: "Calcular",
    enabled: true,
  },
  {
    id: "segunda-julio",
    type: "tool",
    eyebrow: "Calculadoras",
    text: "Consulta tu cálculo de Segunda de Julio.",
    href: "/calculadoras",
    ctaLabel: "Consultar",
    enabled: true,
  },
  {
    id: "escrito",
    type: "tool",
    eyebrow: "Escritos",
    text: "¿Necesitas presentar una petición? Puedes crear un escrito desde aquí.",
    href: "/escritos",
    ctaLabel: "Crear",
    routes: ["/", "/asistente", "/guia"],
    enabled: true,
  },
  {
    id: "vacaciones",
    type: "tip",
    eyebrow: "Vacaciones",
    text: "Planea tus vacaciones con el simulador.",
    href: "/vacaciones",
    ctaLabel: "Planear",
    routes: ["/", "/bitacora", "/calendario"],
    enabled: true,
  },
  {
    id: "tarjetones",
    type: "tool",
    eyebrow: "Documentos",
    text: "Consulta tus tarjetones guardados.",
    href: "/documentos-personales",
    ctaLabel: "Ver",
    routes: ["/guia", "/calculadoras"],
    enabled: true,
  },
  {
    id: "asistente",
    type: "tool",
    eyebrow: "Asistente",
    text: "Pregunta al asistente sobre tus derechos laborales.",
    href: "/asistente",
    ctaLabel: "Preguntar",
    routes: ["/", "/escritos", "/guia"],
    enabled: true,
  },
  {
    id: "agenda",
    type: "tip",
    eyebrow: "Mi Agenda",
    text: "Registra tus guardias y compromisos en Mi Agenda.",
    href: "/bitacora",
    ctaLabel: "Abrir",
    routes: ["/calendario", "/vacaciones"],
    enabled: true,
  },
]

export type MobileValueEventName =
  | "mobile_value_impression"
  | "mobile_value_click"
  | "mobile_value_dismiss"

/**
 * Adapter de analítica desacoplado. Hoy es no-op a propósito: no existe un
 * proveedor central y no se añade ninguna dependencia por analítica.
 */
export function trackMobileValueEvent(
  _event: MobileValueEventName,
  _itemId: string,
): void {
  // Reservado para un futuro proveedor central.
  void _event
  void _itemId
}

function rootOf(path: string): string {
  const segment = path.split("/")[1] ?? ""
  return `/${segment}`
}

function inWindow(item: MobileValueItem, now: Date): boolean {
  if (item.startsAt && now < new Date(item.startsAt)) return false
  if (item.endsAt && now > new Date(item.endsAt)) return false
  return true
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export interface MobileValueSelection {
  items?: MobileValueItem[]
  seed?: number
  offset?: number
  now?: Date
}

/**
 * Candidatos para una ruta: primero contextuales (sin autopromocionar la
 * sección actual), luego generales. Los `sponsor` quedan excluidos hasta
 * activación editorial explícita futura.
 */
export function selectMobileValueItems(
  pathname: string,
  selection: MobileValueSelection = {},
): MobileValueItem[] {
  const items = selection.items ?? MOBILE_VALUE_ITEMS
  const now = selection.now ?? new Date()
  const currentRoot = rootOf(pathname || "/")
  const active = items.filter(
    (item) => item.enabled && item.type !== "sponsor" && inWindow(item, now),
  )
  // Sin href no hay sección que autopromocionar: siempre candidato.
  const itemRoot = (item: MobileValueItem): string => (item.href ? rootOf(item.href) : "")
  const contextual = active.filter(
    (item) =>
      item.routes?.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ) && itemRoot(item) !== currentRoot,
  )
  if (contextual.length > 0) return contextual
  const general = active.filter(
    (item) => !item.routes && itemRoot(item) !== currentRoot,
  )
  if (general.length > 0) return general
  return active.filter((item) => itemRoot(item) !== currentRoot)
}

/** Selección determinística por sesión/ruta: un mensaje a la vez, sin marquee. */
export function pickMobileValueItem(
  pathname: string,
  selection: MobileValueSelection = {},
): MobileValueItem | null {
  const pool = selectMobileValueItems(pathname, selection)
  if (pool.length === 0) return null
  const seed = selection.seed ?? 0
  const offset = selection.offset ?? 0
  const index = (hashString(pathname) + Math.abs(seed) + Math.abs(offset)) % pool.length
  return pool[index]
}

/**
 * Combina los items dinámicos del servidor con el catálogo local de fallback.
 * Evita duplicados por id y coloca los dinámicos al inicio.
 */
export function mergeMobileBarItems(
  localItems: MobileValueItem[],
  remoteItems: MobileValueItem[],
): MobileValueItem[] {
  if (!remoteItems || remoteItems.length === 0) return localItems
  const seenIds = new Set(remoteItems.map((r) => r.id))
  const filteredLocal = localItems.filter((l) => !seenIds.has(l.id))
  return [...remoteItems, ...filteredLocal]
}

