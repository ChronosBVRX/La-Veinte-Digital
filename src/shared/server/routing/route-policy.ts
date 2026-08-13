export const API_ACCESS = {
  "/api/health": "public",
  "/api/calendario": "public",
  "/api/calculator-prefill": "authenticated",
  "/api/consulta": "authenticated",
  "/api/simulador": "authenticated",
  "/api/tarjeton/confirm": "authenticated",
  "/api/tarjeton/delete": "authenticated",
  "/api/worker-context": "authenticated",
} as const

export type ApiAccessLevel = (typeof API_ACCESS)[keyof typeof API_ACCESS]

// Add paths only after an exact page or platform rewrite exists. Prefix matching
// is intentionally forbidden so future public sections do not open siblings.
export const PUBLIC_PAGE_PATHS = [
  "/login",
  "/register",
  "/health",
  "/transfer",
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
