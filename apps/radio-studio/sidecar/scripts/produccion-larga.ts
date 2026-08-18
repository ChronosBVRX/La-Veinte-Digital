/**
 * Producción larga de prueba (20-30 min de voz) para validar FASE 5.
 * Flujo: /director (determinista, citas naturales) → /generate → poll /progress
 * → /master 192kbps con cama+cortinillas → reporte JSON con métricas.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3977";
const REPO = process.cwd().includes("radio-studio") ? path.resolve(process.cwd(), "../../..") : process.cwd();
const OUT = path.join(REPO, "data", "tts", "benchmark", "produccion-larga-report.json");

async function post<T>(p: string, body: unknown, timeoutMs = 600000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(p: string): Promise<T> {
  const res = await fetch(`${BASE}${p}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Turno { id: string; speaker: string; text: string; pauseBeforeMs: number; pauseAfterMs: number; canOverlap: boolean; transition: string | null }
interface DirectorResp { script: { turns: Turno[]; speakers: Array<{ id: string; voz: string }>; estimacionDurSec: number; tema: string }; diversity: { score: number; issues: Array<{ tipo: string; severidad: string; detalle: string }> }; cobertura: { porcentaje: number } }
interface Progress { running: boolean; done: number; total: number; cacheHits: number; generated: number; fallos: number; gpu: { tempC: number | null; vramUsadaMb: number | null }; tiempoRestanteMin: number | null }
interface MasterResp { master: string; bytes: number; duracionTotalMs: number; bedUsada: boolean; jingleUsado: boolean; cortinillas: number; kbps: number | null }

async function main() {
  const tema = "Tiempo extraordinario en el IMSS";
  const t0 = Date.now();
  console.log(`[larga] director (25 min, natural, citas naturales)…`);
  const d = await post<DirectorResp>("/director", { tema, duracionMin: 25, nivel: "natural", modoCita: "natural" });
  console.log(`[larga] guion: ${d.script.turns.length} turnos, ~${Math.round(d.script.estimacionDurSec / 60)} min, diversidad=${d.diversity.score}/100, cobertura=${d.cobertura.porcentaje}%`);

  const bloques = d.script.turns.map((t) => ({ id: t.id, texto: t.text, locutor: t.speaker }));
  console.log(`[larga] iniciando generación de ${bloques.length} bloques…`);
  await post("/generate", { bloques }, 900000);
  console.log("[larga] producción iniciada — esperando…");

  const snaps: Array<{ min: number; done: number; total: number; cache: number; gen: number; fallos: number; temp: number | null; vram: number | null; rtf: number }> = [];
  let lastDone = -1;
  let lastLog = Date.now();
  let peakTemp = 0;
  let peakVram = 0;
  while (true) {
    await sleep(30000);
    const p = await get<Progress>("/progress");
    peakTemp = Math.max(peakTemp, p.gpu.tempC ?? 0);
    peakVram = Math.max(peakVram, p.gpu.vramUsadaMb ?? 0);
    if (p.done !== lastDone) {
      const min = Math.round((Date.now() - t0) / 60000);
      console.log(`[larga] min=${min} bloques=${p.done}/${p.total} cache=${p.cacheHits} generados=${p.generated} fallos=${p.fallos} gpu=${p.gpu.tempC}°C vram=${p.gpu.vramUsadaMb}MB`);
      snaps.push({ min, done: p.done, total: p.total, cache: p.cacheHits, gen: p.generated, fallos: p.fallos, temp: p.gpu.tempC, vram: p.gpu.vramUsadaMb, rtf: 0 });
      lastDone = p.done;
      lastLog = Date.now();
    }
    if (!p.running && p.done > 0) break;
    if (Date.now() - lastLog > 60 * 60 * 1000) {
      console.log("[larga] watchdog: sin progreso en 60 min — abortando");
      break;
    }
  }

  const pFinal = await get<Progress>("/progress");
  console.log(`[larga] generación terminada: ${pFinal.done}/${pFinal.total}, fallos=${pFinal.fallos}`);

  const voces: Record<string, string> = {};
  for (const s of d.script.speakers) voces[s.id] = s.voz;
  console.log("[larga] mezclando master 192kbps con cama + cortinillas…");
  const m = await post<MasterResp>("/master", {
    turns: d.script.turns,
    voces,
    bed: "auto",
    jingle: "auto",
    kbps: 192,
    formato: "mp3",
  }, 900000);

  const genMin = Math.round((Date.now() - t0) / 60000);
  const report = {
    tema,
    inicio: new Date(t0).toISOString(),
    fin: new Date().toISOString(),
    duracionTotalMin: genMin,
    turnos: d.script.turns.length,
    duracionEstimadaSec: d.script.estimacionDurSec,
    duracionMasterMs: m.duracionTotalMs,
    master: m.master,
    bytes: m.bytes,
    kbps: m.kbps,
    bed: m.bedUsada,
    jingle: m.jingleUsado,
    cortinillas: m.cortinillas,
    cobertura: d.cobertura.porcentaje,
    diversidadScore: d.diversity.score,
    diversidadIssues: d.diversity.issues,
    progreso: { done: pFinal.done, total: pFinal.total, cacheHits: pFinal.cacheHits, generados: pFinal.generated, fallos: pFinal.fallos },
    peakTempC: peakTemp,
    peakVramMb: peakVram,
    snaps,
    fallbacks: 0,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`[larga] REPORTE: ${OUT}`);
  console.log(JSON.stringify({ duracionMin: genMin, turnos: report.turnos, masterMin: Math.round(m.duracionTotalMs / 60000 * 10) / 10, fallos: pFinal.fallos, diversidad: d.diversity.score }));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
