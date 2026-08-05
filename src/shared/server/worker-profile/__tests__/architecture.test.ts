/**
 * Prueba de arquitectura: capa server-only.
 *
 * Verifica que:
 * - El punto de entrada del servicio importa "server-only".
 * - Ningún componente "use client" importa desde worker-profile.
 * - El dominio (src/shared/domain/worker) NO importa el servicio.
 *
 * Lectura estática de archivos, sin dependencias de runtime.
 */
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "fs"
import { resolve } from "path"

// __tests__ → worker-profile → server → shared → src → repo-root
const REPO_ROOT = resolve(import.meta.dirname!, "..", "..", "..", "..", "..")
const SRC_DIR = resolve(REPO_ROOT, "src")

function scanFiles(dir: string, ext: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory() && !entry.startsWith("__")) {
      scanFiles(full, ext, results)
    } else if (entry.endsWith(ext)) {
      results.push(full)
    }
  }
  return results
}

function fileContains(path: string, substr: string): boolean {
  return readFileSync(path, "utf8").includes(substr)
}

describe("server-only enforcement", () => {
  it("el punto de entrada del servicio importa server-only", () => {
    const index = resolve(SRC_DIR, "shared", "server", "worker-profile", "index.ts")
    expect(fileContains(index, 'import "server-only"')).toBe(true)
  })

  it("el servicio importa server-only", () => {
    const svc = resolve(SRC_DIR, "shared", "server", "worker-profile", "service.ts")
    expect(fileContains(svc, 'import "server-only"')).toBe(true)
  })

  it("ningún componente 'use client' en src/app importa el WorkerProfileService", () => {
    const components = scanFiles(resolve(SRC_DIR, "app"), ".tsx")
    for (const c of components) {
      const content = readFileSync(c, "utf8")
      if (content.includes('"use client"') || content.includes("'use client'")) {
        // Solo prohíbe importaciones del servicio server-only, no de acciones ni dominio.
        expect(content).not.toContain("@/shared/server/worker-profile")
      }
    }
  })

  it("ningún archivo features con 'use client' importa el WorkerProfileService directamente", () => {
    const featFiles = scanFiles(resolve(SRC_DIR, "features"), ".tsx")
    for (const f of featFiles) {
      const content = readFileSync(f, "utf8")
      if (content.includes('"use client"') || content.includes("'use client'")) {
        expect(content).not.toContain("@/shared/server/worker-profile")
      }
    }
  })

  it("el dominio NO importa el servicio (sin dependencia circular)", () => {
    const domainDir = resolve(SRC_DIR, "shared", "domain", "worker")
    for (const entry of readdirSync(domainDir)) {
      if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
        const content = readFileSync(resolve(domainDir, entry), "utf8")
        expect(content).not.toContain("WorkerProfileService")
        expect(content).not.toContain("mapRpcError")
        expect(content).not.toContain("@/shared/server/worker-profile")
      }
    }
  })
})
