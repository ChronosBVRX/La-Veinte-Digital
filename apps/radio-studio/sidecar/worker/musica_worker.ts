/**
 * Música Worker — proceso INDEPENDIENTE del sidecar HTTP.
 * Consume la cola persistente (musica-actual.json), encola la tarea en ACE-Step
 * (API 127.0.0.1:8001), espera el resultado y guarda el WAV + metadata en
 * data/tts/music. Mismo patrón que el worker del TTS Qwen.
 *
 * El sidecar NUNCA se bloquea: la generación de 60s tarda ~2-3 min aquí.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { leerJobMusica, guardarJobMusica, type MusicaTipo } from "./musica-job-store";

const execFileAsync = promisify(execFile);

const API = "http://127.0.0.1:8001";
const REPO = path.resolve(__dirname, "../../../..");
const MUSIC_DIR = path.join(REPO, "data", "tts", "music");

function log(msg: string) {
  console.log(`[musica-worker] ${msg}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(p: string, body: unknown, timeoutMs = 60000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function getBytes(p: string): Promise<Buffer> {
  const res = await fetch(`${API}${p}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function probeDurSec(file: string): Promise<number | null> {
  try {
    const out = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { timeout: 20000 });
    const v = Number(out.stdout.trim());
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

interface ReleaseResp { data: { task_id: string } }
interface QueryResp { data: Array<{ task_id: string; status: number; result?: string }> }
interface AudioResult { file: string; status: number; metas?: { bpm?: number; duration?: number; genres?: string; keyscale?: string; timesignature?: string }; seed_value?: string; dit_model?: string }

function parseResult(q: QueryResp): AudioResult | null {
  const entry = q.data?.[0];
  if (!entry?.result) return null;
  try {
    const arr = JSON.parse(entry.result) as AudioResult[];
    if (!Array.isArray(arr)) return null;
    return arr[0] ?? null;
  } catch {
    return null;
  }
}

export function tipoDeArchivo(tipo: MusicaTipo): string {
  switch (tipo) {
    case "jingle": return "jingle";
    case "cortinilla": return "cortinilla";
    case "sfx": return "sfx";
    case "ambiente": return "ambiente";
    default: return "bed";
  }
}

async function main() {
  const job = leerJobMusica();
  if (!job) {
    log("no hay trabajo en la cola");
    process.exit(0);
  }
  if (job.estado !== "QUEUED") {
    log(`estado ${job.estado} — nada que hacer`);
    process.exit(0);
  }
  if (job.cancelado) {
    log("job cancelado previamente — saliendo sin tocar el estado");
    process.exit(0);
  }

  job.estado = "RUNNING";
  guardarJobMusica(job);
  log(`generando ${tipoDeArchivo(job.tipo)} ${job.duracionSec}s → ${job.prompt.slice(0, 80)}…`);

  try {
    const health = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()) as { data?: { loaded_model?: string } };
    const model = health.data?.loaded_model ?? "?";
    log(`ACE-Step OK: ${model}`);
  } catch {
    throw new Error("el API de ACE-Step no responde en 127.0.0.1:8001 — arranca primero: cd tools/ACE-Step-1.5 && uv run --no-sync acestep-api");
  }

  const t0 = Date.now();
  const release = await post<ReleaseResp>("/release_task", {
    prompt: job.prompt,
    audio_duration: job.duracionSec,
    batch_size: 1,
    inference_steps: 8,
    audio_format: "wav",
    thinking: false,
  });
  const taskId = release.data.task_id;
  job.taskId = taskId;
  guardarJobMusica(job);
  log(`tarea ${taskId} encolada`);

  const base = tipoDeArchivo(job.tipo);
  const safe = `${base}-ace-${job.id.slice(-6)}-${Date.now()}.wav`;
  const dest = path.join(MUSIC_DIR, safe);
  const timeoutMs = job.duracionSec * 4000 + 600000;

  let audio: AudioResult | null = null;
  while (Date.now() - t0 < timeoutMs) {
    // Cancelación: el job puede pasar a PAUSED mientras se genera.
    const fresh = leerJobMusica();
    if (fresh && fresh.cancelado) {
      log("cancelado por el usuario — PAUSED, saliendo");
      process.exit(0);
    }
    const q = await post<QueryResp>("/query_result", { task_id_list: [taskId] });
    const r = parseResult(q);
    if (r && r.status === 1) { audio = r; break; }
    if (r && r.status === 2) throw new Error(`tarea fallida (status 2): ${JSON.stringify(q.data?.[0]).slice(0, 400)}`);
    await sleep(3000);
  }
  if (!audio) throw new Error("timeout esperando la tarea de ACE-Step");

  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  const wav = await getBytes(audio.file);
  fs.writeFileSync(dest, wav);
  const durSec = (await probeDurSec(dest)) ?? audio.metas?.duration ?? job.duracionSec;
  const genSec = (Date.now() - t0) / 1000;

  job.wavPath = dest;
  job.genSec = Number(genSec.toFixed(1));
  job.rtf = durSec > 0 ? Number((genSec / durSec).toFixed(3)) : null;
  job.seed = audio.seed_value ?? null;
  job.bpm = audio.metas?.bpm ?? null;
  job.keyscale = audio.metas?.keyscale ?? null;
  job.bytes = wav.length;
  job.estado = "DONE";
  job.error = null;
  job.notas.push(`audio ${durSec.toFixed(1)}s generado en ${genSec.toFixed(1)}s (rtf ${job.rtf}) → ${safe}`);
  guardarJobMusica(job);
  log(job.notas[job.notas.length - 1]);
  process.exit(0);
}

process.on("SIGTERM", () => {
  const job = leerJobMusica();
  if (job && job.estado === "RUNNING") {
    job.estado = "PAUSED";
    job.notas.push("interrumpido por el usuario");
    guardarJobMusica(job);
  }
  process.exit(0);
});
process.on("SIGINT", () => {
  const job = leerJobMusica();
  if (job && job.estado === "RUNNING") {
    job.estado = "PAUSED";
    job.notas.push("interrumpido por el usuario");
    guardarJobMusica(job);
  }
  process.exit(0);
});

main().catch((e) => {
  const job = leerJobMusica();
  if (job) {
    job.estado = "FAILED";
    job.error = String(e).slice(0, 300);
    job.notas.push(`fallo: ${job.error}`);
    guardarJobMusica(job);
  }
  console.error("FATAL:", e);
  process.exit(1);
});