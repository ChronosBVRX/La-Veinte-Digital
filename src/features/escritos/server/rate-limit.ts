export const MAX_RATE_LIMIT_ENTRIES = 1000
export const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minuto
export const RATE_LIMIT_MAX_REQUESTS = 10 // máx 10 por minuto por usuario

export interface RateLimitRecord {
  count: number
  resetAt: number
}

export const userRateLimits = new Map<string, RateLimitRecord>()

export function checkRateLimit(
  userId: string,
  now = Date.now(),
  store = userRateLimits,
  maxEntries = MAX_RATE_LIMIT_ENTRIES,
  maxRequests = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; retryAfter?: number } {
  // 1. Limpieza de entradas expiradas
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) {
      store.delete(k)
    }
  }

  const existing = store.get(userId)
  if (existing) {
    if (existing.resetAt > now) {
      if (existing.count >= maxRequests) {
        const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
      }
      existing.count++
      return { allowed: true }
    } else {
      existing.count = 1
      existing.resetAt = now + windowMs
      return { allowed: true }
    }
  }

  // 2. Si se alcanzó el límite estricto de capacidad en memoria, desalojar las entradas con resetAt más cercano
  while (store.size >= maxEntries) {
    let earliestKey: string | null = null
    let earliestReset = Infinity
    for (const [k, v] of store.entries()) {
      if (v.resetAt < earliestReset) {
        earliestReset = v.resetAt
        earliestKey = k
      }
    }
    if (earliestKey) {
      store.delete(earliestKey)
    } else {
      break
    }
  }

  store.set(userId, {
    count: 1,
    resetAt: now + windowMs,
  })
  return { allowed: true }
}
