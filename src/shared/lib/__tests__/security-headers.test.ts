import { describe, it, expect } from "vitest"
import nextConfig from "../../../../next.config"

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"

function parseCsp(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>()
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    directives.set(tokens[0], tokens.slice(1))
  }
  return directives
}

async function getCsp(): Promise<string> {
  const headerConfigs = await nextConfig.headers!()
  const rootConfig = headerConfigs.find((c) => c.source === "/(.*)")
  const csp = rootConfig!.headers.find((h) => h.key === "Content-Security-Policy")!.value
  return csp
}

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
    expect(headersMap.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains")

    const csp = headersMap.get("Content-Security-Policy")
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
  })
})

describe("CSP permite Cloudflare Turnstile (regresión P0)", () => {
  it("permite el script de Turnstile en script-src", async () => {
    const directives = parseCsp(await getCsp())
    expect(directives.get("script-src")).toContain(TURNSTILE_ORIGIN)
  })

  it("permite el iframe del reto en frame-src", async () => {
    const directives = parseCsp(await getCsp())
    expect(directives.get("frame-src")).toContain(TURNSTILE_ORIGIN)
  })

  it("permite la verificación en connect-src", async () => {
    const directives = parseCsp(await getCsp())
    expect(directives.get("connect-src")).toContain(TURNSTILE_ORIGIN)
  })

  it("permite WebAssembly ('wasm-unsafe-eval') para el OCR de Tesseract sin habilitar unsafe-eval", async () => {
    const csp = await getCsp()
    const directives = parseCsp(csp)
    expect(directives.get("script-src")).toContain("'wasm-unsafe-eval'")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it("conserva los orígenes existentes sin wildcards", async () => {
    const csp = await getCsp()
    const directives = parseCsp(csp)

    expect(directives.get("frame-src")).toContain("https://www.facebook.com")
    expect(directives.get("connect-src")!.some((o) => o.includes("supabase.co"))).toBe(true)
    expect(directives.get("connect-src")).toContain("https://cdn.jsdelivr.net")
    expect(directives.get("connect-src")).toContain("https://tessdata.projectnaptha.com")

    expect(csp).not.toContain("*")
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
