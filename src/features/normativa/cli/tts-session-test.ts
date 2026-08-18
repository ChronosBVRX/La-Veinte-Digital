import path from "node:path";
import { ChatterboxEngine } from "@la-veinte/tts-core";

const REPO = process.cwd();
const STATE = path.join(REPO, "data", "tts");
const PYTHON = path.join(STATE, "venv", "Scripts", "python.exe");
const ENGINE_SCRIPT = path.join(REPO, "packages", "tts-core", "engine", "chatterbox_engine.py");

const SENTENCES = [
  "Primera frase de prueba para la sesión de reinicio programado.",
  "Segunda frase que acumula audio para llegar al umbral de sesión.",
  "Tercera frase con contenido suficiente para el test de estabilidad.",
  "Cuarta frase que sigue acumulando voz en el motor local.",
  "Quinta frase para cruzar el umbral de reinicio automático.",
  "Sexta frase después del reinicio, debe sonar normal.",
  "Séptima frase de verificación post reinicio del modelo.",
  "Octava frase final para confirmar continuidad sin errores.",
];

async function main() {
  const engine = new ChatterboxEngine(PYTHON, ENGINE_SCRIPT, STATE);
  engine.sessionMaxAudioSec = Number(process.env.SESSION_MAX ?? 30);
  await engine.start();
  const warmup = await engine.warmup();
  console.log(JSON.stringify({ warmupOk: warmup.ok, sessionMaxAudioSec: engine.sessionMaxAudioSec }));

  const results: string[] = [];
  for (let i = 0; i < SENTENCES.length; i++) {
    const r = await engine.generate(SENTENCES[i] + ` [run${process.pid}]`, i % 2 === 0 ? "A" : "B");
    results.push(`bloque ${i + 1}: ok=${r.ok} dur=${r.dur_s ?? "-"}s gen=${r.gen_s ?? "-"}s ${r.error ?? ""}${r.fromCache ? " (cache)" : ""}`);
    console.log(results[results.length - 1]);
  }

  console.log(JSON.stringify({ autoRestarts: engine.autoRestarts, cacheHits: engine.cacheHits, errors: results.filter((r) => r.includes("ok=false")).length }));
  await engine.shutdown();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
