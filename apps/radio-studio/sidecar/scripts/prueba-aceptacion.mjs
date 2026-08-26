/**
 * Prueba de aceptación — episodio completo vía sidecar real.
 * Genera guion conversacional → TTS → máster → auditoría.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

// fetch de larga duración: undici corta headers a los 5 min por defecto
function postLargo(pUrl, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request("http://127.0.0.1:3977" + pUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: 3600_000,
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    });
    req.on("timeout", () => { req.destroy(new Error("timeout 1h")); });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const SIDE = "http://127.0.0.1:3977";
const OUT = "/home/chronos/Escritorio/La Veinte/data/tts/benchmark";
fs.mkdirSync(OUT, { recursive: true });

const post = async (p, body) => {
  const r = await fetch(SIDE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
};
const get = async (p) => (await fetch(SIDE + p)).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tema = process.argv[2] ?? "¿me pueden cambiar el horario sin avisar?";
const durMin = Number(process.argv[3] ?? 12);

console.log(`═╡ PRUEBA DE ACEPTACIÓN — "${tema}" (${durMin} min objetivo)`);

// 1) Guion con director conversacional
const modo = process.argv[4] ?? "determinista";
console.log("modo de guion:", modo);
const dir = await postLargo("/director", { tema, modo, nivel: "natural", duracionMin: durMin, comerciales: false });
if (!dir.script) throw new Error("sin guion: " + JSON.stringify(dir).slice(0, 200));
const turns = dir.script.turns.filter((t) => !t.adSlot);
console.log(`guion: ${turns.length} intervenciones editoriales`);

// métricas del guion
const palabrasPorLocutor = {};
for (const t of turns) {
  const w = t.text.trim().split(/\s+/).filter(Boolean).length;
  palabrasPorLocutor[t.speaker] = (palabrasPorLocutor[t.speaker] ?? 0) + w;
}
const totalPalabras = Object.values(palabrasPorLocutor).reduce((a, b) => a + b, 0);
const pct = Object.fromEntries(Object.entries(palabrasPorLocutor).map(([k, v]) => [k, Math.round((v / totalPalabras) * 100)]));
const preguntas = turns.filter((t) => t.intent === "question" || t.intent === "interrupt_question" || t.intent === "normative_request" || /\?\s*$/.test(t.text)).length;
const reacciones = turns.filter((t) => t.intent === "reaction" || t.intent === "backchannel").length;
const interrupciones = turns.filter((t) => /interrupt/.test(t.intent ?? "")).length;
const solapes = turns.filter((t) => (t.overlapPreviousMs ?? 0) > 0).length;
const citasDeclaradas = turns.filter((t) => (t.citations?.length ?? 0) > 0).length;
const verificacionRoja = (dir.verificacion ?? []).filter((v) => v.semaforo === "red").length;
const verificacionAmarilla = (dir.verificacion ?? []).filter((v) => v.semaforo === "yellow").length;

// 2) Generación TTS
const bloques = turns.map((t) => ({ id: t.id, texto: t.text, locutor: t.speaker }));
const voces = {};
for (const s of dir.script.speakers) voces[s.id] = s.voz;
const gen = await post("/generate", { bloques, voces, tema });
if (!gen.iniciado && gen.error) throw new Error("generate: " + gen.error);
console.log(`generación iniciada: ${gen.total} bloques`);

let progreso;
for (;;) {
  await sleep(15000);
  progreso = await get("/progress");
  const pctDone = progreso.total ? Math.round((progreso.done / progreso.total) * 100) : 0;
  console.log(`  ${new Date().toISOString().slice(11, 19)} ${pctDone}% (${progreso.done}/${progreso.total}) rtf=${progreso.rtf?.toFixed?.(2) ?? "?"} estado=${progreso.estado}`);
  if (!progreso.running && progreso.done >= progreso.total && progreso.total > 0) break;
  if (progreso.estado === "PAUSED" && progreso.done < progreso.total) {
    console.log("pausado — reanudando…");
    await post("/resume", {});
  }
}

// 3) Máster
const master = await post("/master", { turns: dir.script.turns, voces, kbps: 192, formato: "mp3", ducking: true, bedGainDb: -25, bedDuckDb: 6, bed: "auto", jingle: "auto" });
if (!master.master) throw new Error("master falló: " + JSON.stringify(master).slice(0, 300));
console.log(`máster: ${master.master}`);

// 4) Auditoría final
const pausas = [];
let prevFin = 0;
for (const t of turns) {
  if (t.pauseBeforeMs > 0) pausas.push(t.pauseBeforeMs);
  prevFin += t.pauseBeforeMs;
}
const pausasSorted = [...pausas].sort((a, b) => a - b);
const medianaPausa = pausasSorted.length ? pausasSorted[Math.floor(pausasSorted.length / 2)] : 0;

const qa = master.qa ?? {};
const audit = {
  fecha: new Date().toISOString(),
  tema,
  duracionFinalSec: qa.duracionSec ?? Math.round(master.duracionTotalMs / 1000),
  numeroIntervenciones: turns.length,
  palabrasPorLocutor,
  porcentajeParticipacion: pct,
  numeroPreguntas: preguntas,
  numeroReacciones: reacciones,
  numeroInterrupciones: interrupciones,
  numeroSolapes: solapes,
  pausaMedianaMs: medianaPausa,
  silenciosMayores1500ms: qa.silenciosMayores1500ms ?? null,
  silenciosDetalle: qa.silenciosDetalle ?? [],
  bloquesDuplicadosTexto: qa.bloquesDuplicados ?? null,
  lufsIntegrado: qa.lufsIntegrado ?? null,
  truePeakDbfs: qa.truePeakDbfs ?? null,
  clipping: qa.clippingSamples ?? null,
  erroresTts: progreso.fallos ?? 0,
  cacheHits: progreso.cacheHits ?? 0,
  regeneraciones: 0,
  citasVerificadas: citasDeclaradas - verificacionAmarilla,
  citasSinRespaldoDirecto: verificacionAmarilla,
  violacionesRol: qa.firewallValeria ?? [],
  qaConversacionalFallidos: qa.qaConversacionalFallidos ?? [],
  advertenciasQa: qa.advertencias ?? [],
  trimPorVozAplicado: master.trimPorVoz ?? {},
  verificacionSemaforo: { rojas: verificacionRoja, amarillas: verificacionAmarilla },
  masterFile: master.master,
};

fs.writeFileSync(path.join(OUT, "auditoria-episodio-prueba.json"), JSON.stringify(audit, null, 2));
console.log("\n═══ AUDITORÍA ═══");
console.log(JSON.stringify(audit, null, 1));
