/**
 * Producción baseline-director-ai:
 * guion con RadioDirector IA segmentado (Ollama qwen2.5:3b GPU) + DialoguePolisher,
 * con reparto oficial (Eduardo, Andrea, Alonso, Rodrigo Torres y Valeria Soto).
 * Guarda el guion en data/tts/scripts para no perderlo.
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
      // @ts-expect-error undici extiende RequestInit
      headersTimeout: headersTimeoutMs,
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

interface Turno { id: string; speaker: string; text: string; pauseBeforeMs: number; pauseAfterMs: number; canOverlap: boolean; transition: string | null }
interface Progress { running: boolean; done: number; total: number; cacheHits: number; generados: number; fallos: number; estado: string | null }
interface DirectorRes { script: { turns: Turno[]; speakers: Array<{ id: string; voz: string }> }; modoUsado: string; verificacion: Array<{ turnId: string; semaforo: string; detalle: string | null }>; diversity: { score: number; issues: Array<{ tipo: string; severidad: string; detalle: string; ocurrencias: number }> } }

async function main() {
  const dir = path.join(REPO, "data", "tts", "scripts");
  fs.mkdirSync(dir, { recursive: true });

  // 1. Guion IA (segmentado, tarda varios minutos)
  console.log("[ia] generando guion con RadioDirector IA…");
  const d = await post<DirectorRes>(
    "/director",
    { tema: "Tiempo extraordinario en el IMSS", duracionMin: 25, nivel: "natural", modoCita: "natural", modo: "ia", pulir: true },
    1_800_000, 1_800_000
  );
  console.log(`[ia] modo=${d.modoUsado} turnos=${d.script.turns.length} estim=${Math.round(d.script.turns.reduce((a, t) => a + t.text.trim().split(/\s+/).length / 2.6, 0) / 60)}min`);

  const verif = d.verificacion ?? [];
  const rojos = verif.filter((v) => v.semaforo === "red");
  const amarillos = verif.filter((v) => v.semaforo === "yellow");
  console.log(`[ia] verificación: verdes=${verif.length - rojos.length - amarillos.length} amarillos=${amarillos.length} rojos=${rojos.length}`);
  for (const r of rojos) {
    const t = d.script.turns.find((x) => x.id === r.turnId);
    console.log(`[ia] ROJO ${r.turnId} (${t?.speaker}): ${r.detalle} | "${(t?.text ?? "").slice(0, 140)}"`);
  }
  console.log(`[ia] diversity score=${d.diversity?.score} issues=${d.diversity?.issues?.length ?? 0}`);

  // 2. Guardar guion (nunca perderlo)
  const scriptPath = path.join(dir, "guion-ia-tiempo-extra.json");
  fs.writeFileSync(scriptPath, JSON.stringify({ ...d.script, tema: "Tiempo extraordinario en el IMSS", generadoEn: new Date().toISOString() }, null, 2));
  console.log(`[ia] guion guardado: ${scriptPath}`);

  const voces: Record<string, string> = {};
  for (const s of d.script.speakers) voces[s.id] = s.voz;

  // 3. Generar voces (worker desacoplado + cola persistente)
  console.log("[ia] generando voces (worker)…");
  await post("/generate", { tema: "Tiempo extraordinario en el IMSS", bloques: d.script.turns.map((t, i) => ({ id: t.id, texto: t.text, locutor: t.speaker })), voces }, 30000);
  let last = 0;
  while (true) {
    await sleep(15000);
    const p = await get<Progress>("/progress");
    if (p.done !== last) { console.log(`[ia] ${p.done}/${p.total} cache=${p.cacheHits} gen=${p.generados} fallos=${p.fallos}`); last = p.done; }
    if (p.running === false && p.total > 0 && (p.done >= p.total || p.estado === "DONE")) break;
  }
  const pf = await get<Progress>("/progress");
  if (pf.fallos > 0) throw new Error(`${pf.fallos} bloques fallaron durante la generación de voces`);
  console.log(`[ia] voces listas: ${pf.done}/${pf.total}`);

  // 4. Remaster 192 kbps
  console.log("[ia] remasterizando…");
  const m = await post<{ master: string; bytes: number; duracionTotalMs: number; cortinillas: number; kbps: number | null }>(
    "/master", { turns: d.script.turns, voces, bed: "auto", jingle: "auto", kbps: 192, formato: "mp3" }, 900000
  );

  const report = {
    tema: "Tiempo extraordinario en el IMSS",
    modo: "ia",
    turnos: d.script.turns.length,
    estimacionMin: Math.round(d.script.turns.reduce((a, t) => a + t.text.trim().split(/\s+/).length / 2.6, 0) / 60),
    verificacion: { verdes: verif.length - rojos.length - amarillos.length, amarillos: amarillos.length, rojos: rojos.length },
    diversity: d.diversity,
    master: m.master,
    bytes: m.bytes,
    duracionMs: m.duracionTotalMs,
    cortinillas: m.cortinillas,
    kbps: m.kbps,
  };
  fs.writeFileSync(path.join(REPO, "data", "tts", "casting", "baseline-director-ai-report.json"), JSON.stringify(report, null, 2));
  console.log("[ia] MASTER:", m.master);
  console.log(JSON.stringify({ masterMin: Math.round(m.duracionTotalMs / 60000 * 10) / 10, cortinillas: m.cortinillas, kbps: m.kbps }));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
