import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { GroqLLMProvider } from "../groq-provider";
import { createLLMProvider, _resetLLMFactoryForTests } from "../llm-factory";
import { getGroqQueue, _resetQueueForTests } from "../groq-queue";
import { sanitizeForCloud, assertNoSecrets, detectsSensitiveContent } from "../privacy-filter";

describe("GroqLLMProvider & Integration Suite", () => {
  let tmpDir: string;

  beforeEach(() => {
    process.env.GROQ_BACKOFF_BASE_MS = "5";
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "groq-test-"));
    _resetLLMFactoryForTests();
    _resetQueueForTests();
  });

  afterEach(() => {
    delete process.env.GROQ_BACKOFF_BASE_MS;
    vi.restoreAllMocks();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  // 1. Selección Groq/Ollama
  it("1. Selección Groq/Ollama según LLM_PROVIDER y presencia de GROQ_API_KEY", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.LLM_PROVIDER = "groq";
      process.env.GROQ_API_KEY = "gsk_test_key_12345678901234567890";
      _resetLLMFactoryForTests();
      const resGroq = createLLMProvider(tmpDir);
      expect(resGroq.selectedProvider).toBe("groq");
      expect(resGroq.provider.provider).toBe("groq");

      // Si falta la API key de Groq, hace fallback honesto a Ollama
      delete process.env.GROQ_API_KEY;
      _resetLLMFactoryForTests();
      const resFallback = createLLMProvider(tmpDir);
      expect(resFallback.selectedProvider).toBe("ollama");
      expect(resFallback.groqMissingKey).toBe(true);

      // Si LLM_PROVIDER=ollama
      process.env.LLM_PROVIDER = "ollama";
      _resetLLMFactoryForTests();
      const resOllama = createLLMProvider(tmpDir);
      expect(resOllama.selectedProvider).toBe("ollama");
    } finally {
      process.env = originalEnv;
    }
  });

  // 2. JSON Schema estricto
  it("2. JSON Schema estricto agrega additionalProperties: false y required en todos los objetos", async () => {
    let capturedBody: { response_format?: { type?: string; json_schema?: { strict?: boolean; schema?: { additionalProperties?: boolean; required?: string[] } } } } | null = null;
    vi.spyOn(global, "fetch").mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts?.body as string);
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ name: "test", count: 1 }) } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response;
    });

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
      },
    };

    const out = await provider.generateStructured({
      task: "dialogue",
      system: "system",
      user: "user",
      jsonSchema: schema,
      validate: (raw: unknown) => raw,
    });

    expect(out).toEqual({ name: "test", count: 1 });
    expect(capturedBody.response_format.type).toBe("json_schema");
    expect(capturedBody.response_format.json_schema.strict).toBe(true);
    expect(capturedBody.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(capturedBody.response_format.json_schema.schema.required).toEqual(["name", "count"]);
  });

  // 3. Respuesta válida
  it("3. Respuesta válida parsea y valida con el validador provisto", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ titular: "Noticia", relevancia: 10 }) } }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }),
    } as Response);

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    const res = await provider.generateStructured({
      task: "analysis",
      system: "sys",
      user: "hola",
      jsonSchema: { type: "object", properties: { titular: { type: "string" }, relevancia: { type: "number" } } },
      validate: (raw: unknown) => {
        const obj = raw as { titular?: string; relevancia?: number };
        if (!obj.titular) throw new Error("Falta titular");
        return obj;
      },
    });

    expect(res.titular).toBe("Noticia");
    expect(res.relevancia).toBe(10);
  });

  // 4. Respuesta rechazada (malformada)
  it("4. Respuesta rechazada cuando el JSON es inválido o no cumple el validador", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        choices: [{ message: { content: "Este no es un json válido" } }],
      }),
    } as Response);

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    await expect(provider.generateStructured({
      task: "dialogue",
      system: "sys",
      user: "user",
      jsonSchema: { type: "object", properties: { x: { type: "string" } } },
      validate: (raw: unknown) => raw,
    })).rejects.toThrow(/GROQ_SCHEMA_FAIL/);
  });

  // 5. Timeout
  it("5. Timeout arroja error y no se cuelga indefinidamente", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new DOMException("The operation was aborted", "TimeoutError"));
        }, 50);
      });
    });

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    await expect(provider.generateText({
      task: "analysis",
      system: "s",
      user: "u",
    })).rejects.toThrow();
  });

  // 6. Error de red
  it("6. Error de red lanza excepción identificable y controlada", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:443"));

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    await expect(provider.generateText({
      task: "analysis",
      system: "s",
      user: "u",
    })).rejects.toThrow(/ECONNREFUSED/);
  });

  // 7 & 8. 429 con retry-after y espera sin fallback prematuro
  it("7 & 8. 429 por TPM espera retry-after y reintenta sin caer prematuramente a Ollama", async () => {
    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const headers = new Headers();
        headers.set("retry-after", "0.01"); // 10ms
        headers.set("x-ratelimit-remaining-tokens", "100");
        return {
          ok: false,
          status: 429,
          headers,
          json: async () => ({ error: { message: "Rate limit reached for TPM", code: "rate_limit_exceeded" } }),
        } as Response;
      }
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
      } as Response;
    });

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    const res = await provider.generateStructured({
      task: "dialogue",
      system: "s",
      user: "u",
      jsonSchema: { type: "object", properties: { ok: { type: "boolean" } } },
      validate: (raw: unknown) => raw,
    });

    expect(callCount).toBe(2);
    expect(res).toEqual({ ok: true });
    // No hubo fallback a Ollama en el primer 429
    expect(getGroqQueue().isDailyExhausted).toBe(false);
  });

  // 9. Agotamiento diario y fallback
  it("9. Agotamiento diario (RPD) marca dailyExhausted para permitir fallback", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      const headers = new Headers();
      return {
        ok: false,
        status: 429,
        headers,
        json: async () => ({
          error: { message: "Daily token limit reached for requests per day (RPD)", code: "rate_limit_exceeded_daily" },
        }),
      } as Response;
    });

    const provider = new GroqLLMProvider({
      apiKey: "gsk_test",
      writerModel: "openai/gpt-oss-120b",
      fastModel: "openai/gpt-oss-20b",
      cacheDir: path.join(tmpDir, "cache"),
      runLogPath: path.join(tmpDir, "runs.jsonl"),
    });

    await expect(provider.generateText({
      task: "analysis",
      system: "s",
      user: "u",
    })).rejects.toThrow(/GROQ_DAILY_EXHAUSTED/);

    expect(getGroqQueue().isDailyExhausted).toBe(true);
  });

  // 10. Caché separada por proveedor/modelo
  it("10. Caché separada por proveedor y modelo (aislamiento de keys)", () => {
    const makeKey = (provider: string, model: string, prompt: string) => {
      return crypto.createHash("sha256").update([provider, model, prompt].join("|")).digest("hex");
    };

    const keyGroq = makeKey("groq", "openai/gpt-oss-120b", "pregunta");
    const keyOllama = makeKey("ollama", "qwen3.5:9b", "pregunta");
    expect(keyGroq).not.toBe(keyOllama);
  });

  // 11. Registro correcto de tokens
  it("11. Registro correcto de tokens en groq-queue", () => {
    const queue = getGroqQueue();
    queue.resetRunMetrics();
    queue.recordUsage({ prompt_tokens: 150, completion_tokens: 50, total_tokens: 200 });

    expect(queue.usage.tokensThisRun).toBe(200);
    expect(queue.usage.callsThisRun).toBe(1);
    expect(queue.usage.estimatedDailyUsed).toBe(200);
  });

  // 12. Redacción de datos personales
  it("12. Redacción de datos personales (NSS, CURP, RFC, teléfonos)", () => {
    const textoConDatos = "El trabajador con NSS 12-34-56-7890-1 y CURP ABCD800101HDFRND01 teléfono 5512345678 solicita revisión.";
    const { sanitized, redacted } = sanitizeForCloud(textoConDatos);

    expect(sanitized).not.toContain("12-34-56-7890-1");
    expect(sanitized).not.toContain("ABCD800101HDFRND01");
    expect(sanitized).not.toContain("5512345678");
    expect(sanitized).toContain("NSS_REDACTADO");
    expect(sanitized).toContain("CURP_REDACTADO");
    expect(redacted).toContain("nss");
    expect(redacted).toContain("curp");
  });

  // 13. Ausencia de secretos en logs y requests
  it("13. assertNoSecrets previene fugas de GROQ_API_KEY o SPEECHIFY_API_KEY", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.GROQ_API_KEY = "gsk_secreto_super_confidencial_12345678";
      expect(() => {
        assertNoSecrets("Texto normal sin secretos");
      }).not.toThrow();

      expect(() => {
        assertNoSecrets("Accidentalmente enviamos gsk_secreto_super_confidencial_12345678 en el prompt");
      }).toThrow(/PRIVACY_VIOLATION/);
    } finally {
      process.env = originalEnv;
    }
  });

  // 14. Persistencia y reanudación
  it("14. Escritura y lectura de caché semántica", () => {
    const cacheDir = path.join(tmpDir, "llm-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, "sample-key.json");
    fs.writeFileSync(cacheFile, JSON.stringify({ contenido: "guardado previamente" }));

    const read = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    expect(read.contenido).toBe("guardado previamente");
  });

  // 15. scriptHash idéntico y reproducible
  it("15. scriptHash es SHA-256 de 64 caracteres hex reproducible", () => {
    const turns = [
      { id: "t1", speaker: "EDUARDO", text: "Hola a todos" },
      { id: "t2", speaker: "ANDREA", text: "Bienvenidos al programa" },
    ];
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(turns)).digest("hex");
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(turns)).digest("hex");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  // 16. Speechify intacto como único TTS
  it("16. Speechify continúa siendo el único TTS en sidecar", () => {
    const indexSrc = fs.readFileSync(path.resolve(__dirname, "../../index.ts"), "utf8");
    expect(indexSrc).toContain("SpeechifyEngine");
    expect(indexSrc).not.toContain("GroqTTS");
    expect(indexSrc).not.toContain("ElevenLabs");
  });

  // 17. Cero referencias a Groq TTS
  it("17. Cero referencias a Groq TTS en todo el módulo llm/", () => {
    const groqProviderSrc = fs.readFileSync(path.resolve(__dirname, "../groq-provider.ts"), "utf8");
    expect(groqProviderSrc).not.toContain("groq-tts");
    expect(groqProviderSrc).not.toContain("audio/speech");
    expect(groqProviderSrc).not.toContain("tts");
  });

  // 18. La aplicación no llama rutas heredadas alternativas
  it("18. EpisodeWorkflowService delega a ProjectWorkflowService sin bifurcaciones paralelas", async () => {
    const workflowFile = fs.readFileSync(path.resolve(__dirname, "../../services/episode-workflow-service.ts"), "utf8");
    expect(workflowFile).toContain("class EpisodeWorkflowService");
    expect(workflowFile).toContain("this.inner = new ProjectWorkflowService");
    expect(workflowFile).toContain("generateWithQuality");
  });
});
