import fs from "node:fs";
import path from "node:path";
import { sha256Hex } from "@la-veinte/radio-core";

/**
 * SentenceAwareChunker: divide intervenciones largas priorizando
 * final de oración / coma / punto y coma / dos puntos / cambio natural.
 * Nunca corta palabras. Objetivo orientativo: 120–220 caracteres.
 */

const SPLIT_RE = /([.!?…;:])(\s+|$)/;

export function sentenceAwareChunk(text: string, minChars = 120, maxChars = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];

  const chunks: string[] = [];
  let rest = clean;

  while (rest.length > maxChars) {
    const windowText = rest.slice(0, maxChars + 1);
    const matches: Array<{ idx: number; end: number }> = [];
    const re = new RegExp(SPLIT_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(windowText)) !== null) {
      matches.push({ idx: m.index, end: m.index + m[1].length + (m[2] ?? "").length });
    }

    let cut = -1;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].idx >= minChars) {
        cut = matches[i].end;
        break;
      }
    }
    if (cut === -1 || cut <= minChars * 0.5) {
      const lastSpace = rest.slice(minChars, maxChars).lastIndexOf(" ");
      cut = lastSpace === -1 ? maxChars : minChars + lastSpace;
    }

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export interface BlockCacheEntry {
  provider: string;
  model: string;
  device: string;
  voice: string;
  voiceProfileId?: string;
  referenceAudioSha256?: string;
  voiceSourceId?: string;
  modelRevision?: string;
  seed?: number | null;
  generationSettings?: Record<string, unknown>;
  text: string;
  wavPath: string;
  createdAt: string;
  durSec?: number;
}

/**
 * Cache key de identidad vocal OBLIGATORIA:
 * texto + voiceProfileId + voiceSourceId + referenceAudioSha256 (clonadas)
 * + builtinVoiceId/slot + modelRevision + seed + generationSettings + provider.
 * Dos speakers diciendo el mismo texto con identidades distintas → claves distintas.
 */
export async function blockCacheKey(params: {
  provider: string;
  model: string;
  device: string;
  voice: string;
  text: string;
  language?: string;
  voiceProfileId?: string;
  referenceAudioSha256?: string;
  voiceSourceId?: string;
  modelRevision?: string;
  seed?: number | null;
  generationSettings?: Record<string, unknown>;
}): Promise<string> {
  const payload = JSON.stringify({
    p: params.provider,
    m: params.model,
    d: params.device,
    v: params.voice,
    vp: params.voiceProfileId ?? params.voice,
    r: params.referenceAudioSha256 ?? "no-ref",
    src: params.voiceSourceId ?? "no-src",
    rev: params.modelRevision ?? "no-rev",
    seed: params.seed ?? 0,
    g: JSON.stringify(params.generationSettings ?? {}),
    l: params.language ?? "es",
    t: params.text,
  });
  return (await sha256Hex(payload)).slice(0, 24);
}

export class BlockCache {
  constructor(private cacheDir: string) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  /**
   * Devuelve la entrada solo si la identidad vocal coincide con la solicitada.
   * Si la entrada existe pero fue generada con OTRA referencia u OTRA fuente
   * (source/revision) → STALE_VOICE → null (se regenera solo ese bloque).
   */
  get(key: string, expected?: { referenceAudioSha256?: string; voiceSourceId?: string; modelRevision?: string }): BlockCacheEntry | null {
    const p = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(p)) return null;
    try {
      const entry = JSON.parse(fs.readFileSync(p, "utf8")) as BlockCacheEntry;
      if (!fs.existsSync(entry.wavPath)) return null;
      if (expected?.referenceAudioSha256 && entry.referenceAudioSha256 && entry.referenceAudioSha256 !== expected.referenceAudioSha256) return null;
      if (expected?.voiceSourceId && entry.voiceSourceId && entry.voiceSourceId !== expected.voiceSourceId) return null;
      if (expected?.modelRevision && entry.modelRevision && entry.modelRevision !== expected.modelRevision) return null;
      return entry;
    } catch {
      return null;
    }
  }

  put(key: string, entry: BlockCacheEntry) {
    fs.writeFileSync(path.join(this.cacheDir, `${key}.json`), JSON.stringify(entry, null, 2));
  }

  stats(): { entries: number; hits: number; misses: number } {
    const files = fs.existsSync(this.cacheDir) ? fs.readdirSync(this.cacheDir).filter((f) => f.endsWith(".json")) : [];
    return { entries: files.length, hits: 0, misses: 0 };
  }
}

/** Normaliza texto para síntesis: espacios, comillas curvas, guiones largos. */
export function cleanTtsText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2010-\u2015]/g, "–")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
