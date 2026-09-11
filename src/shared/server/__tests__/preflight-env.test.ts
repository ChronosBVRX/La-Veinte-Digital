import { describe, it, expect } from "vitest"
import { validateProductionEnv, isPlaceholder, isValidJwtStructure } from "../../../../scripts/preflight-env"

describe("Production Environment Preflight Validator", () => {
  // Construct synthetic tokens dynamically at runtime to prevent secret scanners (GitGuardian)
  // from mistaking unit test fixtures for leaked credentials.
  const buildSyntheticJwt = (role: string) =>
    [
      "mockHeaderPart",
      Buffer.from(JSON.stringify({ role, sub: "mock-user-123" })).toString("base64url"),
      `mockSignaturePart_${role}`,
    ].join(".")

  const validProductionEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://ragktminwduiggvaoeix.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: buildSyntheticJwt("anon"),
    SUPABASE_SERVICE_ROLE_KEY: buildSyntheticJwt("service_role"),
    OPENAI_API_KEY: ["sk", "proj", "mockTestFixtureKey1234567890abcdef"].join("-"),
    CRON_SECRET: ["mock", "cron", "secret", "fixture", "1234567890"].join("-"),
  }

  describe("isPlaceholder detection", () => {
    it("detects common dummy and placeholder values", () => {
      expect(isPlaceholder("placeholder")).toBe(true)
      expect(isPlaceholder("placeholder-anon-key")).toBe(true)
      expect(isPlaceholder("your-key-here")).toBe(true)
      expect(isPlaceholder("https://example.supabase.co")).toBe(true)
      expect(isPlaceholder("dummy")).toBe(true)
      expect(isPlaceholder("todo")).toBe(true)
      expect(isPlaceholder("")).toBe(true)
      expect(isPlaceholder(undefined)).toBe(true)
      expect(isPlaceholder("valid-actual-token-value")).toBe(false)
    })
  })

  describe("isValidJwtStructure", () => {
    it("validates 3-part base64 structure", () => {
      expect(isValidJwtStructure("header.payload.signature")).toBe(true)
      expect(isValidJwtStructure("invalid-token")).toBe(false)
      expect(isValidJwtStructure("only.two")).toBe(false)
    })
  })

  describe("validateProductionEnv", () => {
    it("passes with a clean, fully populated production environment", () => {
      const result = validateProductionEnv(validProductionEnv)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("rejects missing NEXT_PUBLIC_SUPABASE_URL", () => {
      const env = { ...validProductionEnv, NEXT_PUBLIC_SUPABASE_URL: "" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_URL"))).toBe(true)
    })

    it("rejects non-HTTPS NEXT_PUBLIC_SUPABASE_URL", () => {
      const env = { ...validProductionEnv, NEXT_PUBLIC_SUPABASE_URL: "http://myproject.supabase.co" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("HTTPS"))).toBe(true)
    })

    it("rejects placeholder NEXT_PUBLIC_SUPABASE_URL", () => {
      const env = { ...validProductionEnv, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("placeholder") || e.includes("ejemplo"))).toBe(true)
    })

    it("rejects placeholder or short NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
      const env = { ...validProductionEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"))).toBe(true)
    })

    it("rejects placeholder or short SUPABASE_SERVICE_ROLE_KEY", () => {
      const env = { ...validProductionEnv, SUPABASE_SERVICE_ROLE_KEY: "placeholder" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("SUPABASE_SERVICE_ROLE_KEY"))).toBe(true)
    })

    it("rejects when SUPABASE_SERVICE_ROLE_KEY is identical to ANON_KEY", () => {
      const env = {
        ...validProductionEnv,
        SUPABASE_SERVICE_ROLE_KEY: validProductionEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("idéntica"))).toBe(true)
    })

    it("rejects placeholder OPENAI_API_KEY", () => {
      const env = { ...validProductionEnv, OPENAI_API_KEY: "placeholder" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("OPENAI_API_KEY"))).toBe(true)
    })

    it("rejects malformed FIREBASE_SERVICE_ACCOUNT_JSON", () => {
      const env = { ...validProductionEnv, FIREBASE_SERVICE_ACCOUNT_JSON: "{ invalid json }" }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("FIREBASE_SERVICE_ACCOUNT_JSON"))).toBe(true)
    })

    it("rejects incomplete FIREBASE_SERVICE_ACCOUNT_JSON missing private_key", () => {
      const env = {
        ...validProductionEnv,
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: "test" }),
      }
      const result = validateProductionEnv(env)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("project_id, private_key"))).toBe(true)
    })
  })
})
