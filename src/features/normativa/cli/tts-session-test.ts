import path from "node:path";
import { QwenEngine } from "@la-veinte/tts-core";

const REPO = process.cwd();
const STATE = path.join(REPO, "data", "tts");

const SENTENCES = [
  "Primera frase de prueba para la generación por proceso desechable.",
  "Segunda frase que acumula audio para cubrir un bloque completo.",
  "Tercera frase con contenido suficiente para el test de estabilidad.",
  "Cuarta frase que sigue cubriendo voz en el motor local.",
  "Quinta frase para cubrir el watchdog del proceso de generación.",
  "Sexta frase después del watchdog, debe sonar normal.",
  "Séptima frase de verificación post timeout del modelo.",
  "Octava frase final para confirmar continuidad sin errores.",
];

async function main() {
  const engine = new QwenEngine(REPO, "", STATE);
  await engine.start();
  const warmup = await engine.warmup();
  console.log(JSON.stringify({ warmupOk: warmup.ok, provider: "qwen-base-clone" }));

  const results: string[] = [];
  for (let i = 0; i < SENTENCES.length; i++) {
    const r = await engine.generate(SENTENCES[i] + ` [run${process.pid}]`, i % 2 === 0 ? "A" : "B", { seed: i });
    results.push(`bloque ${i + 1}: ok=${r.ok} dur=${r.dur_s ?? "-"}s ${r.error ?? ""}`);
    console.log(results[results.length - 1]);
  }

  console.log(JSON.stringify({ errors: results.filter((r) => r.includes("ok=false")).length }));
  await engine.shutdown();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
