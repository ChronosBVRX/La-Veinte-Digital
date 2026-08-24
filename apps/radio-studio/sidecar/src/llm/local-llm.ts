/**
 * LocalLLMService — capa única de acceso al LLM local (Ollama).
 * Toda interacción con Ollama pasa por aquí: health, ensureModel,
 * generateStructured (JSON Schema), generateText, unload, stats.
 *
 * Incluye: timeout por tarea, retries recuperables, circuit breaker,
 * cache semántica y run-log estructurado.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface LlmTaskProfile {
  temperature: number;
  topP?: number;
  timeoutMs: number;
  maxTokens?: number;
}

/** Perfiles configurables por tipo de tarea (no leyes absolutas). */
export const TASK_PROFILES: Record<string, LlmTaskProfile> = {
  analysis: { temperature: 0.2, timeoutMs: 300_000 },
  planning: { temperature: 0.32, timeoutMs: 300_000 },
  direction: { temperature: 0.55, timeoutMs: 420_000 },
  dialogue: { temperature: 0.72, timeoutMs: 600_000 },
  citation_audit: { temperature: 0.15, timeoutMs: 420_000 },
  qa: { temperature: 0.18, timeoutMs: 420_000 },
  repair: { temperature: 0.42, timeoutMs: 480_000 },
};

export interface LocalLlmConfig {
  provider: string;
  model: string;
  baseUrl: string;
  contextTokens: number;
  enabled: boolean;
  remoteEnabled: boolean;
}

export function loadLlmConfig(): LocalLlmConfig {
  return {
    provider: process.env.LOCAL_LLM_PROVIDER ?? "ollama",
    model: process.env.LOCAL_LLM_MODEL ?? "qwen3.5:9b",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    contextTokens: Number(process.env.LOCAL_LLM_CONTEXT ?? 16384),
    enabled: (process.env.LOCAL_LLM_ENABLED ?? "true") !== "false",
    remoteEnabled: (process.env.REMOTE_LLM_ENABLED ?? "false") === "true",
  };
}

interface CircuitState { open: boolean; openedAt: number; failures: number }
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;

export interface RunLogEntry {
  ts: string;
  task: string;
  model: string;
  status: "ok" | "error" | "schema_fail" | "circuit_open";
  durationMs: number;
  retries: number;
  promptEvalCount?: number;
  evalCount?: number;
  tokensPerSec?: number;
  inputChars: number;
  outputChars: number;
  cacheHit?: boolean;
  error?: string;
}

export class LocalLLMService {
  private cfg: LocalLlmConfig;
  private circuit: CircuitState = { open: false, openedAt: 0, failures: 0 };
  private cacheDir: string;
  private runLogPath: string;
  /** versión de los prompts — cambiar invalida caché */
  public promptsVersion = "v1";

  constructor(cfg: LocalLlmConfig, stateDir: string) {
    this.cfg = cfg;
    this.cacheDir = path.join(stateDir, "llm-cache");
    this.runLogPath = path.join(stateDir, "llm-runs.jsonl");
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  // ── salud / modelo ───────────────────────────────────────────────────────
  async health(timeoutMs = 4000): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const r = await fetch(`${this.cfg.baseUrl}/api/version`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { version?: string };
      return { ok: true, version: j.version };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const r = await fetch(`${this.cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(6000) });
      const j = (await r.json()) as { models?: Array<{ name: string }> };
      return (j.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  async ensureModel(): Promise<{ ok: boolean; error?: string; digest?: string }> {
    const models = await this.listModels();
    const found = models.find((m) => m === this.cfg.model || m.split(":")[0] === this.cfg.model.split(":")[0]);
    if (!found) return { ok: false, error: `modelo ${this.cfg.model} no instalado (ollama pull ${this.cfg.model})` };
    try {
      const r = await fetch(`${this.cfg.baseUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.cfg.model }),
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json()) as { details?: { family?: string } };
      return { ok: true, digest: j.details?.family };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Descarga el modelo de VRAM (keep_alive 0). */
  async unload(): Promise<boolean> {
    try {
      await fetch(`${this.cfg.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.cfg.model, keep_alive: 0 }),
        signal: AbortSignal.timeout(20_000),
      });
      // verificación: ollama ps ya no debe listar el modelo cargado
      const r = await fetch(`${this.cfg.baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) });
      const j = (await r.json()) as { models?: Array<{ name: string }> };
      return !(j.models ?? []).some((m) => m.name.startsWith(this.cfg.model.split(":")[0]));
    } catch {
      return false;
    }
  }

