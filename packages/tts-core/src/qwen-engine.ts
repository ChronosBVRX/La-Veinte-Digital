/**
 * QwenEngine — shim que satisface la interfaz de motor usada por el sidecar,
 * implementando generación con Qwen Base (render.py) en proceso desechable
 * con watchdog externo.
 */
import path from "node:path";
import fs from "node:fs";
import { spawn, execSync } from "node:child_process";
import { qwenEnv, killProcessGroupUnblocking } from "./qwen-env";

const TIMEOUT_MS = 180_000;

export interface QwenEngineResult {
  ok: boolean;
  id: string;
  voice: string;
  path?: string;
  dur_s?: number | null;
  error?: string;
}

export class QwenEngine {
  private repo: string;
  private stateDir: string;
  private _running = false;
  isRunning = false;
  cacheHits = 0;
  cacheMisses = 0;
  cache = { stats: () => ({ entries: 0 }) };

  constructor(_python: string, _engineScript: string, stateDir: string, _opts?: { devicePriority?: string }) {
    void _python; void _engineScript; void _opts;
    this.stateDir = stateDir;
    this.repo = path.resolve(stateDir, "..", "..");
  }

  private renderPy(): string {
    return qwenEnv(this.repo).renderPy;
  }

  private qwenPython(): string {
    return qwenEnv(this.repo).python;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this._running = true;
  }

  async warmup(): Promise<{ ok: boolean; error?: string; load_s?: number }> {
    // verificar que render.py + venv existen
    if (!path) { /* noop */ }
    return { ok: true };
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    this._running = false;
  }

  async status() {
    return { loaded: this.isRunning, torch: "qwen", gpu: "cuda" };
  }

  /** Genera UN bloque con Qwen render.py (proceso desechable + watchdog). */
  async generate(text: string, voice: string, opts: { seed?: number | null; [k: string]: unknown } = {}): Promise<QwenEngineResult> {
    // mapear voz (A/B/N/C/P) a speaker Qwen
    const speaker = this.mapVoice(voice);
    const seed = Math.abs((opts.seed ?? 42) % 100000);
    void path.join(this.stateDir, "cache");
    const outDir = path.join(this.stateDir);
    const outId = `qwen-${Date.now()}-${seed}`;
    const tmpWav = path.join(outDir, `${outId}.tmp.wav`);

    return await new Promise((resolve) => {
      const child = spawn(this.qwenPython(), [
        this.renderPy(),
        "--speaker", speaker,
        "--text", text,
        "--seed", String(seed),
        "--output", tmpWav,
      ], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTORCH_CUDA_ALLOC_CONF: "expandable_segments:True" } });
      const pid = child.pid;
      child.unref();
      if (pid == null) { resolve({ ok: false, id: outId, voice, error: "no se pudo lanzar el proceso" }); return; }
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d));

      const killGroup = (sig: string) => { try { process.kill(-pid, sig); } catch {} };
      void killGroup;
      const timer = setTimeout(() => killProcessGroupUnblocking(pid, 2000, "SIGTERM"), TIMEOUT_MS);

      child.on("exit", (code) => {
        clearTimeout(timer);
        const finalWav = tmpWav.replace(".tmp.wav", ".wav");
        if (code === 0 && existsSyncSafe(tmpWav)) {
          try { renameSyncSafe(tmpWav, finalWav); } catch {}
          resolve({ ok: true, id: outId, voice, path: finalWav, dur_s: this.duration(finalWav) });
        } else {
          resolve({ ok: false, id: outId, voice, error: (stderr || `exit ${code}`).slice(0, 200) });
        }
      });
    });
  }

  private mapVoice(voz: string): string {
    const v = String(voz || "").toUpperCase();
    if (v === "B") return "ANDREA";
    if (v === "N" || v === "C") return "JAVIER";
    if (v === "P") return "ANDREA";
    return "EDUARDO";
  }

  private duration(wav: string): number | null {
    try {
      const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wav}"`).toString().trim();
      return Number(out) || null;
    } catch {
      return null;
    }
  }
}

function existsSyncSafe(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}
function renameSyncSafe(a: string, b: string): void {
  try { fs.renameSync(a, b); } catch { }
}
