/**
 * SpeechifyEngine — único motor TTS publicable de AI Radio Studio.
 * Sintetiza cada intervención por separado via POST https://api.speechify.ai/v1/audio/speech
 * Modelo obligatorio simba-3.0, idioma es-MX, formato WAV, límite 2000 chars incl. SSML.
 * Maneja 429/5xx con reintentos limitados, valida Base64 WAV RIFF, cache por bloque.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { blockCacheKey, BlockCache } from "./chunker";

const SPEECHIFY_API = "https://api.speechify.ai/v1/audio/speech";
const SPEECHIFY_VOICES_API = "https://api.speechify.ai/v1/voices";
const MODEL = "simba-3.0";
const LANGUAGE = "es-MX";
const PROVIDER = "speechify";
const MODEL_REVISION = "simba-3.0-v1";
const MAX_CHARS = 2000;

export interface SpeechifyEngineResult {
  ok: boolean;
  id: string;
  voice: string;
  path?: string;
  dur_s?: number | null;
  error?: string;
  requestId?: string | null;
  cacheHit?: boolean;
}

export type VoiceSlot = "A" | "B" | "N" | "C" | "P";
export type CharacterId = "EDUARDO" | "ANDREA" | "JAVIER" | "RODRIGO" | "VALERIA";

const SLOT_TO_CHARACTER: Record<VoiceSlot, CharacterId> = {
  A: "EDUARDO",
  B: "ANDREA",
  N: "JAVIER",
  C: "RODRIGO",
  P: "VALERIA",
};

const CHARACTER_SSML: Record<CharacterId, { emotion?: string; rate?: string }> = {
  EDUARDO: { emotion: "direct" },
  ANDREA: { emotion: "warm" },
  JAVIER: { rate: "-5%" },
  RODRIGO: { rate: "+6%" },
  VALERIA: { emotion: "bright" },
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSsml(text: string, character: CharacterId): string {
  const escaped = escapeXml(text);
  const profile = CHARACTER_SSML[character];
  let inner = escaped;
  if (profile.emotion) {
    inner = `<speechify:emotion name="${profile.emotion}">${escaped}</speechify:emotion>`;
  } else if (profile.rate) {
    inner = `<prosody rate="${profile.rate}">${escaped}</prosody>`;
  }
  return `<speak>${inner}</speak>`;
}

export function getCharacterForSlot(slot: VoiceSlot): CharacterId {
  return SLOT_TO_CHARACTER[slot] ?? "EDUARDO";
}

export function ssmlProfileKey(character: CharacterId): string {
  const p = CHARACTER_SSML[character];
  if (p.emotion) return `emotion:${p.emotion}`;
  if (p.rate) return `rate:${p.rate}`;
  return "none";
}

function readApiKey(): string | null {
  const k = process.env.SPEECHIFY_API_KEY?.trim();
  return k ? k : null;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

export class SpeechifyEngine {
  public isRunning = false;
  private _running = false;
  public cacheHits = 0;
  public cacheMisses = 0;
  public cache: BlockCache;
  private abortController: AbortController | null = null;
  private stateDir: string;
  private cacheDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
    this.cacheDir = path.join(stateDir, "cache");
    this.cache = new BlockCache(this.cacheDir);
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this._running = true;
  }

  async warmup(): Promise<{ ok: boolean; error?: string }> {
    const key = readApiKey();
    if (!key) return { ok: false, error: "SPEECHIFY_API_KEY no configurada" };
    // no warmup needed for cloud; just validate key present
    return { ok: true };
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    this._running = false;
  }

  async status(): Promise<Record<string, unknown>> {
    const key = readApiKey();
    return {
      provider: PROVIDER,
      model: MODEL,
      language: LANGUAGE,
      configured: !!key,
      isRunning: this.isRunning,
    };
  }

  abortCurrent(): boolean {
    if (this.abortController) {
      try { this.abortController.abort(); } catch {}
      return true;
    }
    return false;
  }

  async generate(text: string, voice: string, opts: {
    voiceId?: string;
    characterId?: string;
    seed?: number | null;
    voiceProfileId?: string;
    referenceAudioSha256?: string;
    voiceSourceId?: string;
    modelRevision?: string;
    signal?: AbortSignal;
  } = {}): Promise<SpeechifyEngineResult> {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return { ok: false, id: `sp-${Date.now()}`, voice, error: "texto vacío" };
    const slot: VoiceSlot = (["A", "B", "N", "C", "P"].includes(voice.toUpperCase()) ? voice.toUpperCase() : "A") as VoiceSlot;
    const character: CharacterId = (opts.characterId as CharacterId) ?? getCharacterForSlot(slot);
    const ssml = buildSsml(clean, character);
    if (ssml.length > MAX_CHARS) {
      return { ok: false, id: `sp-${Date.now()}`, voice, error: `SSML excede ${MAX_CHARS} caracteres (${ssml.length})` };
    }
    const voiceId = opts.voiceId ?? opts.voiceSourceId ?? "";
    if (!voiceId) {
      return { ok: false, id: `sp-${Date.now()}`, voice, error: "voiceId no configurado para Speechify" };
    }
    const apiKey = readApiKey();
    if (!apiKey) {
      return { ok: false, id: `sp-${Date.now()}`, voice, error: "SPEECHIFY_API_KEY no configurada" };
    }

    // cache key includes proveedor modelo idioma voiceId personaje texto perfil SSML revision
    const cacheKey = await blockCacheKey({
      provider: PROVIDER,
      model: MODEL,
      device: "cloud",
      voice: voiceId,
      text: clean,
      language: LANGUAGE,
      voiceProfileId: character,
      referenceAudioSha256: ssmlProfileKey(character),
      voiceSourceId: slot,
      modelRevision: opts.modelRevision ?? MODEL_REVISION,
      seed: opts.seed ?? 0,
      generationSettings: { ssmlProfile: ssmlProfileKey(character) },
    });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return { ok: true, id: cacheKey, voice, path: cached.wavPath, dur_s: cached.durSec ?? null, cacheHit: true };
    }
    this.cacheMisses++;

    const id = `sp-${Date.now()}-${Math.abs((opts.seed ?? 0) % 100000)}`;
    const controller = new AbortController();
    this.abortController = controller;
    const externalSignal = opts.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const payload = {
      input: ssml,
      voice_id: voiceId,
      model: MODEL,
      language: LANGUAGE,
      audio_format: "wav",
    };

    let lastError = "desconocido";
    let requestId: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(SPEECHIFY_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        requestId = r.headers.get("x-request-id") ?? r.headers.get("x-amzn-requestid") ?? null;
        if (r.status === 429 || (r.status >= 500 && r.status <= 599)) {
          const bodyText = await r.text().catch(() => "");
          lastError = `HTTP ${r.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`;
          if (attempt < 2) {
            const wait = parseRetryAfter(r.headers.get("retry-after")) ?? (1000 * Math.pow(2, attempt));
            await new Promise((res) => setTimeout(res, Math.min(wait, 8000)));
            continue;
          }
          return { ok: false, id, voice, error: lastError, requestId };
        }
        if (!r.ok) {
          const bodyText = await r.text().catch(() => "");
          lastError = `HTTP ${r.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`;
          return { ok: false, id, voice, error: lastError, requestId };
        }
        const j = await r.json() as { audio_data?: string; audioData?: string; data?: string; audio?: string; request_id?: string };
        const b64 = j.audio_data ?? j.audioData ?? j.data ?? j.audio;
        if (!b64 || typeof b64 !== "string") {
          return { ok: false, id, voice, error: "respuesta sin audio Base64", requestId };
        }
        let buf: Buffer;
        try {
          buf = Buffer.from(b64, "base64");
        } catch {
          return { ok: false, id, voice, error: "Base64 inválido", requestId };
        }
        if (buf.length < 44 || buf.subarray(0, 4).toString() !== "RIFF" || buf.subarray(8, 12).toString() !== "WAVE") {
          return { ok: false, id, voice, error: "audio no es WAV RIFF válido", requestId };
        }
        // guardar wav
        const outPath = path.join(this.cacheDir, `${cacheKey}.wav`);
        fs.writeFileSync(outPath, buf);
        // también guardar meta para cache hits futuros
        const dur = wavDurationSec(buf);
        this.cache.put(cacheKey, {
          provider: PROVIDER,
          model: MODEL,
          device: "cloud",
          voice: voiceId,
          voiceProfileId: character,
          referenceAudioSha256: ssmlProfileKey(character),
          voiceSourceId: slot,
          modelRevision: opts.modelRevision ?? MODEL_REVISION,
          seed: opts.seed ?? 0,
          generationSettings: { ssmlProfile: ssmlProfileKey(character) },
          text: clean,
          wavPath: outPath,
          createdAt: new Date().toISOString(),
          durSec: dur ?? undefined,
        });
        this.abortController = null;
        return { ok: true, id, voice, path: outPath, dur_s: dur, requestId, cacheHit: false };
      } catch (e) {
        if (controller.signal.aborted) {
          return { ok: false, id, voice, error: "cancelado", requestId };
        }
        lastError = e instanceof Error ? e.message : String(e);
        const isAbort = /abort/i.test(lastError);
        if (isAbort) return { ok: false, id, voice, error: "cancelado", requestId };
        if (attempt < 2 && /ECONN|timeout|fetch failed/i.test(lastError)) {
          await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
          continue;
        }
        return { ok: false, id, voice, error: lastError, requestId };
      }
    }
    return { ok: false, id, voice, error: lastError, requestId };
  }
}

function wavDurationSec(buf: Buffer): number | null {
  try {
    // WAV header: chunkSize 4-8, format 8-12, fmt chunk, then data chunk
    // simple estimate: sampleRate 24000 etc not trivial; fallback via header parsing
    // bytes 24-27 sampleRate, 34-35 bitsPerSample, 32-33 blockAlign, 40-43 data size
    if (buf.length < 44) return null;
    const sampleRate = buf.readUInt32LE(24);
    const bitsPerSample = buf.readUInt16LE(34);
    const numChannels = buf.readUInt16LE(22);
    const dataSize = buf.readUInt32LE(40);
    if (!sampleRate || !bitsPerSample || !numChannels || !dataSize) return null;
    const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    return bytesPerSec ? dataSize / bytesPerSec : null;
  } catch {
    return null;
  }
}

export function isSpeechifyConfigured(): boolean {
  return !!readApiKey();
}

// re-export for tests
export const _internal = { MODEL, LANGUAGE, PROVIDER, MAX_CHARS, SPEECHIFY_API, SPEECHIFY_VOICES_API };
