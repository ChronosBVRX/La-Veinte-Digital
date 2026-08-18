/**
 * Regenera el baseline-director-ai con el fix de identidad vocal (builtin A).
 * Usa el guion IA guardado; los bloques B/N salen de caché, A se regenera.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3977";
const REPO = path.resolve(__dirname, "../../../..");

async function post<T>(p: string, body: unknown, timeoutMs = 600000): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
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

interface Progress { running: boolean; done: number; total: number; cacheHits: number; generados: number; fallos: number; estado: string | null }
interface Turno { id: string; speaker: string; text: string; pauseBeforeMs: number; pauseAfterMs: number; canOverlap: boolean; transition: string | null }

async function main() {
  const g = JSON.parse(fs.readFileSync(path.join(REPO, "data", "tts", "scripts", "guion-ia-tiempo-extra.json"), "utf8"));
  const turns: Turno[] = g.turns;
  const voces: Record<string, string> = {};
  for (const s of g.speakers) voces[s.id] = s.voz;
  console.log(`[regen] guion ${turns.length} turnos | voces ${JSON.stringify(voces)}`);

  // 1. Generar voces (A se regenera por el fix; B/N en caché)
  console.log("[regen] generando voces…");
  await post("/generate", { tema: "Tiempo extraordinario en el IMSS", bloques: turns.map((t, i) => ({ id: t.id, texto: t.text, locutor: t.speaker })), voces }, 30000);
  let last = 0;
  while (true) {
    await sleep(15000);
    const p = await get<Progress>("/progress");
    if (p.done !== last) { console.log(`[regen] ${p.done}/${p.total} cache=${p.cacheHits} gen=${p.generados} fallos=${p.fallos}`); last = p.done; }
    if (p.running === false && p.total > 0 && (p.done >= p.total || p.estado === "DONE")) break;
  }
  const pf = await get<Progress>("/progress");
  if (pf.fallos > 0) throw new Error(`${pf.fallos} fallos en generación`);
  console.log(`[regen] voces listas: ${pf.done}/${pf.total} (cache=${pf.cacheHits}, gen=${pf.generados})`);

  // 2. Remaster
  console.log("[regen] remasterizando…");
  const m = await post<{ master: string; bytes: number; duracionTotalMs: number; cortinillas: number; kbps: number | null }>(
    "/master", { turns, voces, bed: "auto", jingle: "auto", kbps: 192, formato: "mp3" }, 900000
  );
  fs.writeFileSync(path.join(REPO, "data", "tts", "casting", "baseline-director-ai-report.json"),
    JSON.stringify({ modo: "ia", turnos: turns.length, master: m.master, bytes: m.bytes, duracionMs: m.duracionTotalMs, cortinillas: m.cortinillas, kbps: m.kbps, fixVoz: "builtin-restore" }, null, 2));
  console.log("[regen] MASTER:", m.master);
  console.log(JSON.stringify({ masterMin: Math.round(m.duracionTotalMs / 60000 * 10) / 10, cortinillas: m.cortinillas, kbps: m.kbps }));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
