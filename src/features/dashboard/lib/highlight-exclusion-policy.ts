/**
 * Catálogo canónico de acciones rápidas visibles en "¿Qué necesitas hoy?" (HomeQuickActions).
 *
 * REGLA SUPREMA DE DISEÑO DEL CARRUSEL:
 * "Mostrar funciones, servicios, novedades o información útil que no esté ya visible
 * en ¿Qué necesitas hoy?."
 *
 * El carrusel de destacados NO debe promocionar estas mismas funciones para evitar
 * duplicación visual y funcional en la pantalla de Inicio.
 */

export const HOME_QUICK_ACTION_IDS = new Set([
  "agenda",
  "tarjeton",
  "checadas",
  "documentos",
  "escritos",
  "derechos",
] as const)

export type HomeQuickActionId =
  | "agenda"
  | "tarjeton"
  | "checadas"
  | "documentos"
  | "escritos"
  | "derechos"

export interface ExcludedQuickActionRule {
  id: HomeQuickActionId
  title: string
  normalizedTitles: readonly string[]
  routes: readonly string[]
}

export const EXCLUDED_HOME_QUICK_ACTIONS: readonly ExcludedQuickActionRule[] = [
  {
    id: "agenda",
    title: "Mi agenda",
    normalizedTitles: ["mi agenda", "agenda", "agenda laboral", "guardias y compromisos"],
    routes: ["/bitacora"],
  },
  {
    id: "tarjeton",
    title: "Mi tarjetón",
    normalizedTitles: [
      "mi tarjeton",
      "mi tarjetón",
      "tarjeton",
      "tarjetón",
      "recibos de pago",
      "consulta tus recibos de pago",
    ],
    routes: ["/profile/mi-informacion-laboral", "/tarjeton"],
  },
  {
    id: "checadas",
    title: "Mis checadas",
    normalizedTitles: ["mis checadas", "checadas", "biometricos", "biométricos"],
    routes: ["/documentos-personales"],
  },
  {
    id: "documentos",
    title: "Mis documentos",
    normalizedTitles: ["mis documentos", "documentos", "archivos guardados"],
    routes: ["/documentos-personales"],
  },
  {
    id: "escritos",
    title: "Hacer un escrito",
    normalizedTitles: ["hacer un escrito", "hacer escrito", "generar escrito", "crear escrito", "escritos"],
    routes: ["/escritos"],
  },
  {
    id: "derechos",
    title: "Mis derechos",
    normalizedTitles: ["mis derechos", "derechos", "asistente normativo", "asistente de derechos"],
    routes: ["/asistente"],
  },
] as const

/**
 * Validador funcional: comprueba si un slide (interno o dinámico) intenta promocionar
 * una función ya visible en HomeQuickActions.
 *
 * El cálculo de aumento salarial ("Tu aumento estimado") está expresamente permitido como Slide A
 * y tiene su propia lógica e identidad diferenciada de "Mi tarjetón: consulta tus recibos".
 */
export function isExcludedByQuickActions(slide: {
  id?: string
  title?: string
  href?: string
}): boolean {
  if (!slide) return false

  // 1. Verificación directa por ID reservado
  if (slide.id && HOME_QUICK_ACTION_IDS.has(slide.id as HomeQuickActionId)) {
    return true
  }

  // 2. Coincidencia por título o alias normalizado
  const normalizedTitle = (slide.title || "").trim().toLowerCase()
  if (normalizedTitle) {
    for (const rule of EXCLUDED_HOME_QUICK_ACTIONS) {
      if (
        rule.normalizedTitles.some(
          (t) => normalizedTitle === t || normalizedTitle.startsWith(`${t}:`) || normalizedTitle.startsWith(`${t} -`),
        )
      ) {
        return true
      }
    }
  }

  return false
}
