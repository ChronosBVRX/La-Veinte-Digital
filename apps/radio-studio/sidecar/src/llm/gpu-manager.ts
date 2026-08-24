/**
 * GpuResourceManager — mutex de VRAM entre LLM (Ollama/Qwen) y TTS (Chatterbox).
 *
 * Regla fundamental: LLM_ACTIVE && TTS_ACTIVE = false por defecto en 12 GB.
 * Estados: IDLE | LLM_ACTIVE | TTS_ACTIVE | ERROR
 */

export type GpuOwner = "llm" | "tts";
export type GpuState = "IDLE" | "LLM_ACTIVE" | "TTS_ACTIVE" | "ERROR";

class GpuResourceManager {
  private owner: GpuOwner | null = null;
  private queue: Array<() => void> = [];
  state: GpuState = "IDLE";
  lastError: string | null = null;
  changedAt = Date.now();

  get current(): GpuOwner | null { return this.owner; }

  status() {
    return {
      state: this.state,
      owner: this.owner,
      waiting: this.queue.length,
      lastError: this.lastError,
      changedAt: new Date(this.changedAt).toISOString(),
    };
  }

  /** Adquiere la GPU exclusivamente. Si otro dueño la tiene, espera su turno. */
  async acquire(target: GpuOwner, timeoutMs = 600_000): Promise<void> {
    if (this.owner === target) return; // re-entrante para el mismo dueño
    const start = Date.now();
    while (this.owner !== null && this.owner !== target) {
      if (Date.now() - start > timeoutMs) throw new Error(`GPU_TIMEOUT: ${this.owner} no liberó en ${timeoutMs}ms`);
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.owner = target;
    this.state = target === "llm" ? "LLM_ACTIVE" : "TTS_ACTIVE";
    this.changedAt = Date.now();
  }

  release(owner: GpuOwner): void {
    if (this.owner !== owner) return;
    this.owner = null;
    this.state = "IDLE";
    this.changedAt = Date.now();
    const next = this.queue.shift();
    next?.();
  }

  fail(owner: GpuOwner, err: string): void {
    if (this.owner !== owner) return;
    this.lastError = err;
    // NO quedamos en ERROR permanente: el error lo maneja el llamador; liberamos.
    this.release(owner);
  }
}

const globalKey = Symbol.for("lvd.gpu-manager");
type G = { mgr?: GpuResourceManager };
const g = globalThis as unknown as G;
if (!g.mgr) g.mgr = new GpuResourceManager();
export function getGpuManager(): GpuResourceManager { return g.mgr!; }

/**
 * withGpu("llm", fn): adquiere, ejecuta, libera. En esencia:
 *   await withGpu("tts", async () => { ...generar voces... })
 */
export async function withGpu<T>(owner: GpuOwner, fn: () => Promise<T>): Promise<T> {
  const mgr = getGpuManager();
  await mgr.acquire(owner);
  try {
    return await fn();
  } catch (e) {
    mgr.fail(owner, e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    mgr.release(owner);
  }
}
