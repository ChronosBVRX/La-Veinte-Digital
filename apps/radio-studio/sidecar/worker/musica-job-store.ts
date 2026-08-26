/**
 * Cola persistente de generación de música local (ACE-Step 1.5).
 * Un solo job a la vez (la GPU no da para dos), escritura atómica en disco.
 * Mismo patrón que job-store.ts del TTS Qwen.
 */

import fs from "node:fs";
import path from "node:path";

export type MusicaJobState = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "PAUSED" | "INTERRUPTED";
export type MusicaTipo = "bed" | "jingle" | "sfx" | "cortinilla" | "ambiente";

export interface MusicaJob {
  id: string;
  prompt: string;
  duracionSec: number;
  tipo: MusicaTipo;
  estado: MusicaJobState;
  cancelado: boolean;
  taskId: string | null;
  wavPath: string | null;
  genSec: number | null;
  rtf: number | null;
  seed: string | null;
  bpm: number | null;
  keyscale: string | null;
  bytes: number | null;
  licencia: string;
  origen: string;
  creado: string;
  actualizado: string;
  error: string | null;
  notas: string[];
}

const JOB_DIR = path.join(process.cwd().includes("radio-studio") ? path.resolve(process.cwd(), "../../..") : process.cwd(), "data", "tts", "jobs");
const JOB_FILE = path.join(JOB_DIR, "musica-actual.json");

export function musicaJobFile(): string {
  return JOB_FILE;
}

export function leerJobMusica(): MusicaJob | null {
  try {
    if (!fs.existsSync(JOB_FILE)) return null;
    return JSON.parse(fs.readFileSync(JOB_FILE, "utf8")) as MusicaJob;
  } catch {
    return null;
  }
}

export function guardarJobMusica(job: MusicaJob): void {
  fs.mkdirSync(JOB_DIR, { recursive: true });
  job.actualizado = new Date().toISOString();
  const tmp = JOB_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
  let lastErr: unknown = null;
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, JOB_FILE);
      return;
    } catch (e) {
      lastErr = e;
      if (i < 4) {
        const ms = 50 + i * 150;
        const t = Date.now() + ms;
        while (Date.now() < t) { /* espera activa breve */ }
      }
    }
  }
  try {
    fs.copyFileSync(tmp, JOB_FILE);
    fs.rmSync(tmp, { force: true });
  } catch (e2) {
    throw lastErr ?? e2;
  }
}

export function nuevoJobMusica(opts: { prompt: string; duracionSec: number; tipo: MusicaTipo }): MusicaJob {
  return {
    id: `mus-${Date.now()}`,
    prompt: opts.prompt,
    duracionSec: opts.duracionSec,
    tipo: opts.tipo,
    estado: "QUEUED",
    cancelado: false,
    taskId: null,
    wavPath: null,
    genSec: null,
    rtf: null,
    seed: null,
    bpm: null,
    keyscale: null,
    bytes: null,
    licencia: "MIT — ACE-Step 1.5 (ver https://github.com/ACE-Step/ACE-Step-1.5)",
    origen: "generado localmente con ACE-Step 1.5 (acestep-v15-turbo, DiT, GTX 1650)",
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
    error: null,
    notas: [],
  };
}

export function resumenJobMusica(job: MusicaJob): Record<string, unknown> {
  return {
    id: job.id,
    prompt: job.prompt,
    duracionSec: job.duracionSec,
    tipo: job.tipo,
    estado: job.estado,
    wavPath: job.wavPath,
    genSec: job.genSec,
    rtf: job.rtf,
    seed: job.seed,
    bpm: job.bpm,
    keyscale: job.keyscale,
    bytes: job.bytes,
    licencia: job.licencia,
    origen: job.origen,
    error: job.error,
    notas: job.notas.slice(-4),
  };
}
