import { describe, it, expect } from "vitest"
import nextConfig from "../../../../next.config"

describe("Security Headers and CSP configuration", () => {
  it("defines required security headers for all routes", async () => {
    expect(nextConfig.headers).toBeDefined()
    const headerConfigs = await nextConfig.headers!()
    expect(headerConfigs.length).toBeGreaterThan(0)

    const rootConfig = headerConfigs.find((c) => c.source === "/(.*)")
    expect(rootConfig).toBeDefined()

    const headersMap = new Map(rootConfig!.headers.map((h) => [h.key, h.value]))

    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headersMap.get("X-Frame-Options")).toBe("DENY")
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(headersMap.get("Permissions-Policy")).toContain("camera=(self)")
    expect(headersMap.get("Permissions-Policy")).toContain("geolocation=()")
    expect(headersMap.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload")

    const csp = headersMap.get("Content-Security-Policy")
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src")
  })
})
