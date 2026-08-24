/**
 * Itera P6→P7 sobre artefactos existentes SIN TTS — ciclo rápido de naturalidad.
 * Uso: node --import tsx scripts/iterar-guion.ts <episodioId>
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const ep = process.argv[2];
if (!ep) { console.error("uso: iterar-guion.ts <episodeId>"); process.exit(1); }

import { conversationQualityScore, auditConversation } from "@la-veinte/radio-core";
import { cargarArtefactos, ScriptPipeline } from "../src/llm/pipeline";

async function main() {
const dir = path.join(REPO, "data", "tts", "episodes", ep);
const previo = cargarArtefactos(dir);
if (!previo) { console.error("no hay artefactos en", dir); process.exit(1); }

// reconstruir evidence pack del artefacto
const packRaw = JSON.parse(fs.readFileSync(path.join(dir, "00-evidence-pack.json"), "utf8"));

const pipeline = new ScriptPipeline();
const resultado = await pipeline.run({
  tema: packRaw.topic,
  duracionMin: 10,
  speakers: [],
  nivel: "natural",
  claims: [],
  cutoff: packRaw.cutoff,
  fuentes: packRaw.documents ?? [],
  modoCita: "natural",
  evidencePack: packRaw,
  artifactsDir: dir,
});

const qa = auditConversation(resultado.turns);
const scoreDet = conversationQualityScore(resultado.turns);
console.log("\n═══ RESULTADO ITERACIÓN ═══");
console.log("score crítico:", resultado.scoreFinal);
console.log("score determinista:", scoreDet.score, "| aprobarGeneración:", scoreDet.aprobarGeneracion);
console.log("issues determinista:", scoreDet.issues);
for (const q of qa) if (!q.pass) console.log("QA FAIL:", q.check, "—", q.detalle);
fs.writeFileSync(path.join(dir, "guion-iterado.json"), JSON.stringify({ turns: resultado.turns, scoreFinal: resultado.scoreFinal }, null, 1));
console.log("guion iterado →", path.join(dir, "guion-iterado.json"));
}

main().catch((e) => { console.error("FATAL:", e.message ?? e); process.exit(1); });
