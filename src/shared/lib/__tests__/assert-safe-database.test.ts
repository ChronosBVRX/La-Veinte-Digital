import { describe, it, expect, afterEach } from "vitest"
import { assertSafeDatabase } from "../../../../e2e/utils/assert-safe-database"

describe("assertSafeDatabase Guardrail", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalBaseUrl = process.env.E2E_BASE_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.E2E_BASE_URL = originalBaseUrl
  })

  it("rejects execution when target URL is production Supabase instance", () => {
    expect(() => {
      assertSafeDatabase("https://ragktminwduiggvaoeix.supabase.co")
    }).toThrowError(/Refusing to execute mutating\/destructive E2E tests against production/)
  })

  it("rejects execution when target URL contains production domains", () => {
    expect(() => {
      assertSafeDatabase("https://la20.com.mx")
    }).toThrowError(/Refusing to execute mutating\/destructive E2E tests against production/)

    expect(() => {
      assertSafeDatabase("https://laveinte.com")
    }).toThrowError(/Refusing to execute mutating\/destructive E2E tests against production/)

    expect(() => {
      assertSafeDatabase("https://laveinte.mx")
    }).toThrowError(/Refusing to execute mutating\/destructive E2E tests against production/)
  })

  it("rejects execution when environment variable points to production and no target is passed", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ragktminwduiggvaoeix.supabase.co"
    expect(() => {
      assertSafeDatabase()
    }).toThrowError(/Refusing to execute mutating\/destructive E2E tests against production/)
  })

  it("allows execution when URL is local Supabase or localhost", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    process.env.E2E_BASE_URL = "http://localhost:3000"

    expect(() => {
      assertSafeDatabase("http://127.0.0.1:54321")
    }).not.toThrow()

    expect(() => {
      assertSafeDatabase("http://localhost:3000")
    }).not.toThrow()

    expect(() => {
      assertSafeDatabase()
    }).not.toThrow()
  })
})
