import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  it("returns the static version without caching", async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ status: "ok", version: "0.002" })
  })

  it("maps the friendly Vercel health path to the dedicated endpoint", () => {
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as { rewrites?: Array<{ source: string; destination: string }> }

    expect(vercelConfig.rewrites).toContainEqual({
      source: "/health",
      destination: "/api/health",
    })
  })
})
