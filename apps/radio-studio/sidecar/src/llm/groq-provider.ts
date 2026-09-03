/**
 * groq-provider.ts — GroqLLMProvider: implementación de ILLMProvider sobre la API Groq.
 *
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 * Auth: Authorization: Bearer ${process.env.GROQ_API_KEY} — solo process.env, nunca hardcoded.
 * Schema estricto: response_format.type="json_schema" con strict:true.
 *
 * Sin SDK externo — usa fetch nativo de Node 18+.
 * Todas las peticiones pasan por la cola de rate-limit (groq-queue.ts).
 * La clave NUNCA se serializa, registra ni envía al frontend.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ILLMProvider } from "./local-llm";
import { TASK_PROFILES } from "./local-llm";
import { getGroqQueue, type GroqRateLimitError } from "./groq-queue";
import { sanitizeForCloud, assertNoSecrets, detectsSensitiveContent } from "./privacy-filter";
import { clampToInputBudget, maxTokensForStage } from "./token-budget";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface GroqLLMConfig {
  apiKey: string;         // NEVER logged or serialized
  writerModel: string;    // GPT-OSS 120B equivalent — for script writing
  fastModel: string;      // GPT-OSS 20B equivalent — for classification/extraction
  cacheDir: string;
  runLogPath: string;
}

/**
 * Tasks that use the fast model (classification, structured extraction, normalization, brief auxiliary evaluations).
 * Everything else (proposals, script writing, final critique, repairs) uses the writer model.
 */
const FAST_MODEL_TASKS = new Set(["analysis", "classification", "extraction", "normalization", "citation_audit"]);

/** Determines the appropriate model for a task */
function modelForTask(cfg: GroqLLMConfig, task: string): string {
  return FAST_MODEL_TASKS.has(task) ? cfg.fastModel : cfg.writerModel;
}

export class GroqLLMProvider implements ILLMProvider {
  readonly provider = "groq";
  readonly supportsStrictSchema = true;
  public promptsVersion = "v3";

  private cfg: GroqLLMConfig;

  /** Returns the writer model (used for status display) */
  get model(): string {
    return this.cfg.writerModel;
  }

  constructor(cfg: GroqLLMConfig) {
    this.cfg = cfg;
    fs.mkdirSync(cfg.cacheDir, { recursive: true });
  }

  static fromEnv(stateDir: string): GroqLLMProvider | null {
    const apiKey = process.env.GROQ_API_KEY ?? "";
    if (!apiKey) return null;

    return new GroqLLMProvider({
      apiKey,
      writerModel: process.env.GROQ_WRITER_MODEL ?? "openai/gpt-oss-120b",
      fastModel: process.env.GROQ_FAST_MODEL ?? "openai/gpt-oss-20b",
      cacheDir: path.join(stateDir, "llm-cache"),
      runLogPath: path.join(stateDir, "llm-runs.jsonl"),
    });
  }

