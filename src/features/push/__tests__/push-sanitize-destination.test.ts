import { describe, it, expect } from "vitest"
import { sanitizeDestination } from "../services/push-admin"

describe("sanitizeDestination", () => {
  it("returns undefined for empty/null input", () => {
    expect(sanitizeDestination(null)).toBeUndefined()
    expect(sanitizeDestination(undefined)).toBeUndefined()
    expect(sanitizeDestination("")).toBeUndefined()
    expect(sanitizeDestination("   ")).toBeUndefined()
  })

  it("resolves valid relative paths against canonical origin", () => {
    expect(sanitizeDestination("/avisos")).toBe("https://la20.com.mx/avisos")
    expect(sanitizeDestination("/vacaciones?tab=rol")).toBe("https://la20.com.mx/vacaciones?tab=rol")
    expect(sanitizeDestination("/escritos#seccion")).toBe("https://la20.com.mx/escritos#seccion")
  })

  it("accepts exact canonical origin and paths", () => {
    expect(sanitizeDestination("https://la20.com.mx/avisos/123"))
      .toBe("https://la20.com.mx/avisos/123")
  })

  it("rejects domain prefix bypasses (subdomains of attacker)", () => {
    expect(sanitizeDestination("https://la20.com.mx.attacker.com/evil")).toBeUndefined()
    expect(sanitizeDestination("https://la20.com.mx-malicious.com")).toBeUndefined()
  })

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeDestination("//attacker.com")).toBeUndefined()
    expect(sanitizeDestination("//attacker.com/avisos")).toBeUndefined()
  })

  it("rejects backslash bypasses", () => {
    expect(sanitizeDestination("/\\attacker.com")).toBeUndefined()
    expect(sanitizeDestination("\\attacker.com")).toBeUndefined()
  })

  it("rejects foreign protocols", () => {
    expect(sanitizeDestination("http://la20.com.mx/avisos")).toBeUndefined()
    expect(sanitizeDestination("javascript:alert(1)")).toBeUndefined()
    expect(sanitizeDestination("data:text/html,evil")).toBeUndefined()
  })

  it("rejects URLs with embedded credentials", () => {
    expect(sanitizeDestination("https://user:pass@la20.com.mx/avisos")).toBeUndefined()
  })
})
