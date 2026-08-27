import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { qwenEnv } from "./qwen-env";

const REPO = path.resolve(process.cwd());
export const RENDER_PY = qwenEnv(REPO).renderPy;
export const QWEN_PYTHON = qwenEnv(REPO).python;
const TIMEOUT_MS = 300_000;

const VOICE_MAP: Record<string, string> = {
  EDUARDO: "EDUARDO",
  MARIANA: "ANDREA",
  ANDREA: "ANDREA",
};

export function mapWebVoice(locutor: string): string {
  return VOICE_MAP[locutor.toUpperCase()] || "EDUARDO";
}

/** Genera UN fragmento con Qwen render.py en proceso desechable + watchdog. */
export function qwenRenderLine(text: string, locutor: string, seed: number): Promise<string> {
  return new Promise((resolve) => {
    const speaker = mapWebVoice(locutor);
    const tmpDir = path.join(REPO, "data", "tts", "cache");
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpWav = path.join(tmpDir, `web-${Date.now()}-${seed}.tmp.wav`);

    const child = spawn(QWEN_PYTHON, [
      RENDER_PY, "--speaker", speaker, "--text", text, "--seed", String(seed), "--output", tmpWav,
    ], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTORCH_CUDA_ALLOC_CONF: "expandable_segments:True" } });
    const pid = child.pid;
    child.unref();
    if (pid == null) { resolve(""); return; }

    const killGroup = (sig: string) => { try { process.kill(-pid, sig); } catch {} };
    const timer = setTimeout(() => {
      killGroup("SIGTERM");
      setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch {} }, 2000);
    }, TIMEOUT_MS);

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tmpWav)) {
        const final = path.join(tmpDir, `web-${Date.now()}-${seed}.wav`);
        fs.renameSync(tmpWav, final);
        resolve(final);
      } else {
        resolve("");
      }
    });
  });
}