  async getStats(): Promise<Array<{ name: string; sizeVramMb: number | null; expiresMs: number | null }>> {
    try {
      const r = await fetch(`${this.cfg.baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) });
      const j = (await r.json()) as { models?: Array<{ name: string; size_vram?: number; expires_at?: string }> };
      return (j.models ?? []).map((m) => ({
        name: m.name,
        sizeVramMb: m.size_vram != null ? Math.round(m.size_vram / (1024 * 1024)) : null,
        expiresMs: m.expires_at ? new Date(m.expires_at).getTime() - Date.now() : null,
      }));
    } catch {
      return [];
    }
  }

  // ── circuit breaker ──────────────────────────────────────────────────────
  private circuitCheck(): void {
    if (!this.circuit.open) return;
    if (Date.now() - this.circuit.openedAt > CIRCUIT_COOLDOWN_MS) {
      this.circuit = { open: false, openedAt: 0, failures: 0 }; // half-open: permitir prueba
      return;
    }
    throw new Error(`CIRCUIT_OPEN: Ollama falló ${CIRCUIT_THRESHOLD} veces seguidas — reintento manual o reinicio de Ollama`);
  }

  private circuitRecord(ok: boolean): void {
    if (ok) {
      this.circuit = { open: false, openedAt: 0, failures: 0 };
    } else {
      this.circuit.failures++;
      if (this.circuit.failures >= CIRCUIT_THRESHOLD) {
        this.circuit.open = true;
        this.circuit.openedAt = Date.now();
      }
    }
  }

  // ── generación ───────────────────────────────────────────────────────────
  private cacheKey(task: string, system: string, user: string, schemaName: string | null, temp: number): string {
    return crypto.createHash("sha256").update([
      this.cfg.model, this.promptsVersion, task, schemaName ?? "text", String(temp),
      crypto.createHash("sha256").update(system).digest("hex").slice(0, 16),
      crypto.createHash("sha256").update(user).digest("hex"),
    ].join("|")).digest("hex");
  }

  private logRun(entry: RunLogEntry): void {
    try { fs.appendFileSync(this.runLogPath, JSON.stringify(entry) + "\n"); } catch {}
  }

  /**
   * Generación con salida validada contra JSON Schema (structured outputs).
   * parse → validate → aceptar o lanzar SCHEMA_FAIL.
   */
  async generateStructured<T>(opts: {
    task: string;
    system: string;
    user: string;
    jsonSchema: object;
    validate: (raw: unknown) => T;
    useCache?: boolean;
    numCtxOverride?: number;
  }): Promise<T> {
    this.circuitCheck();
    const profile = TASK_PROFILES[opts.task] ?? TASK_PROFILES.dialogue;
    const key = this.cacheKey(opts.task, opts.system, opts.user, "schema", profile.temperature);
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    if (opts.useCache !== false && fs.existsSync(cacheFile)) {
      try {
        this.logRun({ ts: new Date().toISOString(), task: opts.task, model: this.cfg.model, status: "ok", durationMs: 0, retries: 0, inputChars: opts.user.length, outputChars: 0, cacheHit: true });
        return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as T;
      } catch { /* caché corrupta: regenerar */ }
    }

    let lastError = "desconocido";
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = Date.now();
      try {
        const r = await fetch(`${this.cfg.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.cfg.model,
            messages: [
              { role: "system", content: opts.system },
              { role: "user", content: opts.user },
            ],
            format: opts.jsonSchema,
            stream: false,
            think: false,
            keep_alive: 0,
            options: {
              temperature: profile.temperature,
              top_p: profile.topP ?? 0.9,
              num_ctx: opts.numCtxOverride ?? this.cfg.contextTokens,
            },
          }),
          signal: AbortSignal.timeout(profile.timeoutMs),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number; eval_duration?: number };
        const raw = j.message?.content ?? "";
        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { throw new Error("SCHEMA_FAIL: JSON inválido"); }
        const validated = opts.validate(parsed); // lanza si no cumple
        this.circuitRecord(true);
        fs.writeFileSync(cacheFile, JSON.stringify(validated));
        const tps = j.eval_duration ? ((j.eval_count ?? 0) / (j.eval_duration / 1e9)) : undefined;
        this.logRun({
          ts: new Date().toISOString(), task: opts.task, model: this.cfg.model, status: "ok",
          durationMs: Date.now() - t0, retries: attempt, promptEvalCount: j.prompt_eval_count, evalCount: j.eval_count,
          tokensPerSec: tps != null && isFinite(tps) ? Math.round(tps * 10) / 10 : undefined,
          inputChars: opts.user.length, outputChars: raw.length,
        });
        return validated;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        const transportError = !lastError.startsWith("SCHEMA_FAIL");
        this.logRun({
          ts: new Date().toISOString(), task: opts.task, model: this.cfg.model,
          status: lastError.startsWith("SCHEMA_FAIL") ? "schema_fail" : "error",
          durationMs: Date.now() - t0, retries: attempt, inputChars: opts.user.length, outputChars: 0, error: lastError,
        });
        // solo reintentar ante errores recuperables; SCHEMA_FAIL reintenta también (2 máx implícitos)
        if (attempt === 2) break;
        if (transportError && /ECONNREFUSED|timeout|aborted/i.test(lastError)) {
          this.circuitRecord(false);
          await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
        }
      }
    }
    this.circuitRecord(false);
    throw new Error(`LLM_HARD_FAILURE (${opts.task}): ${lastError}`);
  }

  async generateText(opts: { task: string; system: string; user: string }): Promise<string> {
    const validated = await this.generateStructured<string>({
      task: opts.task, system: opts.system, user: opts.user,
      jsonSchema: { type: "string" },
      validate: (raw) => (typeof raw === "string" ? raw : String(raw)),
    });
    return validated;
  }
}

let singleton: LocalLLMService | null = null;
export function getLocalLLM(stateDir: string): LocalLLMService {
  if (!singleton) singleton = new LocalLLMService(loadLlmConfig(), path.join(path.dirname(stateDir), "..", "..", "data", "tts"));
  return singleton;
}
