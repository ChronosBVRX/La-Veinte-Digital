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
  "/api/union/licenses/complete": "authenticated",
  "/api/union/licenses/excel": "authenticated",
  "/api/union/licenses/permanent": "authenticated",
  "/api/union/licenses/print-package": "authenticated",
  "/api/union/licenses/restore": "authenticated",
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
  "/api/union/workers/import/upload-url": "authenticated",
  "/api/union/workers/import/master/preview": "authenticated",
  "/api/union/workers/import/master/apply": "authenticated",
  "/api/union/workers/import/master/upload-url": "authenticated",
  "/api/union/lockers/import/upload-url": "authenticated",
  "/api/union/lockers/import/preview": "authenticated",
  "/api/union/lockers/import/apply": "authenticated",
  "/api/union/lockers/import/rollback": "authenticated",
  "/api/union/lockers/import/history": "authenticated",
  "/api/union/lockers/import/errors": "authenticated",
  "/api/union/lockers/pendientes": "authenticated",
  "/api/union/lockers/map": "authenticated",
  "/api/union/lockers/zones": "authenticated",
  "/api/union/lockers/banks": "authenticated",
  "/api/union/lockers/move": "authenticated",
  "/api/union/lockers/swap": "authenticated",
  "/api/union/lockers/integrity": "authenticated",
  "/api/union/lockers/audits": "authenticated",
  "/api/union/lockers/audits/[id]": "authenticated",
  "/api/union/lockers/export": "authenticated",
  // Impresión Automática en Oficina Sindical (Representantes y Admins)
  "/api/union/print/jobs": "authenticated",
  "/api/union/print/jobs/[id]/retry": "authenticated",
  "/api/union/print/stations": "authenticated",
  "/api/union/print/stations/status": "authenticated",
  "/api/union/print/stations/[id]": "authenticated",
  "/api/union/print/enrollment/generate": "authenticated",
  // La Veinte Print Agent (Estación local autenticada vía X-Station-Token en handler)
  "/api/union/print-agent/enroll": "public",
  "/api/union/print-agent/heartbeat": "public",
  "/api/union/print-agent/pending-jobs": "public",
  "/api/union/print-agent/claim": "public",
  "/api/union/print-agent/jobs/[id]/document": "public",
  "/api/union/print-agent/jobs/[id]/status": "public",
  // Descarga del agente para Windows
  "/api/downloads/print-agent/windows": "public",
  "/api/cron/agenda-reminders": "public",
  "/api/cron/push-campaigns": "public",
  "/api/announcements/bar": "public",
  // Centro de Administración de Usuarios (solo platform admin, validado en el
  // servidor dentro de cada ruta y de nuevo en las RPC).
  "/api/admin/users": "authenticated",
  "/api/admin/users/[id]": "authenticated",
  "/api/admin/users/[id]/role": "authenticated",
  "/api/admin/users/[id]/union-role": "authenticated",
  "/api/admin/users/[id]/suspend": "authenticated",
  "/api/admin/users/[id]/reactivate": "authenticated",
  "/api/admin/users/[id]/trash": "authenticated",
  "/api/admin/users/[id]/restore": "authenticated",
  "/api/admin/users/[id]/sessions/revoke": "authenticated",
  "/api/admin/users/[id]/resend-confirmation": "authenticated",
  "/api/admin/users/[id]/password-recovery": "authenticated",
  "/api/admin/users/[id]/purge": "authenticated",
  "/api/admin/audit-log": "authenticated",
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
  // Aviso público para cuentas suspendidas o en papelera (sin datos internos).
  "/cuenta-suspendida",
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

// Rutas dinámicas del registro (p. ej. `/api/admin/users/[id]/trash`). Cada
// placeholder `[param]` coincide con EXACTAMENTE un segmento (`[^/]+`); el
// patrón queda ancorado al path completo, por lo que sigue prohibido el match
// por prefijo y los segmentos extra caen en `unknown-api`. El valor del
// segmento lo valida el propio route handler (UUID, etc.).
const DYNAMIC_SEGMENT = /^\[[a-z_][a-z0-9_]*\]$/i

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const API_ACCESS_PATTERNS: ReadonlyArray<{ regex: RegExp; level: ApiAccessLevel }> = Object.entries(
  API_ACCESS,
)
  .filter(([route]) => route.includes("["))
  .map(([route, level]) => ({
    regex: new RegExp(
      `^${route
        .split("/")
        .map((segment) => (DYNAMIC_SEGMENT.test(segment) ? "[^/]+" : escapeRegExp(segment)))
        .join("/")}$`,
    ),
    level,
  }))

export function getApiAccessLevel(pathname: string): ApiAccessLevel | null {
  if (Object.prototype.hasOwnProperty.call(API_ACCESS, pathname)) {
    return API_ACCESS[pathname as keyof typeof API_ACCESS]
  }

  for (const { regex, level } of API_ACCESS_PATTERNS) {
    if (regex.test(pathname)) return level
  }

  return null
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
