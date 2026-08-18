/**
 * Regenera SOLO la voz de Eduardo con el casting aprobado y remasteriza.
 * - EpisodeVoiceLock persistido.
 * - Eduardo (builtin aprobado) → STALE_VOICE → se regenera.
 * - Andrea / Narrador → CACHE_VALID → no se tocan.
 * - Mismo guion (determinista, mismo Evidence Pack), mismas cortinillas/música.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE = "http://127.0.0.1:3977";
const REPO = path.resolve(__dirname, "../../../..");
const CAST = path.join(REPO, "data", "tts", "casting");
const BUILTIN_SHA = createHash("sha256").update("chatterbox:builtin-multilingual").digest("hex");
const ANDREA_SHA = createHash("sha256").update(fs.readFileSync(path.join(REPO, "data", "tts", "ref", "mariana.wav"))).digest("hex");

async function post<T>(p: string, body: unknown, timeoutMs = 600000): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
async function get<T>(p: string): Promise<T> {
  const r = await fetch(`${BASE}${p}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Turno { id: string; speaker: string; text: string; pauseBeforeMs: number; pauseAfterMs: number; canOverlap: boolean; transition: string | null }
interface Progress { running: boolean; done: number; total: number; cacheHits: number; generados: number; fallos: number; estado: string | null }

async function main() {
  // 1. EpisodeVoiceLock
  const lock = {
    episodeId: `ep-${Date.now()}`,
    cutoff: "2026-08-14",
    createdAt: new Date().toISOString(),
    voces: {
      eduardo: { voiceProfileId: "EDUARDO", referenceAudioSha256: BUILTIN_SHA, voiceSourceId: "chatterbox:builtin-multilingual", provider: "chatterbox-local", model: "chatterbox-latam", revision: "t3_es_mx_latam", aprobada: true },
      andrea: { voiceProfileId: "ANDREA", referenceAudioSha256: ANDREA_SHA, voiceSourceId: "piper:rhasspy/es_MX-claude-high", provider: "chatterbox-local", model: "chatterbox-latam", revision: "t3_es_mx_latam", aprobada: true },
    },
  };
  fs.writeFileSync(path.join(CAST, "episode-voice-lock.json"), JSON.stringify(lock, null, 2));
  console.log("[casting] EpisodeVoiceLock guardado");

  // 2. Reconstruir guion (determinista, mismo Evidence Pack)
  const d = await post<{ script: { turns: Turno[]; speakers: Array<{ id: string; voz: string }>; estimacionDurSec: number }; diversity: { score: number } }>(
    "/director", { tema: "Tiempo extraordinario en el IMSS", duracionMin: 25, nivel: "natural", modoCita: "natural", modo: "determinista" }, 120000
  );
  const turns = d.script.turns;
  console.log(`[casting] guion reconstruido: ${turns.length} turnos (~${Math.round(d.script.estimacionDurSec / 60)} min), diversidad ${d.diversity.score}`);

  // 3. Generar con worker (Eduardo regenera; Andrea/Narrador cache)
  const voces: Record<string, string> = {};
  for (const s of d.script.speakers) voces[s.id] = s.voz;
  await post("/generate", { tema: "Tiempo extraordinario en el IMSS", bloques: turns.map((t) => ({ id: t.id, texto: t.text, locutor: t.speaker })), voces }, 30000);
  console.log("[casting] producción iniciada…");

  let last = 0;
  while (true) {
    await sleep(20000);
    const p = await get<Progress>("/progress");
    if (p.done !== last) {
      console.log(`[casting] ${p.done}/${p.total} · cache=${p.cacheHits} generados=${p.generados} fallos=${p.fallos} estado=${p.estado}`);
      last = p.done;
    }
    if (!p.running && p.total > 0 && p.done >= p.total) break;
    if (!p.running && p.total > 0 && p.estado === "DONE") break;
  }
  const pf = await get<Progress>("/progress");
  console.log(`[casting] terminado: done=${pf.done}/${pf.total} cache=${pf.cacheHits} regenerados=${pf.generados} fallos=${pf.fallos}`);

  // 4. Remaster 192 kbps
  console.log("[casting] remasterizando…");
  const m = await post<{ master: string; bytes: number; duracionTotalMs: number; cortinillas: number; kbps: number | null }>(
    "/master", { turns, voces, bed: "auto", jingle: "auto", kbps: 192, formato: "mp3" }, 900000
  );

  const report = {
    lock,
    turnos: turns.length,
    regenerados: pf.generados,
    cacheHits: pf.cacheHits,
    fallos: pf.fallos,
    master: m.master,
    bytes: m.bytes,
    duracionMs: m.duracionTotalMs,
    cortinillas: m.cortinillas,
    kbps: m.kbps,
  };
  fs.writeFileSync(path.join(CAST, "regeneracion-eduardo-report.json"), JSON.stringify(report, null, 2));
  console.log("[casting] MASTER:", m.master);
  console.log(JSON.stringify({ regenerados: pf.generados, cacheHits: pf.cacheHits, fallos: pf.fallos, masterMin: Math.round(m.duracionTotalMs / 60000 * 10) / 10 }));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
