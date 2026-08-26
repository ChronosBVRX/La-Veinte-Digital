import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface QwenEnv {
  python?: string;
  renderPy?: string;
  ckpt?: string;
  language?: string;
}

/**
 * Resuelve rutas del motor Qwen en RUNTIME desde `data/tts/qwen-env.json`
 * (o la env QWEN_PYTHON). NO se usan literales de ruta con symlinks en el módulo:
 * Turbopack panica si un literal apunta a un symlink que sale de la raíz del repo.
 */
export function qwenEnv(repo: string): Required<QwenEnv> {
  const settingsPath = path.join(repo, "data", "tts", "qwen-env.json");
  let file: QwenEnv = {};
  try {
    file = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    /* sin settings: usar defaults */
  }
  return {
    python: process.env.QWEN_PYTHON || file.python || "python3",
    renderPy: file.renderPy || path.join(repo, "packages", "tts-core", "qwen", "render.py"),
    ckpt: file.ckpt || "data/tts/ckpts/output_06052026_120000_12HZ_36L_1.7B.pt",
    language: file.language || "Spanish",
  };
}

export function killProcessGroupUnblocking(pid: number, killAfterMs: number, killSig: "SIGKILL" | "SIGTERM"): void {
  try {
    try { process.kill(-pid, killSig); } catch {}
    setTimeout(() => {
      try {
        execSync(`ps -p ${pid} >/dev/null 2>&1 && kill -KILL -${pid} 2>/dev/null || true`);
      } catch { /* ya fue } */ }
    }, killAfterMs);
  } catch {
    /* sin grupo */
  }
}
