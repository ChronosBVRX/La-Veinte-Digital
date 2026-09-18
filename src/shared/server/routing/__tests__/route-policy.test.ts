import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  API_ACCESS,
  PUBLIC_STATIC_ASSET_PATHS,
  classifyRequestPath,
} from "../route-policy"

const API_DIRECTORY = path.resolve(process.cwd(), "src", "app", "api")

function discoverApiRoutes(directory = API_DIRECTORY, segments: string[] = []): string[] {
  const routes: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...discoverApiRoutes(path.join(directory, entry.name), [...segments, entry.name]))
    } else if (entry.isFile() && entry.name === "route.ts") {
      routes.push(segments.length === 0 ? "/api" : `/api/${segments.join("/")}`)
    }
  }

  return routes
}

describe("API route policy", () => {
  it("classifies every API route explicitly", () => {
    expect(API_ACCESS).toEqual({
      "/api/health": "public",
      "/api/calendario": "public",
      "/api/cron/agenda-reminders": "public",
      "/api/cron/push-campaigns": "public",
      "/api/announcements/bar": "public",
      "/api/calculator-prefill": "authenticated",
      "/api/consulta": "authenticated",
      "/api/normativa/audio": "authenticated",
      "/api/normativa/compare": "authenticated",
      "/api/normativa/document": "authenticated",
      "/api/normativa/evidence": "authenticated",
      "/api/normativa/health": "authenticated",
      "/api/normativa/respuesta": "authenticated",
      "/api/normativa/sync": "authenticated",
      "/api/normativa/script": "authenticated",
      "/api/normativa/search": "authenticated",
      "/api/normativa/tts": "authenticated",
      "/api/normativa/visor": "authenticated",
      "/api/push/register": "authenticated",
      "/api/push/send": "authenticated",
      "/api/tarjeton/confirm": "authenticated",
      "/api/tarjeton/delete": "authenticated",
      "/api/tarjeton/select": "authenticated",
      "/api/worker-context": "authenticated",
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
      "/api/union/workers/import/master/preview": "authenticated",
      "/api/union/workers/import/master/apply": "authenticated",
      "/api/union/workers/import/master/upload-url": "authenticated",
      "/api/union/workers/import/upload-url": "authenticated",
      "/api/union/workers/import/rollback": "authenticated",
      "/api/union/workers/imports": "authenticated",
      "/api/union/workers/import/errors": "authenticated",
      "/api/union/lockers/import/upload-url": "authenticated",
      "/api/union/lockers/import/preview": "authenticated",
      "/api/union/lockers/import/apply": "authenticated",
      "/api/union/lockers/import/rollback": "authenticated",
      "/api/union/lockers/import/history": "authenticated",
      "/api/union/lockers/import/errors": "authenticated",
      "/api/union/lockers/pendientes": "authenticated",
      // Centro de Administración de Usuarios (migración 20260919040000)
      "/api/admin/users": "authenticated",
      "/api/admin/users/[id]": "authenticated",
      "/api/admin/users/[id]/role": "authenticated",
      "/api/admin/users/[id]/suspend": "authenticated",
      "/api/admin/users/[id]/reactivate": "authenticated",
      "/api/admin/users/[id]/trash": "authenticated",
      "/api/admin/users/[id]/restore": "authenticated",
      "/api/admin/users/[id]/sessions/revoke": "authenticated",
      "/api/admin/users/[id]/resend-confirmation": "authenticated",
      "/api/admin/users/[id]/password-recovery": "authenticated",
      "/api/admin/users/[id]/purge": "authenticated",
      "/api/admin/audit-log": "authenticated",
    })
  })

  it("has a one-to-one policy entry for every app API route", () => {
    const policyPaths = Object.keys(API_ACCESS)

    expect(new Set(policyPaths).size).toBe(policyPaths.length)
    expect(discoverApiRoutes().sort()).toEqual(policyPaths.sort())
  })

  it("keeps requireUser inside every authenticated route", () => {
    const authenticatedRoutes = Object.entries(API_ACCESS)
      .filter(([, access]) => access === "authenticated")
      .map(([route]) => route)

    for (const route of authenticatedRoutes) {
      const relativeSegments = route.slice("/api/".length).split("/")
      const source = readFileSync(
        path.join(API_DIRECTORY, ...relativeSegments, "route.ts"),
        "utf8",
      )
      expect(source, `${route} must call requireUser()`).toMatch(/\brequireUser\s*\(/)
    }
  })

  it.each([
    ["/api/health", "public-api"],
    ["/api/calendario", "public-api"],
    ["/api/consulta", "authenticated-api"],
    ["/api/consulta/status", "unknown-api"],
    ["/api/health.json", "unknown-api"],
    ["/api", "unknown-api"],
    ["/login", "public-page"],
    ["/register", "public-page"],
    ["/health", "public-page"],
    ["/privacidad", "public-page"],
    ["/terminos", "public-page"],
    ["/soporte", "public-page"],
    ["/acerca-de", "public-page"],
    ["/informacion-y-fuentes", "public-page"],
    ["/eliminar-cuenta", "public-page"],
    ["/callback", "public-auth-route"],
    ["/vendor/opencv/opencv.js", "public-static-asset"],
    ["/vendor/pdfjs/pdf.worker.min.mjs", "public-static-asset"],
    ["/vendor/tesseract/worker.min.js", "protected-page"],
    ["/vendor/opencv/opencv.js.map", "protected-page"],
    ["/vendor/opencv/", "protected-page"],
    ["/vendor/", "protected-page"],
    ["/app.js", "protected-page"],
    ["/documentos-personales/datos.js", "protected-page"],
    ["/login/help", "protected-page"],
    ["/register-other", "protected-page"],
    ["/", "protected-page"],
  ] as const)("classifies %s as %s", (pathname, expected) => {
    expect(classifyRequestPath(pathname)).toBe(expected)
  })

  it("only opens exact vendor asset files, never a generic .js extension", () => {
    for (const assetPath of PUBLIC_STATIC_ASSET_PATHS) {
      expect(assetPath).toMatch(/^\/vendor\/[a-z0-9-]+\/[a-z0-9.-]+\.(?:js|mjs)$/)
      expect(assetPath.endsWith("/")).toBe(false)
    }
    expect(classifyRequestPath("/vendor/opencv")).toBe("protected-page")
    expect(classifyRequestPath("/vendor/pdfjs")).toBe("protected-page")
  })
})
