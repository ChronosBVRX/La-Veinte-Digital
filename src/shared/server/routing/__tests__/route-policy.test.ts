import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  API_ACCESS,
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
      "/api/simulador": "authenticated",
      "/api/tarjeton/confirm": "authenticated",
      "/api/tarjeton/delete": "authenticated",
      "/api/worker-context": "authenticated",
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
    ["/eliminar-cuenta", "public-page"],
    ["/callback", "public-auth-route"],
    ["/login/help", "protected-page"],
    ["/register-other", "protected-page"],
    ["/", "protected-page"],
  ] as const)("classifies %s as %s", (pathname, expected) => {
    expect(classifyRequestPath(pathname)).toBe(expected)
  })
})
