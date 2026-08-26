/**
 * Preview de casting: genera una muestra por personaje oficial
 * con el MISMO texto con Qwen Base (render.py) y voces registradas.
 */
import fs from "node:fs";
import path from "node:path";
import { QwenEngine, cleanTtsText } from "@la-veinte/tts-core";

const REPO = path.resolve(__dirname, "../../../..");
const STATE = path.join(REPO, "data", "tts");
const OUT_DIR = path.join(STATE, "casting");
const WAV_PATH = path.join(REPO, "packages", "tts-core", "qwen", "render.py");

const TEST_TEXT_V2 =
  "Bienvenidos a La Veinte Radio. Hoy vamos a explicar de manera sencilla un tema que genera muchas dudas entre los trabajadores del IMSS.";

const refs: Record<string, string> = {
  A: "EDUARDO",
  B: "ANDREA",
  N: "JAVIER",
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const engine = new QwenEngine(process.cwd(), WAV_PATH, STATE);
  await engine.start();
  const warmup = await engine.warmup();
  console.log("warmup:", warmup.ok);
  if (!warmup.ok) process.exit(2);

  const report: Record<string, unknown> = {};
  for (const [slot, speaker] of Object.entries(refs)) {
    const outFile = path.join(OUT_DIR, `voice-test-${speaker.toLowerCase()}-v2.wav`);
    fs.rmSync(outFile, { force: true });
    const r2 = await engine.generate(cleanTtsText(TEST_TEXT_V2), slot);
    if (r2.ok && r2.path) {
      fs.copyFileSync(r2.path, outFile);
      report[speaker] = { slot, speaker, voiceSourceId: "qwen:base-clone", wav: outFile, durSec: r2.dur_s };
      console.log(`${speaker}: ${outFile} (${r2.dur_s}s)`);
    } else {
      report[speaker] = { error: r2.error };
      console.log(`${speaker}: ERROR ${r2.error}`);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "casting-preview-v2-report.json"), JSON.stringify(report, null, 2));
  await engine.shutdown();
  console.log("reporte:", path.join(OUT_DIR, "casting-preview-v2-report.json"));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
