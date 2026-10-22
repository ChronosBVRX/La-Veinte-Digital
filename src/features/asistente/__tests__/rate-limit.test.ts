import { describe, it, expect, beforeEach } from "vitest"
import {
  checkAssistantRateLimit,
  userAssistantRateLimits,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../lib/rate-limit"

describe("checkAssistantRateLimit", () => {
  beforeEach(() => {
    userAssistantRateLimits.clear()
  })

  it("permite solicitudes dentro del límite permitido", () => {
    const res = checkAssistantRateLimit("user-test-1")
    expect(res.allowed).toBe(true)
    expect(res.retryAfter).toBeUndefined()
  })

  it("bloquea cuando se excede RATE_LIMIT_MAX_REQUESTS", () => {
    const now = 1000000
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const ok = checkAssistantRateLimit("user-test-burst", now)
      expect(ok.allowed).toBe(true)
    }

    const blocked = checkAssistantRateLimit("user-test-burst", now)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBe(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
  })

  it("resetea el conteo después de que transcurre la ventana de tiempo", () => {
    const now = 1000000
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkAssistantRateLimit("user-test-reset", now)
    }

    // Excedido en 'now'
    expect(checkAssistantRateLimit("user-test-reset", now).allowed).toBe(false)

    // Permitido después de la ventana
    const after = now + RATE_LIMIT_WINDOW_MS + 1000
    expect(checkAssistantRateLimit("user-test-reset", after).allowed).toBe(true)
  })
})
