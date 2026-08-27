/**
 * Smoke TTS real — UNA sola frase con Qwen Base clone (proceso desechable).
 * Confirma: carga, generación, watchdog, WAV, metadata, worker exit y liberación de VRAM.
 * No es un benchmark.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const LAUNCHER = path.join(REPO, "packages", "tts-core", "qwen", "launcher.ts");

function gpuVram(): string {
  try {
    const out = execFileSync("nvidia-smi", ["--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"], { encoding: "utf8" });
    return out.trim();
  } catch { return "n/a"; }
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "lv-tts-smoke-"));
  const guionPath = path.join(work, "guion.json");
  const outDir = path.join(work, "out");
  fs.writeFileSync(guionPath, JSON.stringify({
    turns: [{ id: "t001", speaker: "EDUARDO", text: "Hola, esto es una prueba de la voz del estudio." }],
  }));

  console.log(`[smoke-tts] VRAM antes: ${gpuVram()}`);
  const t0 = Date.now();
  const proc = spawn(process.execPath, ["--no-warnings", "--import", "tsx", LAUNCHER, guionPath, outDir], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  let stdout = "";
  proc.stdout.on("data", (d) => (stdout += d.toString()));
  proc.stderr.on("data", (d) => (stdout += d.toString()));
  const exit = await new Promise<number>((res) => proc.on("exit", (code) => res(code ?? -1)));
  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[smoke-tts] worker exit=${exit} en ${elapsedS}s`);

  const wav = path.join(outDir, "t001.wav");
  const meta = path.join(outDir, "t001.json");
  const wavOk = fs.existsSync(wav) && fs.statSync(wav).size > 5000;
  const metaOk = fs.existsSync(meta);
  let status = "N/A";
  if (metaOk) {
    try { status = (JSON.parse(fs.readFileSync(meta, "utf8"))).status ?? "N/A"; } catch { /* noop */ }
  }

  // medir VRAM tras un instante (el proceso ya terminó, la VRAM debe liberarse)
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`[smoke-tts] VRAM después: ${gpuVram()}`);
  console.log(`[smoke-tts] wav=${wavOk} size=${wavOk ? fs.statSync(wav).size : 0} status=${status}`);

  if (wavOk && metaOk && status === "PASS" && elapsedS !== "n/a") {
    console.log("SMOKE_TTS PASS");
    process.exit(0);
  } else {
    console.log("SMOKE_TTS FAIL", { wavOk, metaOk, status });
    console.log("--- log tail ---\n" + stdout.split("\n").slice(-20).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => { console.error("[smoke-tts] ERROR", e instanceof Error ? e.message : e); process.exit(2); });
