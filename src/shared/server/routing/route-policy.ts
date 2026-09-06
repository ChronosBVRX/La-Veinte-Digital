export const API_ACCESS = {
  "/api/health": "public",
  "/api/calendario": "public",
  "/api/calculator-prefill": "authenticated",
  "/api/consulta": "authenticated",
  "/api/simulador": "authenticated",
  "/api/tarjeton/confirm": "authenticated",
  "/api/tarjeton/delete": "authenticated",
  "/api/worker-context": "authenticated",
  "/api/push/register": "authenticated",
  "/api/push/send": "authenticated",
  "/api/normativa/health": "authenticated",
  "/api/normativa/search": "authenticated",
  "/api/normativa/compare": "authenticated",
  "/api/normativa/audio": "authenticated",
  "/api/normativa/document": "authenticated",
  "/api/normativa/evidence": "authenticated",
  "/api/normativa/respuesta": "authenticated",
  "/api/normativa/script": "authenticated",
  "/api/normativa/tts": "authenticated",
  "/api/normativa/sync": "authenticated",
  "/api/normativa/visor": "authenticated",
  "/api/escritos/generar": "authenticated",
  "/api/cron/agenda-reminders": "public",
  "/api/cron/push-campaigns": "public",
} as const

export type ApiAccessLevel = (typeof API_ACCESS)[keyof typeof API_ACCESS]

// Add paths only after an exact page or platform rewrite exists. Prefix matching
// is intentionally forbidden so future public sections do not open siblings.
export const PUBLIC_PAGE_PATHS = [
  "/login",
  "/register",
  "/recuperar-password",
  "/restablecer-password",
  "/health",
  "/transfer",
  // Public legal/support pages (Phase 9 / 13). Plain http routes, no account required.
  "/privacidad",
  "/terminos",
  "/soporte",
  "/acerca-de",
  "/eliminar-cuenta",
] as const

export const PUBLIC_AUTH_ROUTE_PATHS = ["/callback"] as const

export type RequestRouteClass =
  | "public-api"
  | "authenticated-api"
  | "unknown-api"
  | "public-page"
  | "public-auth-route"
  | "protected-page"

function includesExact(paths: readonly string[], pathname: string): boolean {
  return paths.includes(pathname)
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/")
}

export function getApiAccessLevel(pathname: string): ApiAccessLevel | null {
  return Object.prototype.hasOwnProperty.call(API_ACCESS, pathname)
    ? API_ACCESS[pathname as keyof typeof API_ACCESS]
    : null
}

export function classifyRequestPath(pathname: string): RequestRouteClass {
  if (isApiPath(pathname)) {
    const accessLevel = getApiAccessLevel(pathname)
    return accessLevel ? `${accessLevel}-api` : "unknown-api"
  }

  if (includesExact(PUBLIC_PAGE_PATHS, pathname)) {
    return "public-page"
  }

  if (includesExact(PUBLIC_AUTH_ROUTE_PATHS, pathname)) {
    return "public-auth-route"
  }

  return "protected-page"
}
