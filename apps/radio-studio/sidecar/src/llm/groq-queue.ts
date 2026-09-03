/**
 * groq-queue.ts — cola FIFO central para todas las llamadas a Groq.
 *
 * Garantías:
 *  - Secuencial: una sola petición activa a la vez.
 *  - Rate-limit tracking por ventana de 60 s (TPM_LIMIT = 8_000).
 *  - Lee headers reales: x-ratelimit-remaining-tokens, x-ratelimit-remaining-requests, retry-after.
 *  - 429 TPM → espera retry-after + jitter; NO hace fallback inmediato (máx 3 reintentos).
 *  - 429 RPD (agotamiento diario) → marca dailyExhausted; el factory puede hacer fallback.
 *  - Cancela peticiones en curso via AbortController.
 */

export interface GroqUsageSnapshot {
  tokensThisRun: number;
  callsThisRun: number;
  estimatedDailyUsed: number;
  rateLimitWaitMs: number;
  fallbackUsed: boolean;
  lastCallAt: string | null;
}

interface TokenWindow {
  tokens: number;
  startedAt: number;
}

const TPM_LIMIT = 8_000;
const WINDOW_MS = 60_000;
const MAX_RETRIES = 3;

class GroqRateLimitQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = false;
  private window: TokenWindow = { tokens: 0, startedAt: Date.now() };
  private dailyExhausted = false;
  private currentAbort: AbortController | null = null;

  // Snapshot for observability
  private snap: GroqUsageSnapshot = {
    tokensThisRun: 0,
    callsThisRun: 0,
    estimatedDailyUsed: 0,
    rateLimitWaitMs: 0,
    fallbackUsed: false,
    lastCallAt: null,
  };

  get isDailyExhausted(): boolean {
    return this.dailyExhausted;
  }

  get usage(): GroqUsageSnapshot {
    return { ...this.snap };
  }

  resetRunMetrics(): void {
    this.snap = {
      ...this.snap,
      tokensThisRun: 0,
      callsThisRun: 0,
      rateLimitWaitMs: 0,
      fallbackUsed: false,
    };
  }

  cancel(): void {
    this.currentAbort?.abort();
    this.currentAbort = null;
  }

  /** Encola una función que ejecuta una llamada HTTP a Groq y la retorna. */
  async enqueue<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRateLimit(fn);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) await next();
    }
    this.running = false;
  }

  private async executeWithRateLimit<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Verificar ventana de tokens
      const now = Date.now();
      if (now - this.window.startedAt >= WINDOW_MS) {
        this.window = { tokens: 0, startedAt: now };
      }

      this.currentAbort = new AbortController();
      const signal = this.currentAbort.signal;

      try {
        const result = await fn(signal);
        this.snap.lastCallAt = new Date().toISOString();
        return result;
      } catch (e) {
        if (signal.aborted) {
          throw new Error("GROQ_CANCELLED: petición cancelada por el usuario");
        }

        const err = e as GroqRateLimitError;
        if (err.status === 429) {
          const isDaily = err.code === "rate_limit_exceeded_daily" ||
            (err.message ?? "").toLowerCase().includes("daily");

          if (isDaily) {
            this.dailyExhausted = true;
            this.snap.fallbackUsed = true;
            throw new Error("GROQ_DAILY_EXHAUSTED: cuota diaria agotada — usando fallback local");
          }

          if (attempt >= MAX_RETRIES) {
            throw new Error(`GROQ_RATE_LIMIT: se superó el límite tras ${MAX_RETRIES} reintentos`);
          }

          // TPM 429 → esperar retry-after + jitter
          const baseMs = process.env.GROQ_BACKOFF_BASE_MS ? parseInt(process.env.GROQ_BACKOFF_BASE_MS, 10) : 2_000;
          const retryAfterSec = err.retryAfter ?? 10;
          const jitterMs = baseMs > 50 ? Math.random() * 2_000 : 0;
          const waitMs = (process.env.GROQ_BACKOFF_BASE_MS ? Math.min(retryAfterSec * 1_000, 20) : retryAfterSec * 1_000) + jitterMs;
          this.snap.rateLimitWaitMs += waitMs;

          if (baseMs > 50) {
            console.warn(`[groq-queue] 429 TPM — esperando ${Math.round(waitMs / 1_000)}s (intento ${attempt + 1}/${MAX_RETRIES})`);
          }
          await sleep(waitMs);
          continue;
        }

        // Error de red / timeout → reintento con backoff
        if (attempt < MAX_RETRIES && isTransientError(e)) {
          const baseMs = process.env.GROQ_BACKOFF_BASE_MS ? parseInt(process.env.GROQ_BACKOFF_BASE_MS, 10) : 2_000;
          const backoff = baseMs * (attempt + 1) + (baseMs > 50 ? Math.random() * 1_000 : 0);
          await sleep(backoff);
          continue;
        }

        throw e;
      } finally {
        this.currentAbort = null;
      }
    }
    throw new Error("GROQ_MAX_RETRIES: se agotaron los reintentos");
  }

  /** Actualiza el tracking de tokens desde headers de respuesta. */
  recordUsage(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): void {
    const total = usage.total_tokens ?? 0;
    this.window.tokens += total;
    this.snap.tokensThisRun += total;
    this.snap.estimatedDailyUsed += total;
    this.snap.callsThisRun++;
  }

  /** Actualiza el estado de la ventana desde headers HTTP de respuesta. */
  applyRateLimitHeaders(headers: Record<string, string | undefined>): void {
    const remaining = headers["x-ratelimit-remaining-tokens"];
    if (remaining !== undefined) {
      const rem = parseInt(remaining, 10);
      if (!isNaN(rem)) {
        // Sincronizar ventana con el valor real del servidor
        this.window.tokens = Math.max(this.window.tokens, TPM_LIMIT - rem);
      }
    }
    // Si el remaining es 0 y aún no estamos en cooldown, podríamos proactivamente esperar
    // pero dejamos el manejo reactivo al 429.
  }
}

export interface GroqRateLimitError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
}

function isTransientError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /ECONNREFUSED|ENOTFOUND|timeout|aborted|network/i.test(e.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Singleton global de la cola
let _queue: GroqRateLimitQueue | null = null;

export function getGroqQueue(): GroqRateLimitQueue {
  if (!_queue) _queue = new GroqRateLimitQueue();
  return _queue;
}

/** Solo para tests: permite resetear el singleton */
export function _resetQueueForTests(): void {
  _queue = null;
}
