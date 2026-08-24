import type { VoiceSlot } from "./voice-slots";

export interface VoiceProfile {
  id: string;
  name: string;
  engineVoice: VoiceSlot;
  color: string;
}

export interface SpeechBlock {
  id: string;
  locutor: string;
  texto: string;
  citas: string[];
}

export interface EpisodeSpec {
  id: string;
  tema: string;
  duracionMin: number;
  locutores: [VoiceProfile, VoiceProfile];
  soloCorpus: boolean;
  cutoff: string;
  guion: Array<{ locutor: string; linea: string; citas: string[] }>;
  cobertura: { porcentaje: number; recomendado: boolean };
  fuentes: Array<{ id: string; title: string; versionLabel: string; sha256: string }>;
}

export interface ProductionBlock {
  key: string;
  speechBlockId: string;
  locutor: string;
  voice: VoiceSlot;
  texto: string;
  estado: "pendiente" | "en_cache" | "generando" | "generado" | "fallo";
  wavPath?: string;
  durSec?: number;
  genSec?: number;
  motor?: "chatterbox" | "edge" | "sapi";
}

export interface ProductionSession {
  index: number;
  startBlock: number;
  endBlock: number;
  estado: "pendiente" | "activa" | "completada";
}

export interface ProductionPlan {
  blocks: ProductionBlock[];
  sessions: ProductionSession[];
  sessionMaxAudioSec: number;
  rtfConservador: number;
  estimacionTotalMin: number;
}

export interface StudioProgress {
  bloqueActual: number;
  totalBloques: number;
  porLocutor: Record<string, { hecho: number; total: number }>;
  cacheHits: number;
  generados: number;
  fallos: number;
  motor: string | null;
  gpu: { tempC: number | null; vramUsadaMb: number | null; vramTotalMb: number | null };
  tiempoRestanteMin: number | null;
}

export interface TimelineItem {
  kind: "voz" | "musica" | "jingle" | "fx";
  label: string;
  startSec: number;
  durSec: number;
  wavPath?: string;
  volume: number;
}

export interface Timeline {
  items: TimelineItem[];
  totalSec: number;
}

import { estimateBlockDurSec, chunkTexto, simpleHash } from "./text";

export function buildProductionPlan(
  episode: EpisodeSpec,
  opts: { rtfConservador?: number; sessionMaxAudioSec?: number } = {}
): ProductionPlan {
  const rtf = opts.rtfConservador ?? 2;
  const sessionMax = opts.sessionMaxAudioSec ?? 780;
  const blocks: ProductionBlock[] = [];
  let idx = 0;
  for (const escena of episode.guion) {
    const chunks = chunkTexto(escena.linea);
    for (const c of chunks) {
      const key = `blk-${idx}-${c.length}-${simpleHash(c)}`;
      blocks.push({
        key,
        speechBlockId: `${episode.id}-${idx}`,
        locutor: escena.locutor,
        voice: escena.locutor.toUpperCase().includes("VALERIA") || escena.locutor.toUpperCase().includes("COMERCIAL") ? "P"
          : escena.locutor.toUpperCase().includes("RODRIGO") || escena.locutor.toUpperCase().includes("CORRESPONSAL") ? "C"
            : escena.locutor.toUpperCase().includes("NARRADOR") || escena.locutor.toUpperCase().includes("ALONSO") ? "N"
              : escena.locutor.toUpperCase().includes("MARIANA") || escena.locutor.toUpperCase().includes("ANDREA") ? "B"
                : "A",
        texto: c,
        estado: "pendiente",
      });
      idx++;
    }
  }

  const sessions: ProductionSession[] = [];
  let acc = 0;
  let start = 0;
  blocks.forEach((b, i) => {
    const d = estimateBlockDurSec(b.texto);
    acc += d;
    if (acc >= sessionMax) {
      sessions.push({ index: sessions.length, startBlock: start, endBlock: i, estado: "pendiente" });
      acc = 0;
      start = i + 1;
    }
  });
  if (start < blocks.length) {
    sessions.push({ index: sessions.length, startBlock: start, endBlock: blocks.length - 1, estado: "pendiente" });
  }

  const totalAudioSec = blocks.reduce((a, b) => a + estimateBlockDurSec(b.texto), 0);
  const estimacionTotalMin = Math.round((totalAudioSec * rtf) / 60 + sessions.length * 0.6);

  return { blocks, sessions, sessionMaxAudioSec: sessionMax, rtfConservador: rtf, estimacionTotalMin };
}

export function buildTimeline(blocks: ProductionBlock[], extra: Array<{ kind: "musica" | "jingle" | "fx"; label: string; durSec: number; volume?: number }> = []): Timeline {
  const items: TimelineItem[] = [];
  let t = 0;
  for (const b of blocks) {
    const d = b.durSec ?? estimateBlockDurSec(b.texto);
    items.push({ kind: "voz", label: `${b.locutor} — ${b.texto.slice(0, 40)}…`, startSec: Math.round(t * 10) / 10, durSec: Math.round(d * 10) / 10, wavPath: b.wavPath, volume: 1 });
    t += d;
  }
  for (const e of extra) {
    items.push({ kind: e.kind, label: e.label, startSec: Math.round(t * 10) / 10, durSec: e.durSec, volume: e.volume ?? (e.kind === "musica" ? 0.25 : 0.8) });
    t += e.durSec;
  }
  items.sort((a, b) => a.startSec - b.startSec);
  return { items, totalSec: Math.round(t) };
}

export function applyProgress(plan: ProductionPlan, progress: StudioProgress): void {
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    if (i < progress.bloqueActual) b.estado = "generado";
  }
}

export * from "./text";
export * from "./sha256";
export * from "./director";
export * from "./mix";
export * from "./diversity";
export * from "./polisher";
export * from "./editorial-qa";
export * from "./voice-profile";
export * from "./personas";
export * from "./voice-slots";
export * from "./conversation";
