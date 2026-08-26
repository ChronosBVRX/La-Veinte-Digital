/**
 * GpuResourceManager — mutex de VRAM entre LLM (Ollama/Qwen) y TTS (Qwen).
 *
 * Regla fundamental: LLM_ACTIVE && TTS_ACTIVE = false por defecto en 12 GB.
 * Estados: IDLE | LLM_ACTIVE | TTS_ACTIVE
 *
 * Adquisición por polling (granularidad 50 ms): la conmutación de modelos en
 * GPU tarda segundos, así que un poll corto es más simple y sin zombis.
 */

export type GpuOwner = "llm" | "tts";
export type GpuState = "IDLE" | "LLM_ACTIVE" | "TTS_ACTIVE";

class GpuResourceManager {
  private owner: GpuOwner | null = null;
  state: GpuState = "IDLE";
  lastError: string | null = null;
  changedAt = Date.now();

  get current(): GpuOwner | null { return this.owner; }

  status() {
    return {
      state: this.state,
      owner: this.owner,
      lastError: this.lastError,
      changedAt: new Date(this.changedAt).toISOString(),
    };
  }

  /** Adquiere la GPU exclusivamente. Re-entrante para el mismo dueño. */
  async acquire(target: GpuOwner, timeoutMs = 600_000): Promise<void> {
    if (this.owner === target) return;
    const start = Date.now();
    while (this.owner !== null && this.owner !== target) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`GPU_TIMEOUT: ${this.owner} no liberó en ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, 50));
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
  }

  fail(owner: GpuOwner, err: string): void {
    if (this.owner !== owner) return;
    this.lastError = err;
    // el error lo maneja el llamador; la GPU se libera para no bloquear al otro
    this.release(owner);
  }
}

const globalKey = Symbol.for("lvd.gpu-manager");
type G = { mgr?: GpuResourceManager };
const g = globalThis as unknown as G;
if (!g.mgr) g.mgr = new GpuResourceManager();
export function getGpuManager(): GpuResourceManager { return g.mgr!; }

/** withGpu(owner, fn): adquiere, ejecuta, libera siempre. */
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
