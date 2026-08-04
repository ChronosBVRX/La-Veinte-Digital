import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server"

const authMocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(async () => ({
    data: { user: null as { id: string } | null },
    error: null as Error | null,
  })),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: authMocks.createServerClient,
}))

import { config, proxy } from "@/proxy"

type CookieBridge = {
  cookies: {
    setAll: (
      cookies: Array<{
        name: string
        value: string
        options: Record<string, unknown>
      }>,
      headers: Record<string, string>,
    ) => void
  }
}

beforeEach(() => {
  authMocks.createServerClient.mockReset()
  authMocks.getUser.mockReset()
  authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  authMocks.createServerClient.mockImplementation(
    (_url: string, _key: string, options: CookieBridge) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll(
            [
              {
                name: "sb-session",
                value: "refreshed",
                options: {
                  httpOnly: true,
                  maxAge: 60,
                  path: "/",
                  priority: "high",
                  sameSite: "lax",
                  secure: true,
                },
              },
            ],
            {
              "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
              Pragma: "no-cache",
            },
          )
          return authMocks.getUser()
        },
      },
    }),
  )
})

describe("proxy matcher", () => {
  it.each([
    "/api",
    "/api/health",
    "/api/unknown.json",
    "/api/unknown.png",
    "/api/nested/file.svg",
    "/",
    "/calculadoras",
    "/protected.json",
    "/login",
    "/health",
  ])("covers %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url, nextConfig: {} })).toBe(true)
  })

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png&w=64&q=75",
    "/favicon.ico",
    "/logo.png",
  ])("skips framework/static asset %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url, nextConfig: {} })).toBe(false)
  })
})

describe("proxy decisions", () => {
  it("bypasses Supabase for exact public APIs", async () => {
    for (const pathname of ["/api/health", "/api/calendario"]) {
      const response = await proxy(new NextRequest(`https://example.com${pathname}`))
      expect(response.headers.get("x-middleware-next")).toBe("1")
    }

    expect(authMocks.createServerClient).not.toHaveBeenCalled()
  })

  it("lets the public health alias reach its rewrite without Supabase", async () => {
    const response = await proxy(new NextRequest("https://example.com/health"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(authMocks.createServerClient).not.toHaveBeenCalled()
  })

  it("returns a no-store 404 for an unknown API without calling Supabase", async () => {
    const response = await proxy(new NextRequest("https://example.com/api/unknown.png"))

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ error: "No encontrado", code: "not_found" })
    expect(authMocks.createServerClient).not.toHaveBeenCalled()
  })

  it("returns a JSON 401 for an anonymous private API and preserves cookie options", async () => {
    const response = await proxy(new NextRequest("https://example.com/api/consulta"))
    const setCookie = response.headers.get("set-cookie")?.toLowerCase() ?? ""

    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(response.headers.get("Pragma")).toBe("no-cache")
    expect(setCookie).toContain("sb-session=refreshed")
    expect(setCookie).toContain("max-age=60")
    expect(setCookie).toContain("path=/")
    expect(setCookie).toContain("secure")
    expect(setCookie).toContain("httponly")
    expect(setCookie).toContain("samesite=lax")
    expect(setCookie).toContain("priority=high")
    await expect(response.json()).resolves.toEqual({ error: "No autenticado", code: "unauthorized" })
  })

  it("redirects an anonymous protected page and preserves refreshed cookies", async () => {
    const response = await proxy(new NextRequest("https://example.com/calculadoras"))

    expect(response.status).toBe(307)
    expect(getRedirectUrl(response)).toBe("https://example.com/login")
    expect(response.headers.get("set-cookie")).toContain("sb-session=refreshed")
  })

  it("treats public page paths as exact", async () => {
    const publicResponse = await proxy(new NextRequest("https://example.com/login"))
    expect(publicResponse.headers.get("x-middleware-next")).toBe("1")
    expect(authMocks.createServerClient).not.toHaveBeenCalled()

    const prefixedResponse = await proxy(new NextRequest("https://example.com/login/help"))
    expect(prefixedResponse.status).toBe(307)
    expect(authMocks.createServerClient).toHaveBeenCalledOnce()
  })

  it("allows an authenticated private API to continue", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    const response = await proxy(new NextRequest("https://example.com/api/tarjeton/confirm"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("set-cookie")).toContain("sb-session=refreshed")
  })
})
