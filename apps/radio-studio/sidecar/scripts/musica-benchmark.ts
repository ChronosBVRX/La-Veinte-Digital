/**
 * Benchmark de generación de música local — ACE-Step 1.5 (API 127.0.0.1:8001).
 * Igual filosofía que el benchmark de Chatterbox: medir tiempos REALES en la GTX 1650,
 * guardar el audio generado en data/tts/music para escuchar y reportar VRAM/RTF.
 * Uso: node --import tsx apps/radio-studio/sidecar/scripts/musica-benchmark.ts [segundos]
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readGpuSnapshot, detectHardware } from "@la-veinte/tts-core";

const execFileAsync = promisify(execFile);

const API = "http://127.0.0.1:8001";
const REPO = process.cwd().includes("radio-studio") ? path.resolve(process.cwd(), "../../..") : process.cwd();
const MUSIC_DIR = path.join(REPO, "data", "tts", "music");
const BENCH_DIR = path.join(REPO, "data", "tts", "benchmark");
const OUT = path.join(BENCH_DIR, "musica-benchmark-report.json");

const PROMPTS: Record<string, string> = {};
const LABELS = ["10s", "30s", "60s"];

async function post<T>(p: string, body: unknown, timeoutMs = 120000): Promise<T> {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  } catch { return null; }
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

async function releaseTask(prompt: string, durSec: number): Promise<string> {
  const r = await post<ReleaseResp>("/release_task", {
    prompt,
    audio_duration: durSec,
    batch_size: 1,
    inference_steps: 8,
    audio_format: "wav",
    thinking: false,
  });
  return r.data.task_id;
}

async function pollTask(taskId: string, timeoutMs: number): Promise<AudioResult> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const q = await post<QueryResp>("/query_result", { task_id_list: [taskId] });
    const r = parseResult(q);
    if (r && r.status === 1) return r;
    if (r && r.status === 2) throw new Error(`tarea fallida (status 2): ${JSON.stringify(q.data?.[0]).slice(0, 400)}`);
    await sleep(3000);
  }
  throw new Error("timeout esperando la tarea");
}

export async function musicaBenchmark(targets: number[] = [10, 30, 60]): Promise<Record<string, unknown>> {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.mkdirSync(BENCH_DIR, { recursive: true });

  const hw = await detectHardware(true);
  let modelState: string | null = null;
  try {
    const health = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
    modelState = (health.data as { loaded_model?: string }).loaded_model ?? null;
  } catch { /* servidor no disponible */ }

  const t0 = Date.now();
  const results: Array<Record<string, unknown>> = [];
  let peakVram = 0;
  let peakTemp = 0;
  let errores = 0;
  let totalGenS = 0;
  let totalAudioS = 0;

  for (const [i, dur] of targets.entries()) {
    const label = LABELS[i] ?? `${dur}s`;
    const prompt = PROMPTS[label] ?? `Instrumental moderno para programa informativo de radio, tecnologico pero institucional, sin voces, sin letra, 90 BPM, tono optimista, ${dur} segundos, musica instrumental de fondo`;
    console.log(`[musica] generando ${label} (${dur}s)… prompt de prueba`);
    const gpuBefore = await readGpuSnapshot();
    peakVram = Math.max(peakVram, gpuBefore.vramUsedMb ?? 0);
    peakTemp = Math.max(peakTemp, gpuBefore.tempC ?? 0);

    const tGen0 = Date.now();
    const taskId = await releaseTask(prompt, dur);
    const audio = await pollTask(taskId, dur * 6000 + 600000);
    const genMs = Date.now() - tGen0;

    // Descargar el WAV generado
    const safe = `acestep-${label}.wav`;
    const dest = path.join(MUSIC_DIR, safe);
    const wav = await getBytes(audio.file);
    fs.writeFileSync(dest, wav);

    const audioDur = (await probeDurSec(dest)) ?? audio.metas?.duration ?? dur;
    const rtf = audioDur > 0 ? genMs / 1000 / audioDur : null;
    const gpuAfter = await readGpuSnapshot();
    peakVram = Math.max(peakVram, gpuAfter.vramUsedMb ?? 0);
    peakTemp = Math.max(peakTemp, gpuAfter.tempC ?? 0);

    if (audioDur > 0) { totalAudioS += audioDur; totalGenS += genMs / 1000; }
    const reg = {
      target: label,
      duracionPedidaSec: dur,
      duracionMedidaSec: Number(audioDur.toFixed(2)),
      genSec: Number((genMs / 1000).toFixed(1)),
      rtf: rtf != null ? Number(rtf.toFixed(3)) : null,
      wav: dest,
      bytes: wav.length,
      vramPicoMb: gpuAfter.vramUsedMb,
      tempC: gpuAfter.tempC,
      bpm: audio.metas?.bpm ?? null,
      keyscale: audio.metas?.keyscale ?? null,
      seed: audio.seed_value ?? null,
      estado: "ok",
    };
    results.push(reg);
    console.log(`[musica] ${label}: audio=${audioDur.toFixed(1)}s gen=${(genMs / 1000).toFixed(1)}s rtf=${reg.rtf} vramPico=${gpuAfter.vramUsedMb}MB temp=${gpuAfter.tempC}°C → ${dest}`);
    errores += 0;
  }

  const cumulativeRtf = totalAudioS > 0 ? totalGenS / totalAudioS : null;
  const report = {
    provider: "acestep-local",
    modelo: "acestep-v15-turbo (DiT only, INT8, CPU offload, Tier 1)",
    api: API,
    hardware: hw,
    modeloCargado: modelState,
    targets: results,
    acumuladoRtf: cumulativeRtf != null ? Number(cumulativeRtf.toFixed(3)) : null,
    peakVramMb: peakVram,
    peakTempC: peakTemp,
    errores,
    estimacionBed: results.length > 0 && cumulativeRtf != null
      ? { "1min": Math.round(60 * (results.find((r) => r.rtf != null)?.rtf as number)), "5min": Math.round(300 * cumulativeRtf) }
      : null,
    elapsedMin: Number(((Date.now() - t0) / 60000).toFixed(1)),
    timestamp: new Date().toISOString(),
  };
  return report;
}

async function main() {
  const argv = Number(process.argv[2]);
  const targets = Number.isFinite(argv) && argv > 0 ? [argv] : [10, 30, 60];
  try {
    const health = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
    console.log(`[musica] ACE-Step API OK: ${JSON.stringify(health.data)}`);
  } catch {
    console.error(`[musica] FATAL: el API de ACE-Step no responde en ${API}. Arranca el server primero (uv run acestep-api).`);
    process.exit(1);
  }
  const report = await musicaBenchmark(targets);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`[musica] REPORTE: ${OUT}`);
  console.log(JSON.stringify({ resumen: report.targets, acumuladoRtf: report.acumuladoRtf, peakVramMb: report.peakVramMb, peakTempC: report.peakTempC, estimacion: report.estimacionBed }));
}

if (require.main === module) {
  main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
}