import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  it("returns the static version without caching", async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toMatchObject({ status: "ok", version: "0.002" })
  })
})
