export const API_ACCESS = {
  "/api/health": "public",
  "/api/calendario": "public",
  "/api/calculator-prefill": "authenticated",
  "/api/consulta": "authenticated",
  "/api/tarjeton/confirm": "authenticated",
  "/api/tarjeton/delete": "authenticated",
  "/api/tarjeton/select": "authenticated",
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
  "/api/union/workers": "authenticated",
  "/api/union/cases": "authenticated",
  "/api/union/lockers": "authenticated",
  "/api/union/waitlist": "authenticated",
  "/api/union/passages": "authenticated",
  "/api/union/passages/pdf": "authenticated",
  "/api/union/licenses": "authenticated",
  "/api/union/licenses/excel": "authenticated",
  "/api/union/licenses/word": "authenticated",
  "/api/union/dashboard": "authenticated",
  "/api/union/members": "authenticated",
  "/api/union/settings": "authenticated",
  "/api/union/audit": "authenticated",
  "/api/union/workers/import/preview": "authenticated",
  "/api/union/workers/import/confirm": "authenticated",
  "/api/union/workers/import/rollback": "authenticated",
  "/api/union/workers/imports": "authenticated",
  "/api/union/workers/import/errors": "authenticated",
  "/api/union/workers/import/master/preview": "authenticated",
  "/api/union/workers/import/master/apply": "authenticated",
  "/api/cron/agenda-reminders": "public",
  "/api/cron/push-campaigns": "public",
  "/api/announcements/bar": "public",
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
  "/informacion-y-fuentes",
  "/eliminar-cuenta",
] as const

export const PUBLIC_AUTH_ROUTE_PATHS = ["/callback"] as const

// Assets estáticos públicos, servidos desde `public/vendor/` (regenerados por
// `scripts/copy-vendor.mjs` en prebuild). Son bundles de motor, sin datos de
// usuario: el escáner de documentos (OpenCV.js) y el visor de PDF (worker de
// pdf.js) deben poder cargarse sin sesión. Lista EXACTA por archivo: jamás se
// abre por prefijo ni por extensión `.js` genérica.
export const PUBLIC_STATIC_ASSET_PATHS = [
  "/vendor/opencv/opencv.js",
  "/vendor/pdfjs/pdf.worker.min.mjs",
] as const

export type RequestRouteClass =
  | "public-api"
  | "authenticated-api"
  | "unknown-api"
  | "public-page"
  | "public-auth-route"
  | "public-static-asset"
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

  if (includesExact(PUBLIC_STATIC_ASSET_PATHS, pathname)) {
    return "public-static-asset"
  }

  return "protected-page"
}
