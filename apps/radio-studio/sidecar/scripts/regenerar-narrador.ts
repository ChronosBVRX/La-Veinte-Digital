/**
 * Regenera los bloques del Narrador que fallaron por el slot N y remasteriza
 * el episodio con casting corregido (Eduardo builtin + Andrea Piper + Narrador serio).
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3977";
const REPO = path.resolve(__dirname, "../../../..");

async function post<T>(p: string, body: unknown, timeoutMs = 600000, headersTimeoutMs = 600000): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: c.signal,
      // undici permite timeout de headers global (evita UND_ERR_HEADERS_TIMEOUT)
      // @ts-expect-error undici extiende RequestInit
      headersTimeout: headersTimeoutMs,
    });
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
  // 1. job previo: bloques Narrador que fallaron
  const jobPath = path.join(REPO, "data", "tts", "jobs", "job-actual.json");
  if (!fs.existsSync(jobPath)) throw new Error("job previo no existe");
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const fallidos = job.bloques.filter((b: { estado: string }) => b.estado === "fallo");
  console.log(`[narrador] ${fallidos.length} bloques fallidos a regenerar`);
  const bloquesN = fallidos.map((b: { id: string; texto: string; locutor: string }) => ({ id: b.id, texto: b.texto, locutor: b.locutor }));

  if (bloquesN.length > 0) {
    await post("/generate", { tema: job.tema, bloques: bloquesN, voces: { EDUARDO: "A", ANDREA: "B", NARRADOR: "N" } }, 30000);
    let last = 0;
    while (true) {
      await sleep(15000);
      const p = await get<Progress>("/progress");
      if (p.done !== last) { console.log(`[narrador] ${p.done}/${p.total} cache=${p.cacheHits} gen=${p.generados} fallos=${p.fallos}`); last = p.done; }
      if (!p.running && p.total > 0 && p.done >= p.total) break;
      if (!p.running && p.total > 0 && p.estado === "DONE") break;
    }
    const pf = await get<Progress>("/progress");
    console.log(`[narrador] terminado: ${pf.done}/${pf.total} fallos=${pf.fallos}`);
  }

  // 2. Guion completo para remaster (mismo determinista)
  const d = await post<{ script: { turns: Turno[]; speakers: Array<{ id: string; voz: string }> } }>(
    "/director", { tema: "Tiempo extraordinario en el IMSS", duracionMin: 25, nivel: "natural", modoCita: "natural", modo: "determinista" }, 120000
  );
  const voces: Record<string, string> = {};
  for (const s of d.script.speakers) voces[s.id] = s.voz;

  // 3. Remaster 192 kbps (todo debería estar en caché)
  console.log("[narrador] remasterizando…");
  const m = await post<{ master: string; bytes: number; duracionTotalMs: number; cortinillas: number; kbps: number | null }>(
    "/master", { turns: d.script.turns, voces, bed: "auto", jingle: "auto", kbps: 192, formato: "mp3" }, 900000
  );

  const report = { turnos: d.script.turns.length, master: m.master, bytes: m.bytes, duracionMs: m.duracionTotalMs, cortinillas: m.cortinillas, kbps: m.kbps };
  fs.writeFileSync(path.join(REPO, "data", "tts", "casting", "baseline-casting-corregido-report.json"), JSON.stringify(report, null, 2));
  console.log("[narrador] MASTER:", m.master);
  console.log(JSON.stringify({ masterMin: Math.round(m.duracionTotalMs / 60000 * 10) / 10, cortinillas: m.cortinillas, kbps: m.kbps }));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
