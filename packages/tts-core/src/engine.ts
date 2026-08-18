/**
 * Gestor del motor Python de Chatterbox (proceso persistente).
 * - modelo cargado una sola vez por sesión
 * - concurrency = 1 (cola serial)
 * - VRAMGuard: nvidia-smi antes/después de cada trabajo
 * - OOM: el motor reintenta una vez; si persiste, estado GPU_LOW_VRAM y fallback
 * - REINICIAR MOTOR: kill → wait → spawn → warmup
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BlockCache, blockCacheKey } from "./chunker";
import { readGpuSnapshot } from "./hardware";

export const CHATTERBOX_MODEL_ID = "ResembleAI/Chatterbox-Multilingual-es-mx-latam";
export const CHATTERBOX_MODEL_REVISION = "t3_es_mx_latam";
export const DEFAULT_GEN_SETTINGS = { exaggeration: 0.5, temperature: 0.8, cfgWeight: 0.5 };

export interface EngineGenerateResult {
  ok: boolean;
  id: string;
  voice: string;
  path?: string;
  gen_s?: number;
  dur_s?: number | null;
  rtf?: number;
  vram_before_mb?: number;
  vram_after_mb?: number;
  vram_peak_mb?: number;
  ram_used_gb?: number;
  gpu_temp_c?: number | null;
  error?: string;
  gpu_low_vram?: boolean;
  fromCache?: boolean;
  trace?: string;
}

export interface EngineStatus {
  loaded: boolean;
  device: string;
  cuda: boolean;
  gpu: string | null;
  vramTotalMb: number | null;
  torch: string | null;
  python: string | null;
  lastError: string | null;
  sessionsGenerated: number;
  peakVramMb: number;
  ramUsedGb: number;
  gpuTempC: number | null;
}

export interface EngineJob {
  id: string;
  text: string;
  voice: string;
  voiceProfileId?: string;
  referenceAudioSha256?: string;
  voiceSourceId?: string;
  modelRevision?: string;
  seed?: number | null;
  generationSettings?: Record<string, unknown>;
  cacheKey: string;
  resolve: (r: EngineGenerateResult) => void;
}

interface Pending {
  [jobId: string]: (r: EngineGenerateResult) => void;
}

export class ChatterboxEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending: Pending = {};
  private queue: EngineJob[] = [];
  private busy = false;
  private buffer = "";
  private ready = false;
  private restarting = false;
  readonly cache: BlockCache;
  cacheHits = 0;
  cacheMisses = 0;
  private blocksSinceRestart = 0;
  private consecutiveDegenerate = 0;
  private degenerateTotal = 0;
  autoRestarts = 0;
  /** Estrategia de sesión: reiniciar el modelo cada ~13 min de VOZ ACUMULADA generada
   *  (degeneración observada ~25 min continuos en GTX 1650; el reinicio cuesta ~30 s
   *  y el caché evita regenerar bloques). El watchdog de salida degenerada se conserva. */
  sessionMaxAudioSec = Number(process.env.CHATTERBOX_SESSION_MAX_AUDIO_SEC ?? 780);
  private sessionAudioDurSec = 0;
  /** umbral de salida degenerada: texto largo pero audio casi nulo */
  degenerateTextMin = 60;
  degenerateDurMaxSec = 1.0;

  constructor(
    private pythonPath: string,
    private engineScript: string,
    private stateDir: string,
    private opts: { devicePriority?: "AUTO" | "GPU" | "CPU" } = {}
  ) {
    this.cache = new BlockCache(path.join(stateDir, "cache"));
  }

  get isRunning(): boolean {
    return !!this.proc && !this.proc.killed && this.ready;
  }

  private engineDevice(): string {
    if (this.opts.devicePriority === "CPU") return "cpu";
    return "cuda";
  }

  async start(): Promise<void> {
    if (this.proc) return;
    this.restarting = false;
    this.buffer = "";
    this.pending = {};
    this.ready = false;

    this.proc = spawn(this.pythonPath, [this.engineScript], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk: string) => {
      const line = chunk.trim();
      if (line && !/(Warning|UserWarning|FutureWarning|it\/s|Sampling)/.test(line)) {
        fs.appendFileSync(path.join(this.stateDir, "engine-stderr.log"), line + "\n");
      }
    });
    this.proc.on("exit", (code) => {
      this.proc = null;
      this.ready = false;
      const err = new Error(`motor TTS terminó (código ${code})`);
      for (const resolve of Object.values(this.pending)) {
        resolve({ ok: false, id: "unknown", voice: "", error: err.message });
      }
      this.pending = {};
    });

    await this.sendWait({ op: "status" }, "status", 120000);
    this.ready = true;
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (msg.op === "status" || msg.op === "warmup" || msg.op === "result" || msg.op === "bye") {
        const resolve = this.pending[(msg.id as string) ?? (msg.op as string)];
        if (resolve) {
          delete this.pending[(msg.id as string) ?? (msg.op as string)];
          resolve(msg as unknown as EngineGenerateResult & { ok: boolean });
        }
      }
      this.onMsg(msg);
    }
  }

  private onMsg(msg: Record<string, unknown>) {
    if (msg.op === "result") {
      if (!this.restarting) {
        this.busy = false;
        this.processQueue();
      }
    }
  }

  private sendWait(msg: Record<string, unknown>, key: string, timeoutMs: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        delete this.pending[key];
        reject(new Error(`timeout esperando ${key} del motor TTS`));
      }, timeoutMs);
      this.pending[key] = (r) => {
        clearTimeout(timer);
        resolve(r as unknown as Record<string, unknown>);
      };
      this.send(msg);
    });
  }

  private send(msg: Record<string, unknown>) {
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error("motor TTS no disponible");
    }
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  private processQueue() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    const cached = this.cache.get(job.cacheKey, {
      referenceAudioSha256: job.referenceAudioSha256,
      voiceSourceId: job.voiceSourceId,
      modelRevision: job.modelRevision,
    });
    if (cached) {
      this.cacheHits++;
      job.resolve({
        ok: true,
        id: job.id,
        voice: job.voice,
        path: cached.wavPath,
        dur_s: cached.durSec ?? null,
        error: undefined,
        fromCache: true,
      });
      this.busy = false;
      this.processQueue();
      return;
    }
    this.cacheMisses++;
    this.pending[job.id] = async (r) => {
      const res = r as EngineGenerateResult;
      this.blocksSinceRestart++;
      const degenerate =
        res.ok &&
        job.text.length > this.degenerateTextMin &&
        (res.dur_s ?? 0) < this.degenerateDurMaxSec;
      if (degenerate) {
        this.degenerateTotal++;
        this.consecutiveDegenerate++;
      } else {
        this.consecutiveDegenerate = 0;
        if (res.dur_s && res.dur_s > 0) {
          this.sessionAudioDurSec += res.dur_s;
        }
      }
      if (res.ok && res.path && !degenerate) {
        this.cache.put(job.cacheKey, {
          provider: "chatterbox-local",
          model: CHATTERBOX_MODEL_ID,
          device: this.engineDevice(),
          voice: job.voice,
          voiceProfileId: job.voiceProfileId,
          referenceAudioSha256: job.referenceAudioSha256,
          voiceSourceId: job.voiceSourceId,
          modelRevision: job.modelRevision ?? CHATTERBOX_MODEL_REVISION,
          seed: job.seed,
          generationSettings: job.generationSettings ?? DEFAULT_GEN_SETTINGS,
          text: job.text,
          wavPath: res.path,
          createdAt: new Date().toISOString(),
          durSec: res.dur_s ?? undefined,
        });
      }

      const needsRestart =
        this.consecutiveDegenerate >= 3 ||
        this.sessionAudioDurSec >= this.sessionMaxAudioSec;
      if (needsRestart && !this.restarting) {
        this.busy = true;
        try {
          this.autoRestarts++;
          await this.restart();
          this.consecutiveDegenerate = 0;
          this.sessionAudioDurSec = 0;
        } catch (e) {
          fs.appendFileSync(path.join(this.stateDir, "engine-stderr.log"), `auto-restart fail: ${e}\n`);
        } finally {
          this.busy = false;
        }
      }

      if (degenerate) {
        res.error = "salida degenerada detectada (audio casi nulo) — motor reiniciado";
        res.ok = false;
      }
      job.resolve(res);
      if (!this.busy) this.processQueue();
    };
    this.send({ op: "generate", id: job.id, text: job.text, voice: job.voice });
  }

  async warmup(): Promise<{ ok: boolean; error?: string; load_s?: number }> {
    const r = await this.sendWait({ op: "warmup" }, "warmup", 600000);
    return r as unknown as { ok: boolean; error?: string; load_s?: number };
  }

  async generate(
    text: string,
    voice: string,
    opts: {
      voiceProfileId?: string;
      referenceAudioSha256?: string;
      voiceSourceId?: string;
      modelRevision?: string;
      seed?: number | null;
      generationSettings?: Record<string, unknown>;
    } = {}
  ): Promise<EngineGenerateResult> {
    const device = this.engineDevice();
    const key = await blockCacheKey({
      provider: "chatterbox-local",
      model: CHATTERBOX_MODEL_ID,
      device,
      voice,
      text,
      voiceProfileId: opts.voiceProfileId,
      referenceAudioSha256: opts.referenceAudioSha256,
      voiceSourceId: opts.voiceSourceId,
      modelRevision: opts.modelRevision ?? CHATTERBOX_MODEL_REVISION,
      seed: opts.seed,
      generationSettings: opts.generationSettings ?? DEFAULT_GEN_SETTINGS,
    });
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      this.queue.push({
        id, text, voice,
        voiceProfileId: opts.voiceProfileId,
        referenceAudioSha256: opts.referenceAudioSha256,
        voiceSourceId: opts.voiceSourceId,
        modelRevision: opts.modelRevision ?? CHATTERBOX_MODEL_REVISION,
        seed: opts.seed ?? 0,
        generationSettings: opts.generationSettings ?? DEFAULT_GEN_SETTINGS,
        cacheKey: key,
        resolve,
      });
      this.processQueue();
    });
  }

  async generateAll(blocks: Array<{ id: string; text: string; voice: string }>, onProgress?: (done: number, total: number) => void): Promise<EngineGenerateResult[]> {
    const results: EngineGenerateResult[] = [];
    let done = 0;
    for (const b of blocks) {
      results.push(await this.generate(b.text, b.voice));
      done++;
      onProgress?.(done, blocks.length);
    }
    return results;
  }

  async status(): Promise<EngineStatus> {
    const r = (await this.sendWait({ op: "status" }, "status", 60000)) as unknown as Record<string, unknown> & EngineStatus;
    return {
      loaded: !!r.loaded,
      device: String(r.device ?? "n/a"),
      cuda: !!r.cuda,
      gpu: (r.gpu as string) ?? null,
      vramTotalMb: (r.vram_total_mb as number) ?? null,
      torch: (r.torch as string) ?? null,
      python: (r.python as string) ?? null,
      lastError: (r.last_error as string) ?? null,
      sessionsGenerated: (r.sessions_generated as number) ?? 0,
      peakVramMb: (r.peak_vram_mb as number) ?? 0,
      ramUsedGb: (r.ram_used_gb as number) ?? 0,
      gpuTempC: (r.gpu_temp_c as number) ?? null,
    };
  }

  async restart(): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;
    await this.shutdown();
    this.start();
    await this.warmup();
    this.restarting = false;
  }

  async shutdown(): Promise<void> {
    if (!this.proc) return;
    const p = this.proc;
    try {
      p.stdin.write('{"op":"shutdown"}\n');
      await new Promise((r) => setTimeout(r, 3000));
    } catch { /* noop */ }
    if (!p.killed) {
      p.kill();
    }
    await new Promise((r) => setTimeout(r, 1000));
    this.proc = null;
    this.ready = false;
  }

  async vramGuardSnapshot(): Promise<{ used: number | null; total: number | null; free: number | null; temp: number | null }> {
    const g = await readGpuSnapshot();
    return { used: g.vramUsedMb, total: g.vramTotalMb, free: g.vramFreeMb, temp: g.tempC };
  }
}
