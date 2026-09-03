/**
 * llm-factory.ts — selección y creación del proveedor LLM activo.
 *
 * Orden de prioridad:
 *   1. process.env.LLM_PROVIDER = "groq" → GroqLLMProvider (si GROQ_API_KEY configurada)
 *   2. fallback a OllamaLLMProvider (LocalLLMService)
 *
 * Singleton: se crea una sola instancia al inicio del sidecar.
 * El frontend nunca recibe la API key; solo recibe "configured: true/false".
 */
import path from "node:path";
import { LocalLLMService, loadLlmConfig, type ILLMProvider } from "./local-llm";
import { GroqLLMProvider } from "./groq-provider";
import { getGroqQueue } from "./groq-queue";

export type { ILLMProvider };

export interface LLMFactoryResult {
  provider: ILLMProvider;
  /** Proveedor activo seleccionado */
  selectedProvider: "groq" | "ollama";
  /** Si Groq fue pedido pero no está configurado */
  groqMissingKey: boolean;
}

let _singleton: LLMFactoryResult | null = null;

/**
 * Devuelve el proveedor LLM seleccionado según configuración.
 * No llanza: si Groq falla, devuelve Ollama con groqMissingKey=true.
 */
export function createLLMProvider(repoRoot: string): LLMFactoryResult {
  if (_singleton) return _singleton;

  const requestedProvider = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
  const stateDir = path.join(repoRoot, "data", "tts");

  if (requestedProvider === "groq") {
    const groq = GroqLLMProvider.fromEnv(stateDir);
    if (groq) {
      _singleton = { provider: groq, selectedProvider: "groq", groqMissingKey: false };
      console.info("[llm-factory] Motor LLM: Groq →", groq.model);
      return _singleton;
    }
    // Groq pedido pero sin clave → advertencia + fallback
    console.warn("[llm-factory] LLM_PROVIDER=groq pero GROQ_API_KEY no configurada — usando Ollama como fallback");
    _singleton = {
      provider: new LocalLLMService(loadLlmConfig(), stateDir),
      selectedProvider: "ollama",
      groqMissingKey: true,
    };
    return _singleton;
  }

  // Default: Ollama
  _singleton = {
    provider: new LocalLLMService(loadLlmConfig(), stateDir),
    selectedProvider: "ollama",
    groqMissingKey: false,
  };
  console.info("[llm-factory] Motor LLM: Ollama →", loadLlmConfig().model);
  return _singleton;
}

/** Solo para tests: resetea el singleton */
export function _resetLLMFactoryForTests(): void {
  _singleton = null;
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
  if (!_singleton) return null;
  const { selectedProvider, provider } = _singleton;

  if (selectedProvider === "groq") {
    const usage = getGroqQueue().usage;
    return {
      provider: "groq",
      model: provider.model,
      configured: true,
      ...usage,
    };
  }
  return {
    provider: "ollama",
    model: provider.model,
    configured: true,
    tokensThisRun: 0,
    callsThisRun: 0,
    estimatedDailyUsed: 0,
    rateLimitWaitMs: 0,
    fallbackUsed: false,
    lastCallAt: null,
  };
}
