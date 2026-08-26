/**
 * Cola persistente de producción (archivo en disco).
 * Cada bloque confirmado se guarda INMEDIATAMENTE (escritura atómica),
 * así una caída de Windows/Tauri/Qwen deja el trabajo RESUMABLE.
 */

import fs from "node:fs";
import path from "node:path";
import type { VoiceSlot } from "@la-veinte/radio-core";

export type JobState = "QUEUED" | "RUNNING" | "PAUSED" | "DONE" | "FAILED" | "INTERRUPTED";

export interface JobBloque {
  id: string;
  texto: string;
  locutor: string;
  voz: string;
  voiceProfileId?: string;
  referenceAudioSha256?: string;
  voiceSourceId?: string;
  modelRevision?: string;
  estado: "pendiente" | "generado" | "fallo";
  chars: number;
  audioDurMs: number | null;
  genMs: number | null;
  rtf: number | null;
  cacheHit: boolean;
  engineRestart: boolean;
  error: string | null;
  wavPath: string | null;
}

export interface ProductionJob {
  id: string;
  tema: string;
  estado: JobState;
  creado: string;
  actualizado: string;
  bloques: JobBloque[];
  bloqueActual: number;
  vozAcumuladaMsDesdeReinicio: number;
  reiniciosWorker: number;
  voces: Record<string, VoiceSlot>;
  cancelado: boolean;
  notas: string[];
}

const JOB_DIR = path.join(process.cwd().includes("radio-studio") ? path.resolve(process.cwd(), "../../..") : process.cwd(), "data", "tts", "jobs");
const JOB_FILE = path.join(JOB_DIR, "job-actual.json");

export function jobFile(): string {
  return JOB_FILE;
}

export function eliminarJob(): void {
  try {
    if (fs.existsSync(JOB_FILE)) fs.rmSync(JOB_FILE, { force: true });
    if (fs.existsSync(JOB_DIR)) {
      for (const f of fs.readdirSync(JOB_DIR)) {
        if (f.startsWith("job-actual.json.") && f.endsWith(".tmp")) {
          fs.rmSync(path.join(JOB_DIR, f), { force: true });
        }
      }
    }
  } catch {
    // La eliminación se usa desde la UI; si Windows tiene un handle abierto,
    // el siguiente /progress no debe romperse y el usuario puede reintentar.
  }
}

export function leerJob(): ProductionJob | null {
  try {
    if (!fs.existsSync(JOB_FILE)) return null;
    return JSON.parse(fs.readFileSync(JOB_FILE, "utf8")) as ProductionJob;
  } catch {
    return null;
  }
}

export function guardarJob(job: ProductionJob): void {
  fs.mkdirSync(JOB_DIR, { recursive: true });
  job.actualizado = new Date().toISOString();
  const tmp = JOB_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
  // Windows: rename falla (EPERM) si otro proceso tiene el destino abierto
  // (sidecar leyendo /progress, antivirus). Reintenta con backoff.
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
  // Último recurso: copia no-atómica (evita perder el job).
  try {
    fs.copyFileSync(tmp, JOB_FILE);
    fs.rmSync(tmp, { force: true });
  } catch (e2) {
    throw lastErr ?? e2;
  }
}

export function nuevoJob(id: string, tema: string, bloques: Array<{ id: string; texto: string; locutor: string; voz: string; voiceProfileId?: string; referenceAudioSha256?: string; voiceSourceId?: string; modelRevision?: string }>, voces: Record<string, VoiceSlot>): ProductionJob {
  return {
    id,
    tema,
    estado: "QUEUED",
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
    bloques: bloques.map((b) => ({
      id: b.id,
      texto: b.texto,
      locutor: b.locutor,
      voz: b.voz,
      voiceProfileId: b.voiceProfileId,
      referenceAudioSha256: b.referenceAudioSha256,
      voiceSourceId: b.voiceSourceId,
      modelRevision: b.modelRevision,
      estado: "pendiente",
      chars: b.texto.length,
      audioDurMs: null,
      genMs: null,
      rtf: null,
      cacheHit: false,
      engineRestart: false,
      error: null,
      wavPath: null,
    })),
    bloqueActual: 0,
    vozAcumuladaMsDesdeReinicio: 0,
    reiniciosWorker: 0,
    voces,
    cancelado: false,
    notas: [],
  };
}

export function resumenJob(job: ProductionJob): Record<string, unknown> {
  const generados = job.bloques.filter((b) => b.estado === "generado");
  const genReal = generados.filter((b) => !b.cacheHit);
  const genMs = genReal.reduce((a, b) => a + (b.genMs ?? 0), 0);
  const audioMs = genReal.reduce((a, b) => a + (b.audioDurMs ?? 0), 0);

  // ETA por DURACIÓN DE AUDIO PENDIENTE (no por cantidad de bloques):
  // duración pendiente estimada × RTF reciente + reinicios previstos (~90 s cada uno).
  const pendientes = job.bloques.filter((b) => b.estado === "pendiente" && !b.cacheHit);
  const durPorChar = genReal.reduce((a, b) => a + (b.audioDurMs ?? 0), 0) /
    Math.max(1, genReal.reduce((a, b) => a + b.chars, 0));
  const audioPendienteMs = pendientes.reduce((a, b) => a + Math.round(b.chars * durPorChar), 0);
  const recientes = genReal.slice(-10);
  const rtfReciente = recientes.reduce((a, b) => a + (b.rtf ?? 0), 0) / Math.max(1, recientes.length);
  const SESSION_MS = 780_000;
  const vozPendienteTrasReinicio = Math.max(0, SESSION_MS - job.vozAcumuladaMsDesdeReinicio);
  const reiniciosPrevistos = audioPendienteMs > vozPendienteTrasReinicio
    ? Math.floor((audioPendienteMs - vozPendienteTrasReinicio) / SESSION_MS) + 1
    : 0;
  const etaMs = audioPendienteMs * (rtfReciente > 0 ? rtfReciente : 2) + reiniciosPrevistos * 90_000;

  return {
    id: job.id,
    tema: job.tema,
    estado: job.estado,
    done: generados.length,
    total: job.bloques.length,
    cacheHits: generados.filter((b) => b.cacheHit).length,
    generados: genReal.length,
    fallos: job.bloques.filter((b) => b.estado === "fallo").length,
    rtf: audioMs > 0 ? Number((genMs / audioMs).toFixed(3)) : null,
    rtfReciente: recientes.length > 0 ? Number(rtfReciente.toFixed(3)) : null,
    audioPendienteEstimadoMs: Math.round(audioPendienteMs),
    reiniciosPrevistos,
    etaMin: Math.round(etaMs / 60000),
    vozAcumuladaDesdeReinicioMs: job.vozAcumuladaMsDesdeReinicio,
    reiniciosWorker: job.reiniciosWorker,
    cancelado: job.cancelado,
    bloqueActual: job.bloqueActual,
    notas: job.notas,
  };
}
