import fs from "node:fs";
import path from "node:path";
import { ChatterboxEngine } from "../services/tts-chatterbox/engine";
import { sentenceAwareChunk } from "../services/tts-chatterbox/chunker";
import { cleanTtsText } from "../services/tts";
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function findFfmpeg(): Promise<string> {
  const candidates = ["ffmpeg", path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe")];
  for (const c of candidates) {
    try {
      await execFileAsync(c, ["-version"], { timeout: 10000 });
      return c;
    } catch { /* probar */ }
  }
  throw new Error("ffmpeg no disponible");
}

async function main() {
  const REPO = process.cwd();
  const STATE = path.join(REPO, "data", "tts");
  const PYTHON = path.join(STATE, "venv", "Scripts", "python.exe");
  const ENGINE_SCRIPT = path.join(REPO, "src", "features", "normativa", "services", "tts-chatterbox", "engine.py");

  const pilotosDir = path.join(REPO, "data", "normativa", "pilotos");
  const pilotoFile = fs.readdirSync(pilotosDir).find((f) => f.startsWith("tiempo-extraordinario") && f.endsWith(".json"));
  if (!pilotoFile) throw new Error("no se encontró el piloto de tiempo extraordinario");
  const piloto = JSON.parse(fs.readFileSync(path.join(pilotosDir, pilotoFile), "utf8"));
  const escenas = piloto.guion.escenas as Array<{ locutor: string; linea: string; citas: string[] }>;

  const engine = new ChatterboxEngine(PYTHON, ENGINE_SCRIPT, STATE);
  await engine.start();
  const warmup = await engine.warmup();
  console.log(JSON.stringify({ warmup }));

  const t0 = Date.now();
  const wavs: string[] = [];
  let blocks = 0;
  let cacheHits = 0;
  let generated = 0;
  const errors: string[] = [];

  for (const s of escenas) {
    const chunks = sentenceAwareChunk(cleanTtsText(s.linea), 120, 220);
    for (const c of chunks) {
      const r = await engine.generate(c, s.locutor.toUpperCase().includes("MARIANA") ? "B" : "A");
      blocks++;
      if (r.ok && r.path) {
        wavs.push(r.path);
        if (r.fromCache) cacheHits++;
        else generated++;
      } else {
        errors.push(`${blocks}: ${r.error ?? "fallo"}${r.trace ? "\n" + r.trace.split("\n").slice(1, 6).join("\n") : ""}`);
      }
    }
  }

  const genTimeSec = Math.round((Date.now() - t0) / 1000);
  const st = await engine.status();

  const ffmpeg = await findFfmpeg();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lv-pilot-"));
  const list = path.join(tmp, "list.txt");
  fs.writeFileSync(list, wavs.map((w) => `file '${w.replace(/'/g, "'\\''")}'`).join("\n"));
  const outMp3 = path.join(STATE, "piloto-chatterbox-tiempo-extraordinario.mp3");
  await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-codec:a", "libmp3lame", "-b:a", "128k", outMp3], { timeout: 300000 });
  fs.rmSync(tmp, { recursive: true, force: true });

  const report = {
    provider: "chatterbox-local",
    model: "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
    device: "cuda",
    piloto: piloto.tema ?? "Tiempo extraordinario en el IMSS",
    speechBlocks: blocks,
    cacheHits,
    generated,
    errors,
    genTimeSec,
    engine: { peakVramMb: st.peakVramMb, ramUsedGb: st.ramUsedGb, sessionsGenerated: st.sessionsGenerated },
    mp3: outMp3,
    mp3Bytes: fs.statSync(outMp3).size,
  };
  fs.writeFileSync(path.join(STATE, "chatterbox-piloto-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await engine.shutdown();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
