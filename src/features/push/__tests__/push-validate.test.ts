import { describe, expect, it } from "vitest"
import { validatePushSend, MAX_USER_IDS } from "../services/push-validate"

describe("validatePushSend", () => {
  it("rejects non-object bodies", () => {
    for (const b of [null, undefined, "x", 42, [], ["a"]]) {
      const r = validatePushSend(b)
      expect(r.ok).toBe(false)
    }
  })

  it("accepts a minimal valid body (broadcast)", () => {
    const r = validatePushSend({ title: "Aviso", message: "Hola" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.type).toBe("GENERAL")
      expect(r.value.userIds).toBeUndefined()
    }
  })

  it("rejects missing/blank or oversized title and message", () => {
    expect(validatePushSend({ message: "x" }).ok).toBe(false)
    expect(validatePushSend({ title: "x", message: "" }).ok).toBe(false)
    expect(validatePushSend({ title: "a".repeat(201), message: "x" }).ok).toBe(false)
    expect(validatePushSend({ title: "x", message: "a".repeat(501) }).ok).toBe(false)
  })

  it("rejects invalid category", () => {
    expect(validatePushSend({ title: "t", message: "m", category: "SPAM" }).ok).toBe(false)
  })

  it("rejects a non-internal or oversized destination", () => {
    expect(validatePushSend({ title: "t", message: "m", destination: "https://evil.example.com/x" }).ok).toBe(false)
    expect(validatePushSend({ title: "t", message: "m", destination: "javascript:alert(1)" }).ok).toBe(false)
    expect(validatePushSend({ title: "t", message: "m", destination: "a".repeat(2049) }).ok).toBe(false)
  })

  it("accepts an internal or relative destination", () => {
    const abs = validatePushSend({ title: "t", message: "m", destination: "https://la-veinte-digital.vercel.app/documentos-personales" })
    expect(abs.ok).toBe(true)
    const rel = validatePushSend({ title: "t", message: "m", destination: "/documentos" })
    expect(rel.ok).toBe(true)
    if (rel.ok) expect(rel.value.destination).toContain("https://la-veinte-digital.vercel.app")
  })

  it("rejects userIds that are not UUIDs or not an array", () => {
    expect(validatePushSend({ title: "t", message: "m", userIds: "abc" }).ok).toBe(false)
    expect(validatePushSend({ title: "t", message: "m", userIds: ["not-a-uuid"] }).ok).toBe(false)
    expect(validatePushSend({ title: "t", message: "m", userIds: [] }).ok).toBe(false)
  })

  it("dedupes and caps userIds", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const r = validatePushSend({ title: "t", message: "m", userIds: [id, id, "22222222-2222-4222-8222-222222222222"] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.userIds).toHaveLength(2)

    const many = Array.from({ length: MAX_USER_IDS + 1 }, (_, i) =>
      `${String(i + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
    )
    expect(validatePushSend({ title: "t", message: "m", userIds: many }).ok).toBe(false)
  })
})
