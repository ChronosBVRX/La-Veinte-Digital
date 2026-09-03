import { describe, it, expect } from "vitest"
import { checkRateLimit, type RateLimitRecord, MAX_RATE_LIMIT_ENTRIES } from "@/features/escritos/server/rate-limit"

describe("Rate Limiting en Memoria Acotado y Determinista (checkRateLimit)", () => {
  it("garantiza que el tamaño del Map nunca supera MAX_RATE_LIMIT_ENTRIES (1000) con inserción masiva", () => {
    const testStore = new Map<string, RateLimitRecord>()
    const baseTime = 1000000

    // Insertar 1,500 usuarios diferentes dentro de la misma ventana de tiempo
    for (let i = 0; i < 1500; i++) {
      const res = checkRateLimit(`user_${i}`, baseTime + i * 10, testStore, MAX_RATE_LIMIT_ENTRIES, 10, 60000)
      expect(res.allowed).toBe(true)
      expect(testStore.size).toBeLessThanOrEqual(MAX_RATE_LIMIT_ENTRIES)
    }

    expect(testStore.size).toBe(MAX_RATE_LIMIT_ENTRIES)
  })

  it("desaloja primero las entradas expiradas antes de expulsar entradas vigentes", () => {
    const testStore = new Map<string, RateLimitRecord>()
    const now = 500000

    // Insertar 100 entradas que expiraron
    for (let i = 0; i < 100; i++) {
      testStore.set(`expired_${i}`, { count: 1, resetAt: now - 100 })
    }

    // Insertar 1 nueva entrada
    checkRateLimit("new_user", now, testStore, 1000, 10, 60000)

    // Las 100 expiradas fueron purgadas
    for (let i = 0; i < 100; i++) {
      expect(testStore.has(`expired_${i}`)).toBe(false)
    }
    expect(testStore.has("new_user")).toBe(true)
    expect(testStore.size).toBe(1)
  })

  it("bloquea solicitudes que exceden maxRequests dentro de la misma ventana y devuelve retryAfter", () => {
    const testStore = new Map<string, RateLimitRecord>()
    const now = 2000000

    // Enviar 10 solicitudes válidas
    for (let i = 0; i < 10; i++) {
      const res = checkRateLimit("active_user", now, testStore, 1000, 10, 60000)
      expect(res.allowed).toBe(true)
    }

    // La 11ª solicitud debe ser bloqueada con retryAfter
    const blocked = checkRateLimit("active_user", now, testStore, 1000, 10, 60000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBe(60)
  })
})
