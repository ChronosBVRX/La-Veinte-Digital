/**
 * Best-effort, in-memory fixed-window rate limiter for serverless handlers.
 *
 * Serverless instances do not guarantee a shared persistent store, so this is a defense-in-depth
 * throttle, NOT a hard global quota. It is cheap to add and prevents a single caller from trivially
 * hammering the admin push endpoint. Kept pure enough to unit-test.
 */
export interface RateLimiterResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

interface Window {
  count: number
  resetAt: number
}

function windowKey(
  key: string,
  windowStartSeconds: number,
  periodSeconds: number,
): number {
  return Math.floor(windowStartSeconds / periodSeconds)
}

/**
 * Fixed-window limiter. Returns an [allow, retryAfter] decision.
 * @param store mutable record keyed by `bucket` (ip + scope). The bucket is cleared when the window rolls.
 */
export function fixedWindow(
  store: Record<string, Window>,
  bucket: string,
  limit: number,
  windowSeconds: number,
  nowSeconds: number,
): RateLimiterResult {
  const w = windowKey(bucket, nowSeconds, windowSeconds)
  const key = `${bucket}:${w}`
  const existing = store[key]
  const resetAt = (w + 1) * windowSeconds

  if (!existing || nowSeconds >= existing.resetAt) {
    store[key] = { count: 1, resetAt }
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, existing.resetAt - nowSeconds) }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 }
}