  // ── ILLMProvider: health ────────────────────────────────────────────────
  async health(timeoutMs = 6000): Promise<{ ok: boolean; version?: string; error?: string }> {
    if (!this.cfg.apiKey) {
      return { ok: false, error: "GROQ_API_KEY no configurada" };
    }
    try {
      const r = await fetch(`${GROQ_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) {
        if (r.status === 401) return { ok: false, error: "GROQ_UNAUTHORIZED: clave inválida" };
        return { ok: false, error: `HTTP ${r.status}` };
      }
      const j = (await r.json()) as { object?: string };
      return { ok: true, version: j.object ?? "list" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── ILLMProvider: generateText ──────────────────────────────────────────
  async generateText(opts: { task: string; system: string; user: string }): Promise<string> {
    return this.generateStructured<string>({
      task: opts.task,
      system: opts.system,
      user: opts.user,
      jsonSchema: { type: "string" },
      validate: (raw) => (typeof raw === "string" ? raw : String(raw)),
    });
  }

  // ── ILLMProvider: generateStructured ───────────────────────────────────
  async generateStructured<T>(opts: {
    task: string;
    system: string;
    user: string;
    jsonSchema: object;
    validate: (raw: unknown) => T;
    useCache?: boolean;
    numCtxOverride?: number;
  }): Promise<T> {
    const profile = TASK_PROFILES[opts.task] ?? TASK_PROFILES.dialogue;
    const chosenModel = modelForTask(this.cfg, opts.task);

    // ── Privacidad: sanitizar antes de enviar a cloud ──
    if (detectsSensitiveContent(opts.user)) {
      // Si el contenido tiene datos personales no anonimizables, señalar para local
      throw new Error("GROQ_PRIVACY_REQUIRED: contenido con datos personales — usar modo local");
    }
    const { sanitized: sanitizedUser, redacted } = sanitizeForCloud(opts.user);
    assertNoSecrets(sanitizedUser);
    assertNoSecrets(opts.system);

    // ── Presupuesto de tokens: truncar input si necesario ──
    const clampedUser = clampToInputBudget(sanitizedUser, opts.task);

    // ── Caché (incluye provider + model para aislamiento) ──
    const cacheKey = this.makeCacheKey(opts.task, opts.system, clampedUser, profile.temperature, chosenModel, opts.jsonSchema);
    const cacheFile = path.join(this.cfg.cacheDir, `${cacheKey}.json`);

    if (opts.useCache !== false && fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as unknown;
        const validated = opts.validate(cached);
        this.logRun({ ts: new Date().toISOString(), task: opts.task, model: chosenModel, status: "ok", durationMs: 0, retries: 0, inputChars: clampedUser.length, outputChars: 0, cacheHit: true });
        return validated;
      } catch { /* caché corrupta */ }
    }

    // ── Schema estricto ──
    const isStringOnly = (opts.jsonSchema as { type?: string }).type === "string";
    const isArrayRoot = (opts.jsonSchema as { type?: string }).type === "array";
    const schemaToSend = isArrayRoot
      ? {
          type: "object",
          properties: { items: opts.jsonSchema },
          required: ["items"],
          additionalProperties: false,
        }
      : opts.jsonSchema;

    const responseFormat = isStringOnly
      ? undefined  // texto libre
      : {
          type: "json_schema" as const,
          json_schema: {
            name: `schema_${opts.task.replace(/[^a-z0-9]/gi, "_")}`,
            strict: true,
            schema: enforceStrictSchema(schemaToSend),
          },
        };

    // ── Envío a través de la cola de rate-limit ──
    const t0 = Date.now();
    let lastError = "desconocido";
    let attempt = 0;

    const result = await getGroqQueue().enqueue(async (signal) => {
      attempt++;
      const body: Record<string, unknown> = {
        model: chosenModel,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: clampedUser },
        ],
        temperature: profile.temperature,
        max_tokens: maxTokensForStage(opts.task),
        top_p: 0.9,
      };
      if (responseFormat) body.response_format = responseFormat;

      const resp = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      // Capturar headers de rate-limit antes de leer el body
      const headers: Record<string, string | undefined> = {};
      resp.headers.forEach((val, key) => { headers[key] = val; });
      getGroqQueue().applyRateLimitHeaders(headers);

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
        const retryAfter = headers["retry-after"] ? parseInt(headers["retry-after"], 10) : undefined;
        const err: GroqRateLimitError = Object.assign(new Error(errBody.error?.message ?? `HTTP ${resp.status}`), {
          status: resp.status,
          code: errBody.error?.code,
          retryAfter,
        });
        throw err;
      }

      const j = await resp.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      if (j.usage) getGroqQueue().recordUsage(j.usage);

      const content = j.choices?.[0]?.message?.content ?? "";
      return { content, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
    });

    // ── Parseo y validación ──
    const { content, tokensIn, tokensOut } = result;
    let parsed: unknown;

    if (isStringOnly) {
      parsed = content;
    } else {
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(content);
        if (m) {
          try { parsed = JSON.parse(m[1]); } catch {
            lastError = "JSON_PARSE_FAIL";
            this.logRun({ ts: new Date().toISOString(), task: opts.task, model: chosenModel, status: "schema_fail", durationMs: Date.now() - t0, retries: attempt - 1, inputChars: clampedUser.length, outputChars: content.length, error: lastError });
            throw new Error(`GROQ_SCHEMA_FAIL (${opts.task}): JSON no parseable — ${content.slice(0, 200)}`);
          }
        } else {
          lastError = "JSON_NO_OBJECT";
          this.logRun({ ts: new Date().toISOString(), task: opts.task, model: chosenModel, status: "schema_fail", durationMs: Date.now() - t0, retries: attempt - 1, inputChars: clampedUser.length, outputChars: content.length, error: lastError });
          throw new Error(`GROQ_SCHEMA_FAIL (${opts.task}): sin JSON en respuesta`);
        }
      }

      // Si el schema original era un array envuelto en { items: [...] }, desenvolverlo
      if (isArrayRoot && parsed !== null && typeof parsed === "object" && "items" in (parsed as Record<string, unknown>)) {
        parsed = (parsed as { items: unknown }).items;
      }
    }

    const validated = opts.validate(parsed);
    fs.writeFileSync(cacheFile, JSON.stringify(validated));

    this.logRun({
      ts: new Date().toISOString(),
      task: opts.task,
      model: chosenModel,
      status: "ok",
      durationMs: Date.now() - t0,
      retries: attempt - 1,
      inputChars: clampedUser.length,
      outputChars: content.length,
      tokensIn,
      tokensOut,
      cacheHit: false,
      redacted: redacted.length > 0 ? redacted : undefined,
    });

    return validated;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private makeCacheKey(task: string, system: string, user: string, temp: number, model: string, schema: object): string {
    return crypto.createHash("sha256").update([
      "groq", model, this.promptsVersion, task, String(temp),
      crypto.createHash("sha256").update(system).digest("hex").slice(0, 16),
      crypto.createHash("sha256").update(user).digest("hex"),
      crypto.createHash("sha256").update(JSON.stringify(schema)).digest("hex").slice(0, 16),
    ].join("|")).digest("hex");
  }

  private logRun(entry: {
    ts: string; task: string; model: string; status: "ok" | "error" | "schema_fail";
    durationMs: number; retries: number; inputChars: number; outputChars: number;
    tokensIn?: number; tokensOut?: number; cacheHit?: boolean; error?: string; redacted?: string[];
  }): void {
    // NUNCA registrar la API key ni el contenido completo de los prompts
    try { fs.appendFileSync(this.cfg.runLogPath, JSON.stringify(entry) + "\n"); } catch {}
  }
}

/**
 * Hace el JSON Schema compatible con strict:true de Groq:
 * - Añade "additionalProperties": false a todos los objetos
 * - Asegura que todos los campos sean "required"
 */
function enforceStrictSchema(schema: object): object {
  return deepEnforce(schema) as object;
}

function deepEnforce(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(deepEnforce);
  if (node !== null && typeof node === "object") {
    const obj = { ...(node as Record<string, unknown>) };
    if (obj.type === "object" || obj.properties) {
      obj.additionalProperties = false;
      if (obj.properties && typeof obj.properties === "object") {
        const props = obj.properties as Record<string, unknown>;
        obj.required = Object.keys(props);
        obj.properties = Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, deepEnforce(v)])
        );
      }
    }
    if (obj.items) obj.items = deepEnforce(obj.items);
    if (obj.anyOf) obj.anyOf = (obj.anyOf as unknown[]).map(deepEnforce);
    if (obj.oneOf) obj.oneOf = (obj.oneOf as unknown[]).map(deepEnforce);
    if (obj.allOf) obj.allOf = (obj.allOf as unknown[]).map(deepEnforce);
    return obj;
  }
  return node;
}
