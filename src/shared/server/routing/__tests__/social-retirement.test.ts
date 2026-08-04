import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const ROOT = process.cwd()

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/

function hasSourceFiles(directory: string): boolean {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return false
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry)
    let stats
    try {
      stats = statSync(fullPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      if (hasSourceFiles(fullPath)) return true
    } else if (SOURCE_FILE.test(entry)) {
      return true
    }
  }

  return false
}

function moduleIsActive(root: string, relativePath: string): boolean {
  return hasSourceFiles(path.resolve(root, relativePath))
}

describe("active module detection", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeTemp(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "module-detection-"))
    tempDirs.push(dir)
    return dir
  }

  it("treats an empty directory as inactive", () => {
    expect(hasSourceFiles(makeTemp())).toBe(false)
  })

  it("treats a directory with only empty subdirectories as inactive", () => {
    const dir = makeTemp()
    mkdirSync(path.join(dir, "components", "hooks"), { recursive: true })
    expect(hasSourceFiles(dir)).toBe(false)
  })

  it("treats a directory with ignored-only metadata files as inactive", () => {
    const dir = makeTemp()
    writeFileSync(path.join(dir, ".gitkeep"), "")
    expect(hasSourceFiles(dir)).toBe(false)
  })

  it("treats a directory with a real page component as active", () => {
    const dir = makeTemp()
    writeFileSync(path.join(dir, "page.tsx"), "export default function Page() {}\n")
    expect(hasSourceFiles(dir)).toBe(true)
  })

  it("treats a missing path as inactive", () => {
    expect(hasSourceFiles(path.join(makeTemp(), "missing"))).toBe(false)
  })
})

describe("social module retirement", () => {
  it.each([
    "src/app/(dashboard)/chat",
    "src/app/(dashboard)/foro",
    "src/features/chat",
    "src/features/foro",
  ])("retires %s (no active source files)", (relativePath) => {
    expect(moduleIsActive(ROOT, relativePath)).toBe(false)
  })

  it.each([
    "src/shared/components/layout/Sidebar.tsx",
    "src/shared/components/layout/BottomNav.tsx",
    "src/app/(auth)/callback/route.ts",
  ])("contains no retired route in %s", (relativePath) => {
    const source = readFileSync(path.resolve(ROOT, relativePath), "utf8")
    expect(source).not.toMatch(/["']\/(?:chat|foro)(?:\/|["'])/)
  })

  it("keeps the AI assistant module active", () => {
    expect(moduleIsActive(ROOT, "src/app/(dashboard)/asistente")).toBe(true)
    expect(moduleIsActive(ROOT, "src/features/asistente")).toBe(true)
    expect(moduleIsActive(ROOT, "src/app/api/consulta")).toBe(true)
  })

  it("keeps the AI assistant entry point and API route", () => {
    expect(moduleIsActive(ROOT, "src/app/(dashboard)/asistente")).toBe(true)
    expect(statSync(path.resolve(ROOT, "src/app/api/consulta/route.ts")).isFile()).toBe(true)
  })

  it("uses the required five-item mobile navigation order", () => {
    const source = readFileSync(
      path.resolve(ROOT, "src/shared/components/layout/BottomNav.tsx"),
      "utf8",
    )
    const hrefs = ["/", "/tarjeton", "/calculadoras", "/asistente", "/profile"]
    const positions = hrefs.map((href) => source.indexOf(`href: "${href}"`))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})