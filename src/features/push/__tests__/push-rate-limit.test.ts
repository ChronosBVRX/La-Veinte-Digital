import { describe, expect, it } from "vitest"
import { fixedWindow } from "../services/push-rate-limit"

describe("fixedWindow", () => {
  it("allows up to limit requests and then blocks within the window", () => {
    const store: Record<string, { count: number; resetAt: number }> = {}
    const now = 1_000_000
    for (let i = 0; i < 3; i++) {
      const r = fixedWindow(store, "a", 3, 60, now + i)
      expect(r.allowed).toBe(true)
    }
    const blocked = fixedWindow(store, "a", 3, 60, now + 2)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("resets after the window rolls over", () => {
    const store: Record<string, { count: number; resetAt: number }> = {}
    fixedWindow(store, "a", 1, 60, 0)
    expect(fixedWindow(store, "a", 1, 60, 0).allowed).toBe(false)
    // Next window (60s later) allows again.
    expect(fixedWindow(store, "a", 1, 60, 61).allowed).toBe(true)
  })

  it("scopes buckets independently", () => {
    const store: Record<string, { count: number; resetAt: number }> = {}
    fixedWindow(store, "a", 1, 60, 0)
    expect(fixedWindow(store, "b", 1, 60, 0).allowed).toBe(true)
  })
})
