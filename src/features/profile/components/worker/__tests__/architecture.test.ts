import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { resolve } from "path"

// __tests__ → worker → components → profile → features → src → repo
const REPO_ROOT = resolve(import.meta.dirname!, "..", "..", "..", "..", "..", "..")
const SRC_DIR = resolve(REPO_ROOT, "src")

describe("worker profile center architecture", () => {
  it("Client Components no importan WorkerProfileService", () => {
    const centerTsx = resolve(SRC_DIR, "features", "profile", "components", "worker", "WorkerProfileCenter.tsx")
    const content = readFileSync(centerTsx, "utf8")
    expect(content).not.toContain("WorkerProfileService")
    expect(content).not.toContain("@/shared/server/worker-profile")
  })

  it("componentes laborales no importan acciones de ProfileForm", () => {
    const centerTsx = resolve(SRC_DIR, "features", "profile", "components", "worker", "WorkerProfileCenter.tsx")
    const content = readFileSync(centerTsx, "utf8")
    expect(content).not.toContain("@/features/profile/components/ProfileForm")
  })

  it("ningún componente laboral escribe directamente profiles", () => {
    const names = ["WorkerProfileCenter", "ManualCaptureStep", "OnboardingWizard", "DeleteWorkerDataSection"]
    for (const c of names) {
      const path = resolve(SRC_DIR, "features", "profile", "components", "worker", `${c}.tsx`)
      const content = readFileSync(path, "utf8")
      expect(content).not.toContain('.from("profiles")')
      expect(content).not.toContain(".from('profiles')")
    }
  })

  it("las Server Actions no importan Supabase directamente", () => {
    const actionsPath = resolve(SRC_DIR, "features", "profile", "actions", "worker-profile-actions.ts")
    const content = readFileSync(actionsPath, "utf8")
    expect(content).not.toContain("createClient")
    expect(content).not.toContain("@/lib/supabase/client")
  })

  it("la ruta valida returnTo antes de entregarlo al cliente", () => {
    const pagePath = resolve(SRC_DIR, "app", "(dashboard)", "profile", "mi-informacion-laboral", "page.tsx")
    const content = readFileSync(pagePath, "utf8")
    expect(content).toContain("isSafeInternalReturnPath")
  })

  it("ningún componente usa localStorage, sessionStorage ni IndexedDB", () => {
    const dir = resolve(SRC_DIR, "features", "profile", "components", "worker")
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".tsx")) {
        const content = readFileSync(resolve(dir, entry), "utf8")
        expect(content).not.toContain("localStorage")
        expect(content).not.toContain("sessionStorage")
      }
    }
  })
})
