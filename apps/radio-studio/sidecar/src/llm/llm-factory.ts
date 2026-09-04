/**
 * llm-factory.ts — selección y creación del proveedor LLM activo.
 *
 * REGLA ARQUITECTÓNICA DE LA VEINTE RADIO:
 * Todo contenido editorial en producción (propuestas, escaletas, guiones, reparaciones)
 * debe ser generado EXCLUSIVAMENTE por Groq (GroqLLMProvider).
 *
 * getEditorialProvider(repoRoot):
 *   - Devuelve GroqLLMProvider.
 *   - Si GROQ_API_KEY no está configurada, lanza GroqUnavailableError.
 *   - NUNCA degrada silenciosamente a Ollama, Qwen ni a código determinista.
 *
 * Herramientas experimentales locales:
 *   - Solo permitidas si process.env.RADIO_ALLOW_EXPERIMENTAL_LOCAL_LLM === "true"
 *   - Nunca se activan como fallback ante una falla de Groq.
 */
import path from "node:path";
import { LocalLLMService, loadLlmConfig, type ILLMProvider } from "./local-llm";
import { GroqLLMProvider } from "./groq-provider";
import { getGroqQueue } from "./groq-queue";
import { GroqUnavailableError } from "../errors/editorial-errors";

export type { ILLMProvider };

export interface LLMFactoryResult {
  provider: ILLMProvider;
  /** Proveedor activo seleccionado */
  selectedProvider: "groq" | "ollama";
  /** Si Groq fue pedido pero no está configurado */
  groqMissingKey: boolean;
}

let _singleton: LLMFactoryResult | null = null;
let _editorialOverride: ILLMProvider | null = null;

/**
 * Devuelve el proveedor LLM editorial obligatorio para La Veinte Radio.
 * Producción: GROQ-ONLY. Si Groq no está disponible, lanza error explícito.
 */
export function getEditorialProvider(repoRoot: string): ILLMProvider {
  if (_editorialOverride) return _editorialOverride;

  const stateDir = path.join(repoRoot, "data", "tts");
  const allowExperimental = process.env.RADIO_ALLOW_EXPERIMENTAL_LOCAL_LLM === "true";
  const requestedProvider = (process.env.LLM_PROVIDER ?? "groq").toLowerCase();

  if (allowExperimental && requestedProvider === "ollama") {
    console.warn("[llm-factory] USO EXPERIMENTAL LOCAL: Ollama activo por flag explícito de desarrollo.");
    return new LocalLLMService(loadLlmConfig(), stateDir);
  }

  const groq = GroqLLMProvider.fromEnv(stateDir);
  if (groq) return groq;

  // Si no hay clave, retornar instancia Groq que falla en health() y generateStructured() con GroqUnavailableError
  return new GroqLLMProvider({
    apiKey: "",
    writerModel: process.env.GROQ_WRITER_MODEL ?? "openai/gpt-oss-120b",
    fastModel: process.env.GROQ_FAST_MODEL ?? "openai/gpt-oss-20b",
    cacheDir: path.join(stateDir, "llm-cache"),
    runLogPath: path.join(stateDir, "llm-runs.jsonl"),
  });
}

/**
 * Solo para tests: sobreescribe el proveedor editorial activo.
 */
export function _overrideEditorialProviderForTests(provider: ILLMProvider | null): void {
  _editorialOverride = provider;
}

/**
 * Devuelve el proveedor LLM seleccionado según configuración general de infraestructura.
 * Si se pide Groq y no hay clave, señala groqMissingKey.
 */
export function createLLMProvider(repoRoot: string): LLMFactoryResult {
  if (_singleton) return _singleton;

  const requestedProvider = (process.env.LLM_PROVIDER ?? "groq").toLowerCase();
  const stateDir = path.join(repoRoot, "data", "tts");

  if (requestedProvider === "groq") {
    const groq = GroqLLMProvider.fromEnv(stateDir);
    if (groq) {
      _singleton = { provider: groq, selectedProvider: "groq", groqMissingKey: false };
      console.info("[llm-factory] Motor LLM productivo: Groq →", groq.model);
      return _singleton;
    }
    // Groq pedido pero sin clave en diagnóstico de infraestructura
    _singleton = {
      provider: new LocalLLMService(loadLlmConfig(), stateDir),
      selectedProvider: "ollama",
      groqMissingKey: true,
    };
    return _singleton;
  }

  if (requestedProvider === "ollama") {
    _singleton = {
      provider: new LocalLLMService(loadLlmConfig(), stateDir),
      selectedProvider: "ollama",
      groqMissingKey: false,
    };
    return _singleton;
  }

  // Por defecto en La Veinte Radio: Groq
  const groq = GroqLLMProvider.fromEnv(stateDir);
  if (groq) {
    _singleton = { provider: groq, selectedProvider: "groq", groqMissingKey: false };
    return _singleton;
  }

  _singleton = {
    provider: new LocalLLMService(loadLlmConfig(), stateDir),
    selectedProvider: "ollama",
    groqMissingKey: true,
  };
  return _singleton;
}

/** Solo para tests: resetea el singleton y overrides */
export function _resetLLMFactoryForTests(): void {
  _singleton = null;
  _editorialOverride = null;
}

/** Devuelve el proveedor activo (shortcut) */
export function getActiveLLMProvider(repoRoot: string): ILLMProvider {
  return createLLMProvider(repoRoot).provider;
}

/** Estado de uso de Groq para el panel de la interfaz */
export function getGroqUsageForUI(): {
  provider: string;
  model: string;
  configured: boolean;
  tokensThisRun: number;
  callsThisRun: number;
  estimatedDailyUsed: number;
  rateLimitWaitMs: number;
  fallbackUsed: boolean;
  lastCallAt: string | null;
} | null {
  if (_singleton?.selectedProvider === "groq" || !_singleton) {
    const usage = getGroqQueue().usage;
    return {
      provider: "groq",
      model: process.env.GROQ_WRITER_MODEL ?? "openai/gpt-oss-120b",
      configured: !!process.env.GROQ_API_KEY,
      ...usage,
      fallbackUsed: false, // Fallback determinista erradicado
    };
  }
  return {
    provider: "groq",
    model: "desconocido",
    configured: false,
    tokensThisRun: 0,
    callsThisRun: 0,
    estimatedDailyUsed: 0,
    rateLimitWaitMs: 0,
    fallbackUsed: false,
    lastCallAt: null,
  };
}
