/**
 * Plan de mezcla multipista: coloca los turnos en el tiempo con pausas y
 * solapamientos (el solapamiento se resuelve en la MEZCLA, no en generación),
 * y añade pistas de música de cama / jingle / sfx con niveles.
 */

import type { DialogueTurn } from "./director";
import { estimateBlockDurSec } from "./text";

export interface VoiceMixItem {
  kind: "voz";
  turnId: string;
  speaker: string;
  label: string;
  startMs: number;
  durMs: number;
  gainDb: number;
  wavPath?: string;
}

export interface BedMixItem {
  kind: "bed" | "jingle" | "sfx";
  label: string;
  startMs: number;
  durMs: number;
  gainDb: number;
  fadeInMs: number;
  fadeOutMs: number;
  source?: string;
  duckWhenVoice?: boolean;
}

export interface MixPlan {
  voices: VoiceMixItem[];
  extras: BedMixItem[];
  totalMs: number;
  overlapMs: number;
  bedDuckDb: number;
}

const REACTION_MAX_LEN = 40;

export function buildMixPlan(turns: DialogueTurn[], opts: { bed?: string; jingle?: string; bedGainDb?: number; bedDuckDb?: number; overlapMs?: number } = {}): MixPlan {
  const voices: VoiceMixItem[] = [];
  const extras: BedMixItem[] = [];
  const bedDuckDb = opts.bedDuckDb ?? 10;
  let cursor = 0;

  for (const t of turns) {
    cursor += t.pauseBeforeMs;
    const durMs = Math.round(estimateBlockDurSec(t.text) * 1000);

    let startMs = cursor;
    const prev = voices[voices.length - 1];
    if (t.canOverlap && prev) {
      const isReaction = t.text.trim().length <= REACTION_MAX_LEN;
      if (isReaction) {
        startMs = Math.max(prev.startMs, prev.startMs + prev.durMs - (opts.overlapMs ?? 120));
      }
    }

    voices.push({
      kind: "voz",
      turnId: t.id,
      speaker: t.speaker,
      label: `${t.speaker}: ${t.text.slice(0, 48)}…`,
      startMs,
      durMs,
      gainDb: 0,
    });
    cursor = startMs + durMs + t.pauseAfterMs;
  }

  const totalMs = voices.reduce((a, v) => Math.max(a, v.startMs + v.durMs), 0);
  const overlapMs = voices.reduce((a, v, i) => {
    if (i === 0) return a;
    const prev = voices[i - 1];
    return a + Math.max(0, prev.startMs + prev.durMs - v.startMs);
  }, 0);

  if (opts.bed) {
    extras.push({
      kind: "bed",
      label: "MUSIC BED",
      startMs: 0,
      durMs: totalMs + 2000,
      gainDb: opts.bedGainDb ?? -18,
      fadeInMs: 1500,
      fadeOutMs: 2500,
      source: opts.bed,
      duckWhenVoice: true,
    });
  }
  if (opts.jingle) {
    extras.push({
      kind: "jingle",
      label: "JINGLE APERTURA",
      startMs: 0,
      durMs: 6000,
      gainDb: -6,
      fadeInMs: 200,
      fadeOutMs: 1200,
      source: opts.jingle,
    });
  }

  return { voices, extras, totalMs, overlapMs, bedDuckDb };
}

/** Niveles de la cama según estado (para UI y para el generador de ffmpeg). */
export function bedLevels(bedDuckDb: number) {
  return {
    sinVozDb: -18,
    conVozDb: -18 - bedDuckDb,
    pausaDb: -18,
  };
}
