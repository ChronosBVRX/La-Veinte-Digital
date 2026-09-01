/**
 * Sidecar local de AI Radio Studio.
 * HTTP en 127.0.0.1:3977 — ejecuta tts-core + corpus normativo fuera del webview.
 * La app Tauri (o el navegador en dev) lo usa como puente hacia:
 *   - Qwen Base clone (proceso desechable por bloque con watchdog)
 *   - Biblioteca Normativa (búsqueda, Evidence Pack, cobertura)
 *   - Producción (guion → voces → master MP3)
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

import {
  SpeechifyEngine,
  detectHardware,
  sentenceAwareChunk,
  cleanTtsText,
  getCharacterForSlot,
  loadCasting as loadSpeechifyCasting,
  getOrCreateCasting as getOrCreateSpeechifyCasting,
} from "@la-veinte/tts-core";

import { NormativeCatalog } from "../../../../src/features/normativa/services/catalog";
import { buildCoverage } from "../../../../src/features/normativa/services/coverage";
import { buildScriptFromEvidence } from "../../../../src/features/normativa/services/llm-provider";
import { directRadioEpisode, analyzeDiversity, polishDialogue, sanitizeEditorialScript, editorialPromptRules, editorialSegmentGoal, validateCasting, VOICE_PERSONAS, GLOBAL_PRONUNCIATION_RULE, DEFAULT_SPEAKERS, type DirectorInput, type DialogueTurn, type EpisodeScript, type SpeakerProfile, type CitationMode, type VoiceSlot, validateRoleFirewall } from "@la-veinte/radio-core";
import { runMasterQa } from "./master-qa";
import { loadLlmConfig, LocalLLMService } from "./llm/local-llm";
import { getGpuManager } from "./llm/gpu-manager";
import { ScriptPipeline, buildEvidencePackV2 } from "./llm/pipeline";
import { eliminarJob, leerJob, guardarJob, nuevoJob, resumenJob, type ProductionJob } from "../worker/job-store";
import { leerJobMusica, guardarJobMusica, nuevoJobMusica, resumenJobMusica, type MusicaTipo } from "../worker/musica-job-store";
import { createHash } from "node:crypto";
import { makeProjectStoreForRepo, ProjectStore } from "./services/project-store";
import { ProjectWorkflowService } from "./services/project-workflow";
import { CommercialLibraryService } from "./services/commercial-service";
import { LocalEditorialLLM } from "./llm/editorial/editorial-llm";
import { routeProject, friendlyProjectError, type ProjectRouteCtx } from "./routes/project-routes";
import { routeCommercial, type CommercialRouteCtx } from "./routes/commercial-routes";
import { resolveMediaSafe } from "./services/media-security";
import type { Script as StudioScript, ProgressEventType } from "@la-veinte/studio-contract";

const execFileAsync = promisify(execFile);
const PORT = 3977;
const REPO = path.resolve(__dirname, "../../../..");
const ACE_API = "http://127.0.0.1:8001";

let engine: SpeechifyEngine | null = null;
let aceStepStartAttempt: { at: number; error: string | null } = { at: 0, error: null };

function loadLocalEnv(file: string): void {
  try {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!m || process.env[m[1]]) continue;
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  } catch {
    // Si el archivo no puede leerse, el director IA cae al modo determinista.
  }
}

loadLocalEnv(path.join(REPO, ".env.local"));

// ── Servicios del flujo de episodio (proposal-first) ──
const projectStore = makeProjectStoreForRepo(REPO);
const commercialService = new CommercialLibraryService(path.join(REPO, "data", "tts", "commercials"));
const editorialLlm = LocalEditorialLLM.create(REPO);
let workflowSingleton: ProjectWorkflowService | null = null;
function getWorkflow(): ProjectWorkflowService {
  if (!workflowSingleton) {
    workflowSingleton = new ProjectWorkflowService(projectStore, REPO, new NormativeCatalog(REPO), editorialLlm, commercialService);
  }
  return workflowSingleton;
}
export { getWorkflow };

// ── Bus de eventos SSE ──
interface SseClient { id: number; res: http.ServerResponse }
let sseSeq = 0;
const sseClients = new Map<number, SseClient>();
function broadcastEvent(event: { type: ProgressEventType | "state.changed"; projectId: string; data?: unknown }): void {
  const payload = JSON.stringify({ ...event, ts: new Date().toISOString(), projectId: event.projectId ?? "" });
  for (const c of sseClients.values()) {
    try {
      c.res.write(`event: ${event.type}\n`);
      c.res.write(`data: ${payload}\n\n`);
    } catch { /* cliente desconectado — se limpia en /events close */ }
  }
}
function projectLog(projectId: string, type: ProgressEventType | "state.changed", data?: unknown): void {
  if (!projectId) return;
  try { projectStore.logEvent(projectId, { type, data }); } catch { /* mejor esfuerzo */ }
  broadcastEvent({ type, projectId, data });
}

function ensureEngine(): SpeechifyEngine {
  if (!engine) engine = new SpeechifyEngine(path.join(REPO, "data", "tts"));
  return engine;
}

// Resuelve voiceId Speechify para un slot (A/B/N/C/P) usando casting persistido y overrides env
function speechifyVoiceIdForSlot(slot: string): string | null {
  const stateDir = path.join(REPO, "data", "tts");
  const ov: Record<string, string> = {
    A: process.env.SPEECHIFY_VOICE_MALE_1 ?? "",
    B: process.env.SPEECHIFY_VOICE_FEMALE_1 ?? "",
    N: process.env.SPEECHIFY_VOICE_MALE_2 ?? "",
    C: process.env.SPEECHIFY_VOICE_MALE_3 ?? "",
    P: process.env.SPEECHIFY_VOICE_FEMALE_2 ?? "",
  };
  if (ov[slot]?.trim()) return ov[slot].trim();
  const cast = loadSpeechifyCasting(stateDir);
  if (cast) {
    const map: Record<string, keyof typeof cast.voices> = { A: "EDUARDO", B: "ANDREA", N: "JAVIER", C: "RODRIGO", P: "VALERIA" };
    const key = map[slot];
    if (key && cast.voices[key]) return cast.voices[key];
  }
  return null;
}

/** Lanza el worker TTS como proceso independiente (el sidecar NO se bloquea). */
function spawnWorker(): void {
  // Qwen genera en-request (proceso desechable por bloque). El procesamiento
  // de la cola lo hace el propio sidecar en background (ver procesarProduccion).
  void procesarProduccion();
}

/** Procesa la cola de producción con Speechify (cloud). */
let produccionEnCurso = false;
// Flag global de cancelación: el worker en memoria lo respeta aunque otra
// operación (eliminar/descartar/cancelar) use un objeto job distinto en disco.
let cancelRequested = false;
// Latido real del worker: si no hay loop vivo, un job RUNNING en disco no debe
// contarse como "producción en curso" (evita 500 por trabajos obsoletos).
let lastWorkerBeat = 0;

function requestProductionCancel(): void { cancelRequested = true; }
function clearProductionCancel(): void { cancelRequested = false; }

async function procesarProduccion(): Promise<void> {
  if (produccionEnCurso) return;
  produccionEnCurso = true;
  try {
    const eng = ensureEngine();
    if (!eng.isRunning) {
      await eng.start();
      const warmup = await eng.warmup();
      if (!warmup.ok) throw new Error(`motor no disponible: ${warmup.error ?? "warmup"}`);
    }
    const job = leerJob();
    if (!job || job.estado === "DONE" || job.estado === "FAILED") return;
    job.estado = "RUNNING";
    guardarJob(job);
    for (let i = 0; i < job.bloques.length; i++) {
      const b = job.bloques[i];
      if (b.estado === "generado") continue;
      if (cancelRequested || job.cancelado) { clearProductionCancel(); return; }
      job.bloqueActual = i;
      guardarJob(job);
      lastWorkerBeat = Date.now();
      let ultimoError: string | null = null;
      try {
        const t0 = Date.now();
        const seed = Math.abs(b.chars * 13 + i * 7) % 100000;
        const voiceId = speechifyVoiceIdForSlot(b.voz) ?? b.voiceSourceId ?? b.voiceProfileId ?? null;
        if (!voiceId) {
          ultimoError = "casting Speechify no disponible — configura SPEECHIFY_API_KEY y genera casting";
        } else {
          const character = getCharacterForSlot(b.voz as "A" | "B" | "N" | "C" | "P") as unknown as string;
          const r = await eng.generate(cleanTtsText(b.texto), b.voz, {
            voiceId,
            characterId: character,
            voiceProfileId: b.voiceProfileId,
            referenceAudioSha256: b.referenceAudioSha256,
            voiceSourceId: voiceId,
            modelRevision: b.modelRevision,
            seed,
          });
          lastWorkerBeat = Date.now();
          if (cancelRequested || job.cancelado) { clearProductionCancel(); return; }
          if (r.ok && r.path) {
            b.estado = "generado";
            b.wavPath = r.path;
            b.audioDurMs = r.dur_s ? Math.round(r.dur_s * 1000) : null;
            b.genMs = Date.now() - t0;
            b.rtf = b.audioDurMs && b.genMs ? Number((b.genMs / b.audioDurMs).toFixed(3)) : null;
            b.cacheHit = !!r.cacheHit;
            b.error = null;
          } else {
            ultimoError = r.error ?? "generación fallida";
            if (r.requestId) ultimoError += ` (requestId ${r.requestId})`;
            b.error = ultimoError;
          }
        }
      } catch (e) {
        ultimoError = e instanceof Error ? e.message : String(e);
        b.error = ultimoError;
      }
      if (b.estado !== "generado") b.estado = "fallo";
      guardarJob(job);
    }
    job.estado = job.bloques.some((b) => b.estado === "fallo") ? "FAILED" : "DONE";
    guardarJob(job);
  } catch (e) {
    const job = leerJob();
    if (job) { job.estado = "FAILED"; job.notas.push(`worker: ${e instanceof Error ? e.message : String(e)}`); guardarJob(job); }
  } finally {
    produccionEnCurso = false;
    lastWorkerBeat = 0;
  }
}

let workerVivoCache: { at: number; v: boolean } = { at: 0, v: false };

function workerVivo(): boolean {
  if (produccionEnCurso) return true;
  // Un job RUNNING en disco NO basta: debe haber un loop vivo y reciente.
  return lastWorkerBeat > 0 && Date.now() - lastWorkerBeat < 60000;
}

function detenerWorkersProduccion(): void {
  requestProductionCancel();
  try { ensureEngine().abortCurrent(); } catch { /* motor no disponible */ }
  workerVivoCache = { at: 0, v: false };
  const job = leerJob();
  if (job && job.estado !== "DONE") {
    job.estado = "PAUSED";
    job.notas.push("detenido por el usuario — RESUMABLE");
    guardarJob(job);
  }
}

function eliminarAudioDeJob(job: ProductionJob | null): number {
  if (!job) return 0;
  let eliminados = 0;
  const vistos = new Set<string>();
  for (const b of job.bloques) {
    if (!b.wavPath || vistos.has(b.wavPath)) continue;
    vistos.add(b.wavPath);
    try {
      if (fs.existsSync(b.wavPath)) {
        fs.rmSync(b.wavPath, { force: true });
        eliminados++;
      }
    } catch { /* caché ocupada; queda ignorada */ }
  }
  return eliminados;
}

/** Lanza el worker de música ACE-Step (proceso independiente, no bloquea al sidecar). */
function spawnMusicaWorker(): void {
  const workerScript = path.join(__dirname, "..", "worker", "musica_worker.ts");
  const logPath = path.join(REPO, "data", "tts", "worker-musica.log");
  const child = spawn(process.execPath, ["--no-warnings", "--import", "tsx", workerScript], {
    detached: true,
    stdio: ["ignore", fs.openSync(logPath, "a"), fs.openSync(logPath, "a")],
    windowsHide: true,
  });
  child.unref();
}

let musicaWorkerVivoCache: { at: number; v: boolean } = { at: 0, v: false };

function musicaWorkerVivo(): boolean {
  if (Date.now() - musicaWorkerVivoCache.at < 5000) return musicaWorkerVivoCache.v;
  let vivo = false;
  try {
    if (process.platform === "win32") {
      const out = execFileSync("powershell", [
        "-NoProfile", "-NonInteractive", "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'musica_worker' } | Measure-Object | Select-Object -ExpandProperty Count",
      ], { timeout: 8000, encoding: "utf8" });
      vivo = Number(out.trim()) > 0;
    } else {
      const out = execFileSync("pgrep", ["-f", "musica_worker"], { timeout: 8000, encoding: "utf8" });
      vivo = out.trim().length > 0;
    }
  } catch { /* no disponible o sin worker */ }
  musicaWorkerVivoCache = { at: Date.now(), v: vivo };
  return vivo;
}

function startAceStepIfNeeded(): { starting: boolean; error: string | null } {
  if (Date.now() - aceStepStartAttempt.at < 60000) {
    return { starting: true, error: aceStepStartAttempt.error };
  }

  const aceDir = path.join(REPO, "tools", "ACE-Step-1.5");
  if (!fs.existsSync(aceDir)) {
    return { starting: false, error: `no encontré ACE-Step en ${aceDir}` };
  }

  const logPath = path.join(REPO, "data", "tts", "ace-step-api.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  try {
    const out = fs.openSync(logPath, "a");
    const child = spawn("uv", ["run", "--no-sync", "acestep-api"], {
      cwd: aceDir,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
      env: {
        ...process.env,
        ACESTEP_COMPILE_MODEL: "false",
      },
    });
    child.unref();
    aceStepStartAttempt = { at: Date.now(), error: null };
    console.log(`[musica] arrancando ACE-Step API desde ${aceDir}`);
    return { starting: true, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    aceStepStartAttempt = { at: Date.now(), error };
    console.warn(`[musica] no pude iniciar ACE-Step: ${error}`);
    return { starting: false, error };
  }
}

async function readMusicaBenchmarkRtf(): Promise<number | null> {
  try {
    const p = path.join(REPO, "data", "tts", "benchmark", "musica-benchmark-report.json");
    if (fs.existsSync(p)) {
      const r = JSON.parse(fs.readFileSync(p, "utf8"));
      if (typeof r.acumuladoRtf === "number") return r.acumuladoRtf;
    }
  } catch { /* default */ }
  return null;
}

async function readBenchmarkRtf(): Promise<number> {
  try {
    const p = path.join(REPO, "data", "tts", "benchmark", "benchmark-report.json");
    if (fs.existsSync(p)) {
      const r = JSON.parse(fs.readFileSync(p, "utf8"));
      return typeof r.conservativeRtf === "number" ? r.conservativeRtf : 1.96;
    }
  } catch { /* default */ }
  return 1.96;
}

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function corsPreflight(res: http.ServerResponse) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  });
  res.end();
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function handleStatus(res: http.ServerResponse) {
  const hw = await detectHardware();
  const catalog = new NormativeCatalog(REPO);
  const health = catalog.health();
  const sources = catalog.db.listSourceStates();
  const bloqueadas = sources.filter((s) => s.state === "HTTP_403" || s.state === "WAF_BLOCK" || s.state === "TEMPORARY_BLOCK" || s.state === "RETRY_AFTER").length;
  const docs = catalog.listDocuments();
  const disponibles = docs.filter((d) => d.currentVersion).length;
  const verificadas = health.versions;
  const porRevisar = docs.filter((d) => !d.currentVersion || d.validity === "PENDING_REVIEW" || d.validity === "UNKNOWN" || d.verificationStatus).length;
  const eng = ensureEngine();
  let engStatus: Record<string, unknown> = { loaded: false };
  try {
    engStatus = { ...(await eng.status()) };
  } catch { /* motor apagado */ }
  const ttsConfigured = !!process.env.SPEECHIFY_API_KEY;
  const llmCfg = loadLlmConfig();
  const casting = loadSpeechifyCasting(path.join(REPO, "data", "tts"));
  json(res, 200, {
    motor: {
      provider: "speechify",
      model: "simba-3.0",
      language: "es-MX",
      device: "cloud",
      calidad: "GOOD",
      offline: false,
      costoApi: "por uso",
      configured: ttsConfigured,
      estado: ttsConfigured ? (eng.isRunning ? "listo" : "apagado") : "sin clave",
      voces: casting?.voices ?? null,
      detalle: engStatus,
    },
    llm: {
      provider: "ollama",
      model: llmCfg.model,
      label: "IA local",
      contextTokens: llmCfg.contextTokens,
      keepAlive: llmCfg.keepAlive,
    },
    corpus: {
      documentos: health.documents,
      vigentes: health.vigentes,
      pendientes: health.missingRefs + (health.revisar ?? 0),
      disponibles,
      verificadas,
      bloqueadas,
      porRevisar,
      historicos: health.historicos,
    },
    cache: { hits: eng.cacheHits ?? 0, misses: eng.cacheMisses ?? 0, entries: eng.cache?.stats().entries ?? 0 },
    hardware: { perfil: hw.profile, gpu: hw.gpu.name, bateria: hw.isBattery },
  });
}

async function handleInvestigar(res: http.ServerResponse, body: Record<string, unknown>) {
  const tema = String(body.tema ?? "").trim();
  if (!tema) return json(res, 400, { error: "tema vacío" });
  const catalog = new NormativeCatalog(REPO);
  const pack = catalog.buildEvidencePack(tema, { limit: 25 });
  for (const q of expansionQueries(tema)) {
    const extra = catalog.buildEvidencePack(q, { limit: 8 });
    for (const c of extra.claims) {
      if (!pack.claims.some((x) => x.text === c.text)) pack.claims.push(c);
    }
    for (const ch of extra.relevantChunks) {
      if (!pack.relevantChunks.some((x) => x.id === ch.id)) pack.relevantChunks.push(ch);
    }
    for (const doc of extra.documents) {
      if (!pack.documents.some((x) => x.id === doc.id)) pack.documents.push(doc);
    }
  }
  const coverage = buildCoverage(catalog, tema);
  let analisisIa: Record<string, unknown> | null = null;
  let investigador = "solo-corpus";
  try {
    if (await editorialLlm.isAvailable()) {
      const claimsFlat = pack.claims.map((c) => {
        const e = c.evidence[0];
        return `[${c.id}] ${c.text.slice(0, 300)}${e ? ` — ${e.documentId}${e.clause ? ` ${e.clause}` : ""}${e.article ? ` ${e.article}` : ""}` : ""}`;
      }).join("\n");
      const analysis = await editorialLlm.analyzeTopic(tema, claimsFlat.slice(0, 6000));
      const ev = await editorialLlm.evaluateEvidence(tema, claimsFlat.slice(0, 6000));
      analisisIa = {
        enfoque: analysis.enfoque,
        preguntasTrabajador: analysis.preguntas,
        subtemas: analysis.subtemas,
        fuentesClave: ev.fuerte,
        faltantes: [...new Set([...ev.faltantes, ...coverage.critical.map((i) => i.label)])],
        riesgos: analysis.riesgos,
        publicable: analysis.publicable,
      };
      investigador = "ollama:qwen3.5:9b";
    }
  } catch (e) {
    analisisIa = {
      error: e instanceof Error ? e.message : "falló el análisis IA",
      faltantes: coverage.critical.map((i) => i.label),
      publicable: coverage.recommended,
    };
  }
  json(res, 200, {
    tema,
    fragmentos: pack.relevantChunks.length,
    afirmaciones: pack.claims.length,
    investigador,
    analisisIa,
    cobertura: {
      porcentaje: coverage.coverage,
      recomendado: coverage.recommended,
      items: coverage.items.map((i) => ({ label: i.label, estado: i.status === "available" ? "ok" : i.status === "review" ? "revisar" : "faltante" })),
      advertencias: coverage.warnings,
    },
    evidencePack: pack,
  });
}

async function handleGuion(res: http.ServerResponse, body: Record<string, unknown>) {
  const tema = String(body.tema ?? "").trim();
  if (!tema) return json(res, 400, { error: "tema vacío" });
  const catalog = new NormativeCatalog(REPO);
  const pack = catalog.buildEvidencePack(tema, { limit: 25 });
  const script = buildScriptFromEvidence(tema, pack);
  const citas: Record<string, { documento: string; clausula: string | null; articulo: string | null; pagina: number | null }> = {};
  pack.claims.forEach((c, i) => {
    const e = c.evidence[0];
    citas[`C${i + 1}`] = {
      documento: e?.documentId ?? "?",
      clausula: e?.clause ?? null,
      articulo: e?.article ?? null,
      pagina: e?.pdfPage ?? null,
    };
  });
  json(res, 200, { tema, guion: script, citas, cutoff: pack.cutoff, fuentes: pack.documents });
}

const SPEECHIFY_MODEL = "simba-3.0";
const SPEECHIFY_LANGUAGE = "es-MX";
const MODEL_REVISION = "simba-3.0-v1";

function identidadParaVoz(voz: VoiceSlot): { profileId: string; referenceAudioSha256: string; voiceSourceId: string; modelRevision: string } | null {
  const character = getCharacterForSlot(voz);
  const voiceId = speechifyVoiceIdForSlot(voz);
  if (!voiceId) return null;
  // referenceAudioSha256 field now stores SSML profile key para caché (diferenciación personajes)
  const ssmlKey = character === "EDUARDO" ? "emotion:direct" : character === "ANDREA" ? "emotion:warm" : character === "JAVIER" ? "rate:-5%" : character === "RODRIGO" ? "rate:+6%" : "emotion:bright";
  return {
    profileId: character,
    referenceAudioSha256: ssmlKey,
    voiceSourceId: voiceId,
    modelRevision: MODEL_REVISION,
  };
}

function vozPorLocutor(locutor: string, voces: Record<string, VoiceSlot>): VoiceSlot {
  const directa = voces[locutor] ?? voces[locutor.toUpperCase()];
  if (directa) return directa;
  const id = locutor.toUpperCase();
  if (id.includes("NARRADOR")) return "N";
  if (id.includes("RODRIGO") || id.includes("CORRESPONSAL") || id.includes("REPORTERO")) return "C";
  if (id.includes("VALERIA") || id.includes("COMERCIAL") || id.includes("PATROCIN")) return "P";
  if (id.includes("MARIANA") || id.includes("ANDREA")) return "B";
  return "A";
}

/** Resuelve los VoiceProfile por locutor con procedencia vocal real (Qwen Base clone por referencia). */
function resolveVoiceProfiles(speakers: SpeakerProfile[]): Array<{
  id: string;
  displayName: string;
  role: string;
  userAssignedVoiceRole?: string;
  referenceAudioPath: string;
  previewAudioPath: string;
  referenceAudioSha256: string;
  voiceSourceId: string;
  voiceSourceType: "synthetic" | "human" | "builtin" | "unknown";
  voiceSourceLabel: string;
  provider: string;
  modelId: string;
  modelRevision: string;
  language: string;
  locale: string;
}> {
  const rolRole: Record<string, string> = { conductor: "male-host", "co-conductor": "female-cohost", narrador: "narrator" };
  const casting = loadSpeechifyCasting(path.join(REPO, "data", "tts"));
  return speakers.map((s) => {
    const slot: VoiceSlot = ["A", "B", "N", "C", "P"].includes(s.voz) ? s.voz : "A";
    const character = getCharacterForSlot(slot);
    const voiceId = speechifyVoiceIdForSlot(slot) ?? "no-configurado";
    const ssmlKey = character === "EDUARDO" ? "emotion:direct" : character === "ANDREA" ? "emotion:warm" : character === "JAVIER" ? "rate:-5%" : character === "RODRIGO" ? "rate:+6%" : "emotion:bright";
    const labelMap: Record<string, string> = {
      EDUARDO: "Speechify — Eduardo (direct)",
      ANDREA: "Speechify — Andrea (warm)",
      JAVIER: "Speechify — Javier (-5%)",
      RODRIGO: "Speechify — Rodrigo (+6%)",
      VALERIA: "Speechify — Valeria (bright)",
    };
    return {
      id: s.id,
      displayName: s.nombre,
      role: s.rol,
      userAssignedVoiceRole: rolRole[s.rol] ?? s.rol,
      referenceAudioPath: casting ? `speechify:${voiceId}` : "(speechify no configurado)",
      previewAudioPath: casting?.details?.[character] ? `speechify:preview:${voiceId}` : "",
      referenceAudioSha256: ssmlKey,
      voiceSourceId: voiceId,
      voiceSourceType: "synthetic" as const,
      voiceSourceLabel: labelMap[character] ?? "Speechify",
      provider: "speechify",
      modelId: SPEECHIFY_MODEL,
      modelRevision: MODEL_REVISION,
      language: "es",
      locale: SPEECHIFY_LANGUAGE,
    };
  });
}

async function handleCasting(res: http.ServerResponse) {
  const speakers: SpeakerProfile[] = DEFAULT_SPEAKERS;
  let casting = loadSpeechifyCasting(path.join(REPO, "data", "tts"));
  const configured = !!process.env.SPEECHIFY_API_KEY;
  // Auto-crear casting determinista si hay clave y no existe
  if (!casting && configured) {
    try {
      casting = await getOrCreateSpeechifyCasting(path.join(REPO, "data", "tts"));
    } catch (e) {
      // casting falló: se reporta en respuesta
      console.warn(`[casting] no se pudo crear: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const perfiles = resolveVoiceProfiles(speakers);
  const validacion = validateCasting(perfiles);
  json(res, 200, {
    perfiles,
    casting: validacion,
    personas: VOICE_PERSONAS,
    reglaPronunciacion: GLOBAL_PRONUNCIATION_RULE,
    speechify: {
      provider: "speechify",
      model: SPEECHIFY_MODEL,
      language: SPEECHIFY_LANGUAGE,
      configured,
      cast: casting,
      voices: casting?.voices ?? null,
      details: casting?.details ?? null,
      error: !configured ? "SPEECHIFY_API_KEY no configurada" : (!casting ? "casting no disponible — revisa clave y catálogo" : null),
    },
    criteriosReferencia: [
      "Speechify simba-3.0 — 5 voces únicas es-MX",
      "Eduardo direct, Andrea warm, Javier -5%, Rodrigo +6%, Valeria bright",
    ],
  });
}

async function handleCastingRefresh(res: http.ServerResponse) {
  const key = process.env.SPEECHIFY_API_KEY;
  if (!key) return json(res, 400, { error: "SPEECHIFY_API_KEY no configurada" });
  try {
    const casting = await getOrCreateSpeechifyCasting(path.join(REPO, "data", "tts"), true);
    json(res, 200, { refreshed: true, cast: casting });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleGenerate(res: http.ServerResponse, body: Record<string, unknown>) {
  const bloques = Array.isArray(body.bloques)
    ? (body.bloques as Array<{ id: string; texto: string; locutor: string }>)
    : [];
  if (bloques.length === 0) return json(res, 400, { error: "sin bloques" });

  const existente = leerJob();
  const ocupado = existente && workerVivo() && existente.estado !== "DONE";
  if (ocupado && body.mock !== true) {
    return json(res, 409, { error: "ya hay una producción en curso", job: resumenJob(existente) });
  }

  const voces = (body.voces ?? {}) as Record<string, VoiceSlot>;
  const perfiles = resolveVoiceProfiles(DEFAULT_SPEAKERS);
  const perfilPorId = new Map(perfiles.map((p) => [p.id, p]));
  const job = nuevoJob(
    `ep-${Date.now()}`,
    String(body.tema ?? "episodio"),
    bloques.map((b) => {
      const perfil = perfilPorId.get(b.locutor.toUpperCase());
      return {
        id: b.id,
        texto: b.texto,
        locutor: b.locutor,
        voz: vozPorLocutor(b.locutor, voces),
        voiceProfileId: perfil?.id,
        referenceAudioSha256: perfil?.referenceAudioSha256,
        voiceSourceId: perfil?.voiceSourceId,
        modelRevision: perfil?.modelRevision,
      };
    }),
    voces
  );
  guardarJob(job);

  // ── MODO DEV (mock): sin worker ni TTS. Cada bloque toma un WAV real
  // ya cacheado (rotación) para poder probar mezcla/QA/UI en segundos.
  if (body.mock === true) {
    const cacheDir = path.join(REPO, "data", "tts", "cache");
    const wavs = fs.existsSync(cacheDir)
      ? fs.readdirSync(cacheDir).filter((f) => f.endsWith(".wav") && !f.startsWith("warmup")).sort()
      : [];
    if (wavs.length === 0) return json(res, 502, { error: "mock: no hay WAVs cacheados en data/tts/cache" });
    job.bloques.forEach((b, i) => {
      b.estado = "generado";
      b.wavPath = path.join(cacheDir, wavs[i % wavs.length]);
      b.audioDurMs = 4000;
      b.cacheHit = true;
    });
    job.estado = "DONE";
    guardarJob(job);
    return json(res, 200, { iniciado: true, mock: true, total: bloques.length });
  }

  spawnWorker();

  // El sidecar responde de inmediato; el worker genera en segundo plano.
  json(res, 202, { iniciado: true, total: bloques.length, job: resumenJob(job) });
}

async function handleResume(res: http.ServerResponse) {
  const job = leerJob();
  if (!job) return json(res, 404, { error: "no hay trabajo interrumpido" });
  if (job.estado !== "INTERRUPTED" && job.estado !== "PAUSED") {
    if (workerVivo()) return json(res, 409, { error: "producción ya activa" });
  }
  job.estado = "QUEUED";
  job.cancelado = false;
  clearProductionCancel();
  job.notas.push("reanudado — RESUMABLE");
  guardarJob(job);
  spawnWorker();
  json(res, 202, { reanudado: true, job: resumenJob(job) });
}

async function handleProgress(res: http.ServerResponse) {
  const job = leerJob();
  if (!job) {
    return json(res, 200, { running: false, done: 0, total: 0, estado: null });
  }
  const resumen = resumenJob(job);
  const hw = await detectHardware();
  json(res, 200, {
    running: workerVivo(),
    tema: job.tema,
    done: resumen.done,
    total: resumen.total,
    estado: job.estado,
    cacheHits: resumen.cacheHits,
    generados: resumen.generados,
    fallos: resumen.fallos,
    porLocutor: job.bloques.reduce<Record<string, { hecho: number; total: number }>>((acc, b) => {
      const l = acc[b.locutor] ?? { hecho: 0, total: 0 };
      l.total++;
      if (b.estado === "generado") l.hecho++;
      acc[b.locutor] = l;
      return acc;
    }, {}),
    bloques: job.bloques.map((b) => ({
      id: b.id,
      texto: b.texto,
      locutor: b.locutor,
      voz: b.voz,
      estado: b.estado,
      durMs: b.audioDurMs,
      rtf: b.rtf,
      cacheHit: b.cacheHit,
      error: b.error,
      wavPath: b.wavPath,
    })),
    gpu: { tempC: hw.gpu.tempC, vramUsadaMb: hw.gpu.vramUsedMb, vramTotalMb: hw.gpu.vramTotalMb },
    rtf: resumen.rtf,
    rtfReciente: resumen.rtfReciente,
    audioPendienteEstimadoMs: resumen.audioPendienteEstimadoMs,
    reiniciosPrevistos: resumen.reiniciosPrevistos,
    etaMin: resumen.etaMin,
    reiniciosWorker: job.reiniciosWorker,
    vozAcumuladaDesdeReinicioMs: job.vozAcumuladaMsDesdeReinicio,
    notas: job.notas.slice(-4),
  });
}

/**
 * POST /regenerate — regenera UNA intervención con contexto (anterior + siguiente).
 * La cache key incorpora el hash del contexto: cambiar el texto vecino invalida
 * correctamente sin tocar el resto del episodio.
 */
async function handleRegenerate(res: http.ServerResponse, body: Record<string, unknown>) {
  const turnId = String(body.turnId ?? "");
  const texto = String(body.texto ?? "").trim();
  const locutor = String(body.locutor ?? "");
  const prevTexto = typeof body.prevTexto === "string" ? body.prevTexto : "";
  const nextTexto = typeof body.nextTexto === "string" ? body.nextTexto : "";
  if (!turnId || !texto || !locutor) return json(res, 400, { error: "faltan turnId/texto/locutor" });

  // invalidar el bloque previo de esa intervención en la cola del job activo
  const job = leerJob();
  let wavPath: string | null = null;
  if (job) {
    const b = job.bloques.find((x) => x.id === turnId);
    if (b) {
      b.estado = "pendiente";
      b.wavPath = null;
      b.cacheHit = false;
      guardarJob(job);
    }
  }

  const eng = ensureEngine();
  if (!eng.isRunning) {
    await eng.start();
    const warmup = await eng.warmup();
    if (!warmup.ok) return json(res, 502, { error: `motor no disponible: ${warmup.error ?? "warmup"}` });
  }

  const voz = vozPorLocutor(locutor, (body.voces ?? {}) as Record<string, VoiceSlot>);
  const identidad = identidadParaVoz(voz);
  const ctxHash = [...`${prevTexto}||${texto}||${nextTexto}`].reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) | 0, 5);
  const seedTurno = Math.abs(ctxHash) % 100000;
  const r = await eng.generate(cleanTtsText(texto), voz, {
    voiceId: identidad?.voiceSourceId,
    characterId: identidad?.profileId,
    voiceProfileId: identidad?.profileId,
    referenceAudioSha256: identidad?.referenceAudioSha256,
    voiceSourceId: identidad?.voiceSourceId,
    modelRevision: identidad?.modelRevision,
    seed: seedTurno,
  });
  if (!r.ok || !r.path) return json(res, 502, { error: r.error ?? "generación fallida" });
  wavPath = r.path ?? null;
  json(res, 200, {
    regenerado: true,
    turnId,
    wavPath,
    url: `/media?file=${encodeURIComponent(wavPath ?? "")}`,
    durS: r.dur_s ?? null,
    conContexto: { prev: prevTexto.slice(0, 60), next: nextTexto.slice(0, 60) },
  });
}


function validacionLocalOk(turns: DialogueTurn[]): boolean {
  const fw = validateRoleFirewall(turns);
  if (fw.length > 0) return false;
  // Alonso siempre con citas
  for (const t of turns) {
    if (/NARRADOR|ALONSO/i.test(t.speaker) && t.intent === "normative_answer" && (t.citations?.length ?? 0) === 0) return false;
  }
  return true;
}

function agruparEscenas(turns: DialogueTurn[]): Array<{ id: string; titulo: string; turns: DialogueTurn[] }> {
  const map = new Map<string, { id: string; titulo: string; turns: DialogueTurn[] }>();
  for (const t of turns) {
    const key = t.sceneId ?? "s1";
    if (!map.has(key)) map.set(key, { id: key, titulo: key, turns: [] });
    map.get(key)!.turns.push(t);
  }
  return [...map.values()];
}

async function handleLlmHealth(res: http.ServerResponse) {
  const cfg = loadLlmConfig();
  const llm = new LocalLLMService(cfg, path.join(REPO, "data", "tts"));
  const health = await llm.health();
  const models = health.ok ? await llm.listModels() : [];
  const modelFamily = cfg.model.split(":")[0];
  const modeloObjetivoOk = models.some((m) => m.startsWith(modelFamily));
  json(res, 200, {
    config: cfg,
    health,
    modelos: models,
    modeloObjetivoOk,
    // El modelo editorial se verifica en runtime contra Ollama (ollama list). Nunca
    // se usa una constante: si el modelo no está instalado, NO hay fallback remoto.
    editorial: {
      provider: "ollama",
      model: cfg.model,
      label: "Qwen 3.5 9B",
      available: health.ok && modeloObjetivoOk,
      installedModels: models,
      diagnostic: !health.ok
        ? `Ollama no responde en ${cfg.baseUrl} (${health.error ?? "sin respuesta"})`
        : !modeloObjetivoOk
          ? `El modelo ${cfg.model} no está instalado en Ollama. Ejecuta: ollama pull ${cfg.model}`
          : null,
    },
    gpu: getGpuManager().status(),
    stats: health.ok ? await llm.getStats() : [],
  });
}

async function handleLlmUnload(res: http.ServerResponse) {
  const llm = new LocalLLMService(loadLlmConfig(), path.join(REPO, "data", "tts"));
  const liberado = await llm.unload();
  getGpuManager().release("llm");
  json(res, 200, { liberado, gpu: getGpuManager().status() });
}

async function handleCancel(res: http.ServerResponse) {
  const job = leerJob();
  if (!job) return json(res, 404, { error: "no hay trabajo" });
  requestProductionCancel();
  job.cancelado = true;
  job.estado = "PAUSED";
  job.notas.push("cancelado por el usuario — RESUMABLE");
  guardarJob(job);
  json(res, 200, { cancelado: true, job: resumenJob(job) });
}

async function handleDiscard(res: http.ServerResponse) {
  const job = leerJob();
  if (job) {
    job.cancelado = true;
    job.estado = "PAUSED";
    job.notas.push("descartado por el usuario");
    guardarJob(job);
  }
  detenerWorkersProduccion();
  const wavsEliminados = eliminarAudioDeJob(job);
  eliminarJob();
  json(res, 200, { eliminado: true, wavsEliminados });
}

async function findFfmpeg(): Promise<string> {
  const candidates = ["ffmpeg", path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe")];
  for (const c of candidates) {
    try {
      await execFileAsync(c, ["-version"], { timeout: 10000 });
      return c;
    } catch { /* probar */ }
  }
  throw new Error("ffmpeg no disponible");
}

function scoreBrandMusicFile(file: string, kind: "bed" | "jingle"): number {
  const f = file.toLowerCase();
  let score = 0;
  if (f.startsWith(`${kind}-uniforme`)) score += 120;
  if (f.includes("uniforme")) score += 80;
  if (f.includes("la-veinte") || f.includes("laveinte") || f.includes("lv-theme") || f.includes("brand")) score += 70;
  if (f.includes("vivo")) score += 30;
  if (f.includes("ace")) score += 10;
  if (/test|placeholder|prueba|cortinilla/i.test(file)) score -= 200;
  score -= Math.min(20, Math.floor(file.length / 10));
  return score;
}

function selectBrandMusicFile(musicDir: string, kind: "bed" | "jingle"): string | null {
  if (!fs.existsSync(musicDir)) return null;
  const prefix = kind === "bed" ? /^(bed|cama)-.*\.(wav|mp3)$/i : /^jingle-.*\.(wav|mp3)$/i;
  const candidates = fs.readdirSync(musicDir)
    .filter((f) => prefix.test(f))
    .sort((a, b) => scoreBrandMusicFile(b, kind) - scoreBrandMusicFile(a, kind) || a.localeCompare(b));
  return candidates[0] ?? null;
}

async function handleMaster(res: http.ServerResponse, body: Record<string, unknown>) {
  const turns = Array.isArray(body.turns) ? (body.turns as Array<Partial<DialogueTurn> & { speaker: string; text: string }>) : [];
  if (turns.length === 0) return json(res, 400, { error: "sin turnos" });

  const voces = (body.voces ?? {}) as Record<string, VoiceSlot>;
  const voiceGainDb = (body.voiceGainDb ?? {}) as Record<string, number>;
  const kbps = [128, 192, 256, 320].includes(Number(body.kbps)) ? Number(body.kbps) : 192;
  const formato = String(body.formato ?? "mp3") === "wav" ? "wav" : "mp3";
  const duckingOn = body.ducking !== false;
  const duckAttack = Number(body.duckAttack) || 120;
  const duckRelease = Number(body.duckRelease) || 1400;
  const musicDir = path.join(REPO, "data", "tts", "music");
  const autoBed = false // DESACTIVADO: cama musical durante diálogo genera tono "tenebroso". Solo intro/outro.
    ? selectBrandMusicFile(musicDir, "bed")
    : null;
  const autoJingle = body.jingle === "auto" || body.jingle === true || body.jingle == null
    ? selectBrandMusicFile(musicDir, "jingle")
    : null;
  const bedFile = typeof body.bedFile === "string" && fs.existsSync(body.bedFile)
    ? body.bedFile
    : autoBed ? path.join(musicDir, autoBed) : null;
  const jingleFile = typeof body.jingleFile === "string" && fs.existsSync(body.jingleFile)
    ? body.jingleFile
    : autoJingle ? path.join(musicDir, autoJingle) : null;
  const bedGainDb = Number(body.bedGainDb) || -25;
  const bedDuckDb = Number(body.bedDuckDb) || 6;

  // ── MODO DEV (mock): sin motor TTS. Cada turno usa un WAV real cacheado.
  const MOCK = body.mock === true;
  let mockWavs: string[] = [];
  if (MOCK) {
    const cacheDir = path.join(REPO, "data", "tts", "cache");
    mockWavs = fs.existsSync(cacheDir)
      ? fs.readdirSync(cacheDir).filter((f) => f.endsWith(".wav") && !f.startsWith("warmup")).sort().slice(0, 12).map((f) => path.join(cacheDir, f))
      : [];
    if (mockWavs.length === 0) return json(res, 502, { error: "mock: no hay WAVs cacheados" });
  }

  const eng = ensureEngine();
  if (!MOCK && !eng.isRunning) {
    await eng.start();
    const warmup = await eng.warmup();
    if (!warmup.ok) return json(res, 502, { error: `motor no disponible: ${warmup.error ?? "warmup"}` });
  }

  const ffmpeg = await findFfmpeg();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lv-mix-"));
  const inputs: string[] = [];
  const filtros: string[] = [];
  const voiceLabels: string[] = [];
  const turnosMezcla: Array<{ id: string; speaker: string; startMs: number; durMs: number; pauseBeforeMs: number; pauseAfterMs: number; canOverlap: boolean; transition: string | null; label: string; solapeConAnterior?: number }> = [];

  try {
    let cursor = 0;
    let idx = 0;
    // Trim de sonoridad percibida por locutor (medido sobre sus clips, cap ±5 dB)
    const trimPorVoz: Record<string, number> = {};
    const muestrasPorVoz: Record<string, number[]> = {};
    for (const t of turns) {
      const voz = vozPorLocutor(t.speaker, voces);
      const identidad = identidadParaVoz(voz);
      const chunks = sentenceAwareChunk(cleanTtsText(t.text), 120, 220);
      const turnWavs: string[] = [];
      let turnDurMs = 0;
      let chunkIdx = 0;
      if (MOCK) {
        // DEV: un WAV cacheado por turno — cero TTS, mezcla en segundos
        const w = mockWavs[idx % mockWavs.length];
        turnWavs.push(w);
        try {
          const { stdout: dur } = await execFileAsync(ffmpeg, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", w], { timeout: 15000 });
          turnDurMs = Math.round(Number(dur.trim()) * 1000) || 3000;
        } catch { turnDurMs = 3000; }
      }
      for (const c of MOCK ? [] : chunks) {
        // seed determinista por episodio+turno+chunk: regenerable pero variado
        const seedTurno = Math.abs(
          [...`${t.id ?? idx}-${chunkIdx}`].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)
        ) % 100000;
        const r = await eng.generate(c, voz, {
          voiceId: identidad?.voiceSourceId,
          characterId: identidad?.profileId,
          voiceProfileId: identidad?.profileId,
          referenceAudioSha256: identidad?.referenceAudioSha256,
          voiceSourceId: identidad?.voiceSourceId,
          modelRevision: identidad?.modelRevision,
          seed: seedTurno,
        });
        if (r.ok && r.path && fs.existsSync(r.path)) {
          // medir sonoridad del clip para trim por voz
          try {
            const { stdout: vdOut, stderr: vdErr } = await execFileAsync(ffmpeg, ["-i", r.path, "-af", "volumedetect", "-f", "null", "-"], { timeout: 30000 });
            const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(`${vdErr}\n${vdOut}`);
            if (m) {
              const mean = Number(m[1]);
              (muestrasPorVoz[t.speaker] ??= []).push(mean);
            }
          } catch { /* sin medición: sin trim */ }
          turnWavs.push(r.path);
          turnDurMs += Math.round((r.dur_s ?? 0) * 1000);
        }
        chunkIdx++;
      }
      if (turnWavs.length === 0) {
        // pausa variable con jitter: 180-350ms para handoff normal, 0-80ms para interrupciones
      const esInterrupcion = t.overlapPreviousMs != null && t.overlapPreviousMs > 0;
      let pauseReal = t.pauseBeforeMs ?? 0;
      if (!esInterrupcion && pauseReal > 100) {
        // variar entre 180-350 ms de forma determinista por turno
        const seed = (t.id ?? `t${idx}`).split("").reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7);
        const jitter = Math.abs(seed % 170); // 0-169
        pauseReal = Math.max(180, Math.min(350, pauseReal + jitter - 85));
      }
      cursor += pauseReal;
        continue;
      }

      let turnWav: string;
      if (turnWavs.length === 1) {
        turnWav = turnWavs[0];
      } else {
        // unión con micro-crossfade en serie (evita clicks en costuras sin comerse consonantes)
        turnWav = path.join(tmp, `t${idx}.wav`);
        const fcmd = ["-y", ...turnWavs.flatMap((w) => ["-i", w])];
        let fl = "";
        let prevLabel = "0:a";
        turnWavs.forEach((_, i) => {
          if (i === 0) return;
          const outL = i === turnWavs.length - 1 ? "out" : `cf${i}`;
          fl += `[${prevLabel}][${i}:a]acrossfade=d=0.03:c1=tri:c2=tri[${outL}]`;
          prevLabel = outL;
          if (i < turnWavs.length - 1) fl += ";";
        });
        await execFileAsync(ffmpeg, [...fcmd, "-filter_complex", fl, "-map", "[out]", turnWav], { timeout: 120000 });
      }

      inputs.push(turnWav);
      // pausa variable con jitter: 180-350ms para handoff normal, 0-80ms para interrupciones
      const esInterrupcion = t.overlapPreviousMs != null && t.overlapPreviousMs > 0;
      let pauseReal = t.pauseBeforeMs ?? 0;
      if (!esInterrupcion && pauseReal > 100) {
        // variar entre 180-350 ms de forma determinista por turno
        const seed = (t.id ?? `t${idx}`).split("").reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7);
        const jitter = Math.abs(seed % 170); // 0-169
        pauseReal = Math.max(180, Math.min(350, pauseReal + jitter - 85));
      }
      cursor += pauseReal;
      const startMs = cursor;
      const prev = turnosMezcla[turnosMezcla.length - 1];
      let inicioMs = startMs;
      // solape declarado por el director (overlapPreviousMs) o reacción corta clásica
      const solapeDeclarado = t.overlapPreviousMs ?? 0;
      if (prev && (solapeDeclarado > 0 || (t.canOverlap && (t.text ?? "").trim().length <= 60))) {
        const ms = solapeDeclarado > 0 ? Math.min(solapeDeclarado, 300) : 120;
        inicioMs = Math.max(prev.startMs, prev.startMs + prev.durMs - ms);
        if (solapeDeclarado > 0) prev.solapeConAnterior = ms; // el mezclador bajará al interrumpido
      }
      turnosMezcla.push({
        id: t.id ?? `t${idx}`,
        speaker: t.speaker,
        startMs: inicioMs,
        durMs: turnDurMs,
        pauseBeforeMs: t.pauseBeforeMs ?? 0,
        pauseAfterMs: t.pauseAfterMs ?? 0,
        canOverlap: !!t.canOverlap,
        transition: t.transition ?? null,
        label: `${t.speaker}: ${(t.text ?? "").slice(0, 40)}`,
      });
      cursor = inicioMs + turnDurMs + (t.pauseAfterMs ?? 0);
      idx++;
    }

    if (inputs.length === 0) return json(res, 502, { error: "no se generó audio para ningún turno" });

    // ── Trim de sonoridad percibida por locutor: objetivo mean_volume −18 dB,
    // cap ±5 dB para no matar la dinámica natural. Corrige voces bajas (Alonso).
    const OBJETIVO_MEAN_DB = -18;
    for (const [voz, muestras] of Object.entries(muestrasPorVoz)) {
      if (muestras.length === 0) continue;
      const mediana = [...muestras].sort((a, b) => a - b)[Math.floor(muestras.length / 2)];
      const trim = Math.max(-5, Math.min(5, OBJETIVO_MEAN_DB - mediana));
      trimPorVoz[voz] = Math.round(trim * 10) / 10;
    }

    for (let i = 0; i < turnosMezcla.length; i++) {
      const m = turnosMezcla[i];
      const gainManual = voiceGainDb[m.speaker] ?? 0;
      const trim = trimPorVoz[m.speaker] ?? 0;
      const gain = gainManual + trim;
      let cadena = "";
      // ducking del interrumpido durante la ventana en que lo solapan
      if (m.solapeConAnterior && m.solapeConAnterior > 0) {
        const finVentana = (m.startMs + m.durMs) / 1000;
        const inicioVentana = Math.max(0, finVentana - m.solapeConAnterior / 1000);
        cadena += `volume=-4dB:enable='between(t,${inicioVentana.toFixed(2)},${finVentana.toFixed(2)})',`;
      }
      cadena += gain !== 0 ? `volume=${gain}dB` : "anull";
      filtros.push(`[${i}:a]${cadena},adelay=${m.startMs}|${m.startMs}[v${i}]`);
      voiceLabels.push(`[v${i}]`);
    }
    const totalMs = turnosMezcla.reduce((a, m) => Math.max(a, m.startMs + m.durMs), 0) + 1500;

    filtros.push(`${voiceLabels.join("")}amix=inputs=${voiceLabels.length}:normalize=0:dropout_transition=0[vmix]`);
    if (bedFile && duckingOn) {
      filtros.push(`[vmix]asplit=2[vmixout][sc]`);
    } else {
      filtros.push(`[vmix]anull[vmixout]`);
    }

    let bedIdx = -1;
    const jingleIdx: number[] = [];
    const finalInputs: string[] = [];
    if (bedFile && duckingOn) {
      bedIdx = inputs.length;
      inputs.push(bedFile);
      filtros.push(`[${bedIdx}:a]volume=${bedGainDb}dB,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, (totalMs - 2500) / 1000)}:d=2.5[bedpre]`);
      filtros.push(`[bedpre][sc]sidechaincompress=threshold=0.03:ratio=3:attack=${duckAttack}:release=${duckRelease}:makeup=${bedDuckDb}[ducked]`);
      finalInputs.push("[ducked]");
    } else if (bedFile) {
      bedIdx = inputs.length;
      inputs.push(bedFile);
      filtros.push(`[${bedIdx}:a]volume=${bedGainDb}dB,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, (totalMs - 2500) / 1000)}:d=2.5[ducked]`);
      finalInputs.push("[ducked]");
    }
    if (jingleFile) {
      const putJingle = (atMs: number, fadeOutSec: number, label: string) => {
        const ji = inputs.length;
        inputs.push(jingleFile);
        jingleIdx.push(ji);
        const st = (atMs / 1000).toFixed(2);
        const fadeOutSt = Math.max(Number(st) + 1.2, Number(st) + fadeOutSec);
        filtros.push(`[${ji}:a]adelay=${atMs}|${atMs},volume=-6dB,afade=t=out:st=${fadeOutSt.toFixed(2)}:d=${fadeOutSec}[jin${ji}]`);
        finalInputs.push(`[jin${ji}]`);
        return label;
      };
      putJingle(0, 1.2, "intro");
      putJingle(Math.max(0, totalMs - 4500), 1.0, "outro");
    }
    finalInputs.unshift("[vmixout]");
    filtros.push(`${finalInputs.join("")}amix=inputs=${finalInputs.length}:normalize=0:dropout_transition=0[mix]`);
    filtros.push("[mix]loudnorm=I=-16:TP=-1.5:LRA=11[norm]");

    const outDir = path.join(REPO, "data", "tts", "master");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `programa-${Date.now()}.${formato}`);
    const args = ["-y", ...inputs.flatMap((i) => ["-i", i]), "-filter_complex", filtros.join(";"), "-map", "[norm]"];
    if (formato === "mp3") {
      args.push("-codec:a", "libmp3lame", "-b:a", `${kbps}k`, outFile);
    } else {
      args.push("-codec:a", "pcm_s16le", outFile);
    }
    await execFileAsync(ffmpeg, args, { timeout: 900000 });

    // ── Mix manifest: trazabilidad de colocación de cada turno ──
    try {
      fs.writeFileSync(
        path.join(outDir, path.basename(outFile).replace(/\.(mp3|wav)$/, "") + "-mix.json"),
        JSON.stringify({ generadoEn: new Date().toISOString(), totalMs, trimPorVoz, turnos: turnosMezcla }, null, 1)
      );
    } catch {}

    // ── QA automático del máster (Fase 3) ──
    let qa: Awaited<ReturnType<typeof runMasterQa>> | null = null;
    try {
      qa = await runMasterQa(outFile, turnosMezcla, turns);
    } catch { /* QA best-effort: no bloquea la entrega del máster */ }

    json(res, 200, {
      master: outFile,
      bytes: fs.statSync(outFile).size,
      turnos: turnosMezcla.length,
      duracionTotalMs: totalMs,
      bedUsada: !!bedFile,
      jingleUsado: jingleIdx.length > 0,
      introOutro: jingleIdx.length,
      cortinillas: 0,
      formato,
      kbps: formato === "mp3" ? kbps : null,
      trimPorVoz,
      qa,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const TOPIC_EXPANSIONS: Record<string, string[]> = {
  "tiempo extra": ["jornada de trabajo", "descanso semanal", "guardias", "pago de salario", "concepto 37", "biométrico asistencia", "ausentismo"],
  extraordinario: ["jornada de trabajo", "descanso semanal", "guardias", "pago de salario", "concepto 37", "biométrico asistencia"],
  horario: ["jornada de trabajo", "turnos", "descanso semanal", "tiempo extraordinario", "asistencia y puntualidad", "sustituciones"],
  falta: ["retardos", "asistencia", "puntualidad", "biométrico", "sustituciones", "permisos"],
  accidente: ["riesgos de trabajo", "incapacidad temporal", "ST-7", "dictaminación", "Ley del Seguro Social"],
  "riesgo": ["accidentes de trabajo", "enfermedades de trabajo", "incapacidades", "equipo de protección", "comisiones de seguridad e higiene"],
  bolsa: ["sustitutos", "aspirantes", "escalafón", "categorías", "contratación"],
  jubila: ["pensiones", "régimen de jubilaciones", "fondo de ayuda", "beneficiarios"],
  vacacion: ["días de descanso", "permisos", "prima vacacional"],
  permis: ["licencias", "permisos sindicales", "faltas"],
  sindica: ["comisión sindical", "honor y justicia", "derechos sindicales"],
  nomina: ["pago de salario", "conceptos de nómina", "descuentos"],
  violencia: ["acoso laboral", "hostigamiento", "denuncia", "protocolo"],
};

function expansionQueries(tema: string): string[] {
  const t = tema.toLowerCase();
  const found: string[] = [];
  for (const [key, queries] of Object.entries(TOPIC_EXPANSIONS)) {
    if (t.includes(key)) found.push(...queries);
  }
  return [...new Set(found)].slice(0, 8);
}

function scriptScenesFromTurns(turns: DialogueTurn[]): EpisodeScript["scenes"] {
  const scenes: EpisodeScript["scenes"] = [];
  let current = { id: "s1", titulo: "Apertura", turns: [] as DialogueTurn[] };
  for (const t of turns) {
    if (current.turns.length > 0 && /cambio editorial|transici[oó]n|secci[oó]n/i.test(t.transition ?? "")) {
      scenes.push(current);
      current = { id: `s${scenes.length + 1}`, titulo: "Desarrollo", turns: [] };
    }
    current.turns.push(t);
  }
  if (current.turns.length > 0) scenes.push(current);
  if (scenes.length > 0) scenes[0] = { ...scenes[0], titulo: "Apertura" };
  if (scenes.length > 1) scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], titulo: "Cierre" };
  return scenes;
}

function speakerPromptLine(s: SpeakerProfile): string {
  const extra = [
    s.genero ? `género: ${s.genero}` : null,
    s.timbre ? `timbre: ${s.timbre}` : null,
    s.rangoEdad ? `edad vocal: ${s.rangoEdad}` : null,
    s.acento ? `acento: ${s.acento}` : null,
    s.ritmo ? `ritmo: ${s.ritmo}` : null,
    s.energia ? `energía: ${s.energia}/5` : null,
    s.autoridad ? `autoridad: ${s.autoridad}` : null,
    s.cercania ? `cercanía: ${s.cercania}` : null,
    s.especialidad ? `especialidad: ${s.especialidad}` : null,
    s.funcionEditorial ? `función editorial: ${s.funcionEditorial}` : null,
    s.frecuenciaPreguntas ? `preguntas: ${s.frecuenciaPreguntas}` : null,
    s.longitud ? `turnos: ${s.longitud}` : null,
    s.puedeInterrumpir ? "puede interrumpir con reacciones breves" : null,
    s.puedeEjemplificar ? "puede poner ejemplos" : null,
    s.puedeCerrar ? "puede cerrar bloques" : null,
  ].filter(Boolean).join("; ");
  return `- ${s.id} (${s.nombre}, ${s.rol}, voz ${s.voz}): ${s.personalidad}${extra ? ` [${extra}]` : ""}`;
}

function interactionStylePrompt(nivel: DirectorInput["nivel"]): string {
  if (nivel === "informativo") {
    return [
      "FORMATO INFORMATIVO:",
      "- Ritmo sereno, explicaciones ordenadas y pocas interrupciones.",
      "- Turnos de 2 a 4 frases cuando haga falta explicar un punto.",
      "- Pausas amplias: pauseBeforeMs y pauseAfterMs entre 380 y 620.",
      "- energy 2, pace normal, canOverlap siempre false.",
    ].join("\n");
  }
  if (nivel === "dinamico") {
    return [
      "FORMATO DINÁMICO:",
      "- Ritmo ágil, respuestas breves, preguntas directas y cambios editoriales más visibles.",
      "- Turnos de 1 a 2 frases; evita bloques largos.",
      "- Pausas cortas: pauseBeforeMs y pauseAfterMs entre 60 y 200.",
      "- energy 4, pace rapido; canOverlap true solo en reacciones muy cortas.",
      "- Incluye más contraste entre duda, ejemplo práctico y resumen.",
    ].join("\n");
  }
  return [
    "FORMATO RADIO NATURAL:",
    "- Conversación equilibrada, cercana y fluida.",
    "- Turnos de 1 a 3 frases, con preguntas y ejemplos sin sonar acelerado.",
    "- Pausas naturales: pauseBeforeMs y pauseAfterMs entre 140 y 320.",
    "- energy 3, pace normal; canOverlap true solo en reacciones breves.",
  ].join("\n");
}

function normalizeTurnByInteraction(t: DialogueTurn, nivel: DirectorInput["nivel"]): DialogueTurn {
  if (nivel === "informativo") {
    return {
      ...t,
      pauseBeforeMs: Math.max(380, Math.min(620, t.pauseBeforeMs)),
      pauseAfterMs: Math.max(380, Math.min(620, t.pauseAfterMs)),
      energy: Math.min(3, Math.max(1, t.energy)) as DialogueTurn["energy"],
      pace: "normal",
      canOverlap: false,
    };
  }
  if (nivel === "dinamico") {
    const breve = t.text.trim().split(/\s+/).length <= 12;
    return {
      ...t,
      pauseBeforeMs: Math.max(60, Math.min(200, t.pauseBeforeMs)),
      pauseAfterMs: Math.max(60, Math.min(220, t.pauseAfterMs)),
      energy: Math.max(4, t.energy) as DialogueTurn["energy"],
      pace: "rapido",
      canOverlap: breve && t.canOverlap,
    };
  }
  return {
    ...t,
    pauseBeforeMs: Math.max(140, Math.min(320, t.pauseBeforeMs)),
    pauseAfterMs: Math.max(140, Math.min(320, t.pauseAfterMs)),
    energy: Math.max(2, Math.min(4, t.energy)) as DialogueTurn["energy"],
    pace: "normal",
    canOverlap: t.text.trim().split(/\s+/).length <= 14 && t.canOverlap,
  };
}

function estimateScriptDurationSec(turns: DialogueTurn[]): number {
  return Math.round(turns.reduce((a, t) => a + t.text.trim().split(/\s+/).length / 2.6, 0));
}

function insertSponsorSlots(script: EpisodeScript, opts: { enabled: boolean; count?: number; durationSec?: number }): EpisodeScript {
  if (!opts.enabled || script.turns.length < 14) return script;
  if (script.turns.some((t) => t.adSlot)) return script;
  const count = Math.max(1, Math.min(3, Math.round(opts.count ?? (script.turns.length >= 36 ? 2 : 1))));
  const durationSec = Math.max(10, Math.min(90, Math.round(opts.durationSec ?? 30)));
  const positions = count === 1
    ? [Math.floor(script.turns.length * 0.55)]
    : Array.from({ length: count }, (_, i) => Math.floor(script.turns.length * ((i + 1) / (count + 1))));
  let added = 0;
  const turns = [...script.turns];
  for (const pos of positions.sort((a, b) => b - a)) {
    const at = Math.min(Math.max(4, pos), turns.length - 4);
    added += 1;
    turns.splice(at, 0, {
      id: `ad${String(added).padStart(2, "0")}`,
      speaker: script.speakers.some((s) => s.id === "VALERIA") ? "VALERIA" : "NARRADOR",
      text: `Espacio comercial disponible de ${durationSec} segundos. Edita este bloque cuando haya patrocinador.`,
      kind: "ad",
      adSlot: true,
      adDurationSec: durationSec,
      sponsorName: null,
      pauseBeforeMs: 220,
      pauseAfterMs: 220,
      energy: 2,
      pace: "normal",
      canOverlap: false,
      transition: "espacio comercial",
      citations: [],
    });
  }
  return {
    ...script,
    turns,
    scenes: scriptScenesFromTurns(turns),
    estimacionDurSec: estimateScriptDurationSec(turns) + count * durationSec,
  };
}

function normalizeLlMTurns(input: Array<Partial<DialogueTurn> & { speaker?: string; text?: string }>, fallback: DialogueTurn[]): DialogueTurn[] {
  const byId = new Map(fallback.map((t) => [t.id, t]));
  return input
    .filter((t) => String(t.text ?? "").trim().length > 0)
    .map((t, i) => {
      const prev = typeof t.id === "string" ? byId.get(t.id) : fallback[i];
      return {
        id: typeof t.id === "string" && t.id.trim() ? t.id : `aj${String(i + 1).padStart(3, "0")}`,
        speaker: String(t.speaker ?? prev?.speaker ?? DEFAULT_SPEAKERS[i % 2].id),
        text: String(t.text ?? prev?.text ?? "").trim(),
        kind: t.kind === "ad" || prev?.kind === "ad" ? "ad" : "dialogue",
        adSlot: typeof t.adSlot === "boolean" ? t.adSlot : !!prev?.adSlot,
        adDurationSec: Number.isFinite(Number(t.adDurationSec)) ? Number(t.adDurationSec) : prev?.adDurationSec,
        sponsorName: typeof t.sponsorName === "string" ? t.sponsorName : prev?.sponsorName ?? null,
        pauseBeforeMs: Number.isFinite(Number(t.pauseBeforeMs)) ? Number(t.pauseBeforeMs) : (prev?.pauseBeforeMs ?? 120),
        pauseAfterMs: Number.isFinite(Number(t.pauseAfterMs)) ? Number(t.pauseAfterMs) : (prev?.pauseAfterMs ?? 160),
        energy: Math.min(5, Math.max(1, Number(t.energy) || prev?.energy || 3)) as 1 | 2 | 3 | 4 | 5,
        pace: (["lento", "normal", "rapido"].includes(String(t.pace)) ? String(t.pace) : prev?.pace ?? "normal") as "lento" | "normal" | "rapido",
        canOverlap: typeof t.canOverlap === "boolean" ? t.canOverlap : !!prev?.canOverlap,
        transition: typeof t.transition === "string" ? t.transition : null,
        citations: Array.isArray(t.citations) ? t.citations.map(String).filter((c) => /^E?\d+|C\d+$/i.test(c)) : (prev?.citations ?? []),
      };
    });
}

async function handleAjustarGuion(res: http.ServerResponse, body: Record<string, unknown>) {
  const script = body.script as EpisodeScript | undefined;
  const contexto = String(body.contexto ?? "").trim();
  const scope = String(body.scope ?? "todo");
  if (!script || !Array.isArray(script.turns) || script.turns.length === 0) return json(res, 400, { error: "guion vacío" });
  if (!contexto) return json(res, 400, { error: "contexto vacío" });

  const catalog = new NormativeCatalog(REPO);
  const pack = catalog.buildEvidencePack(`${script.tema} ${contexto}`, { limit: 30 });
  const targetTurns = scope === "todo"
    ? script.turns
    : script.scenes.find((s) => s.id === scope)?.turns ?? script.turns.filter((t) => t.id === scope);
  if (targetTurns.length === 0) return json(res, 400, { error: "no encontré la parte seleccionada" });

  const speakerIds = script.speakers.map((s) => s.id).join("|");
  const claimsFlat = pack.claims.slice(0, 30).map((c, i) => {
    const e = c.evidence[0];
    return `E${i + 1} | ${e?.documentId ?? "?"}${e?.clause ? ` ${e.clause}` : ""}${e?.article ? ` ${e.article}` : ""}${e?.pdfPage != null ? ` pág.${e.pdfPage}` : ""} | ${c.text.slice(0, 420)}`;
  }).join("\n");
  const memory = targetTurns.slice(-6).map((t) => `${t.speaker}: ${t.text.slice(0, 110)}`).join("\n");

  // Migrado a LocalEditorialLLM: la edición usa SIEMPRE el motor local (qwen3.5:9b).
  if (!(await editorialLlm.isAvailable())) {
    return json(res, 503, { error: "El modelo editorial local no está disponible.", code: "MOTOR_UNAVAILABLE" });
  }
  const rawTurns = await editorialLlm.writeSection({
    topic: script.tema,
    seccion: scope === "todo" ? "todo el guion" : scope,
    proposito: contexto,
    claims: claimsFlat,
    speakers: speakerIds,
    memory: `GUIÓN PREVIO (no lo repitas entero):\n${memory}`,
    comercial: null,
  }).catch((e) => { throw new Error(`EDICION_LLM_FAILED: ${e instanceof Error ? e.message : e}`); });

  if (!rawTurns || rawTurns.length === 0) return json(res, 502, { error: "El motor local no devolvió turnos útiles" });
  const parsed = { turns: rawTurns, nota: "ajuste generado por el motor local" };
  let nuevos = normalizeLlMTurns(parsed.turns as Array<Partial<DialogueTurn> & { speaker?: string; text?: string }>, targetTurns);

  const targetIds = new Set(targetTurns.map((t) => t.id));
  let newSeq = 0;
  nuevos = nuevos.map((t) => {
    if (!/^new-/i.test(t.id)) return t;
    newSeq += 1;
    return { ...t, id: `aj${Date.now()}-${newSeq}` };
  });

  const merged = scope === "todo"
    ? nuevos
    : script.turns.flatMap((t) => targetIds.has(t.id) && t.id === targetTurns[0].id ? nuevos : targetIds.has(t.id) ? [] : [t]);

  const sanitized = sanitizeEditorialScript({
    ...script,
    turns: merged,
    scenes: scriptScenesFromTurns(merged),
    estimacionDurSec: estimateScriptDurationSec(merged),
  });

  const verificacion = sanitized.script.turns.map((t) => {
    if (t.text.trim().length < 25) return { turnId: t.id, semaforo: "green" as const, detalle: null };
    const check = catalog.verifyClaim(t.text);
    if (check.state === "VERIFIED") return { turnId: t.id, semaforo: "green" as const, detalle: null };
    if (t.citations.length > 0) return { turnId: t.id, semaforo: "yellow" as const, detalle: "Cita declarada sin soporte directo encontrado — revisar" };
    return { turnId: t.id, semaforo: "yellow" as const, detalle: "Ajuste editorial sin soporte directo — revisar antes de producir" };
  });

  json(res, 200, {
    script: sanitized.script,
    nota: parsed.nota ?? "ajuste aplicado",
    proveedor: "ollama:qwen3.5:9b",
    editorialQa: sanitized.qa,
    editorialCambios: sanitized.cambios,
    verificacion,
    fragmentos: pack.relevantChunks.length,
  });
}

async function handleDirector(res: http.ServerResponse, body: Record<string, unknown>) {
  const tema = String(body.tema ?? "").trim();
  if (!tema) return json(res, 400, { error: "tema vacío" });
  const nivel = (["informativo", "natural", "dinamico"].includes(String(body.nivel)) ? String(body.nivel) : "natural") as DirectorInput["nivel"];
  const modoCita = (["natural", "documental", "tecnico"].includes(String(body.modoCita)) ? String(body.modoCita) : "natural") as CitationMode;
  const modo = String(body.modo ?? "determinista") as "determinista" | "ia";
  const ampliar = body.ampliar !== false;
  const duracionMin = Number(body.duracionMin) > 0 ? Number(body.duracionMin) : 15;
  const contextoExtra = String(body.contextoExtra ?? "").trim();
  const comerciales = body.comerciales !== false;
  const duracionComercialSec = Number(body.duracionComercialSec) > 0 ? Number(body.duracionComercialSec) : 30;

  const catalog = new NormativeCatalog(REPO);
  const pack = catalog.buildEvidencePack(contextoExtra ? `${tema} ${contextoExtra}` : tema, { limit: 24 });
  if (ampliar && duracionMin >= 15) {
    for (const q of expansionQueries(tema)) {
      const extra = catalog.buildEvidencePack(q, { limit: 8 });
      for (const c of extra.claims) {
        if (!pack.claims.some((x) => x.text === c.text)) {
          pack.claims.push(c);
          pack.relevantChunks.push(...extra.relevantChunks.filter((ch) => !pack.relevantChunks.includes(ch)));
        }
        if (pack.claims.length >= 40) break;
      }
      if (pack.claims.length >= 40) break;
    }
  }
  const coverage = buildCoverage(catalog, tema);
  const mapaDocumental = catalog.listDocuments().slice(0, 140).map((d) => {
    const ver = d.currentVersion ? catalog.getVersion(d.currentVersion) : null;
    return `${d.id} | ${d.category} | ${d.validity} | ${d.title}${ver?.pages ? ` | ${ver.pages} pág.` : ""}`;
  }).join("\n");

  const speakers: SpeakerProfile[] = Array.isArray(body.speakers) && (body.speakers as SpeakerProfile[]).length > 0
    ? (body.speakers as SpeakerProfile[]).filter((s) => s.participa !== false)
    : DEFAULT_SPEAKERS;
  const speakerIds = speakers.map((s) => s.id).join("|");

  let claims = pack.claims.slice(0, 40).map((c) => ({
    id: c.id,
    texto: c.text,
    documento: c.evidence[0]?.documentId ?? "?",
    clausula: c.evidence[0]?.clause ?? null,
    articulo: c.evidence[0]?.article ?? null,
    pagina: c.evidence[0]?.pdfPage ?? null,
  }));
  if (/tiempo\s+extra|extraordinario/i.test(tema)) {
    const offTopic = /\b(pilotos?|tripulantes?|avion|avión|vuelo|descanso horizontal|barco|buque|maritimo|marítimo|musico|músico|obra de teatro|art[ií]culo 39|contrato por tiempo determinado|tiempo indeterminado|temporada|funci[oó]n espec[ií]fica|revisi[oó]n del contrato colectivo|sesenta d[ií]as naturales)\b/i;
    const focused = claims.filter((c) => !offTopic.test(c.texto));
    if (focused.length >= 6) claims = focused;
  }

  let script = directRadioEpisode({
    tema,
    duracionMin,
    speakers,
    nivel,
    claims,
    cutoff: pack.cutoff,
    fuentes: pack.documents,
    modoCita,
  });

  // ── IA LOCAL PRIMERO (Qwen/Ollama): pipeline multipasso con auditoría ──
  const llmCfg = loadLlmConfig();
  let modoLlmUsado: string | null = null;
  let pipelineArtifacts: string | null = null;
  let pipelineScore: number | null = null;
  if (modo === "ia" && llmCfg.enabled) {
    const gpuMgr = getGpuManager();
    try {
      const episodeId = `ep-${Date.now()}`;
      const artifactsDir = path.join(REPO, "data", "tts", "episodes", episodeId);
      const pack2 = buildEvidencePackV2(episodeId, tema, claims, pack.cutoff);
      const resultado = await new ScriptPipeline().run({
        tema, duracionMin, speakers, nivel, claims,
        cutoff: pack.cutoff, fuentes: pack.documents, modoCita,
        evidencePack: pack2, artifactsDir,
      });
      if (resultado.turns.length >= 6 && validacionLocalOk(resultado.turns)) {
        script = {
          ...script,
          scenes: agruparEscenas(resultado.turns),
          turns: resultado.turns,
          estimacionDurSec: Math.round(resultado.turns.reduce((a, t) => a + t.text.split(/\s+/).length / 2.6, 0)),
        };
        modoLlmUsado = `qwen-local (${resultado.scoreFinal}/100)`;
        pipelineArtifacts = artifactsDir;
        pipelineScore = resultado.scoreFinal;
      }
    } catch (e) {
      console.log(`[director] IA local falló → fallback: ${e instanceof Error ? e.message : e}`);
    }
    void gpuMgr;
  }

  let modoUsado: "determinista" | "ia" = "determinista";
  let proveedorUsado: string | null = null;
  const verificacion: Array<{ turnId: string; semaforo: "green" | "yellow" | "red"; detalle: string | null }> = [];

  if (modoLlmUsado) {
    // La ruta IA usa SIEMPRE el motor local (qwen3.5:9b vía Ollama), sin APIs remotas.
    modoUsado = "ia";
    proveedorUsado = "ollama:qwen3.5:9b";
    // Verificación determinista de cada turno contra el corpus local (sin LLM remoto).
    for (const t of script.turns) {
      if (t.text.trim().length < 25) {
        verificacion.push({ turnId: t.id, semaforo: "green", detalle: null });
        continue;
      }
      const check = catalog.verifyClaim(t.text);
      if (check.state === "VERIFIED") {
        verificacion.push({ turnId: t.id, semaforo: "green", detalle: null });
      } else if (t.citations.length > 0) {
        verificacion.push({ turnId: t.id, semaforo: "yellow", detalle: "Cita declarada sin soporte directo encontrado — revisar" });
      } else {
        verificacion.push({ turnId: t.id, semaforo: "red", detalle: "Afirmación sin sustento en el corpus — NO VERIFICADO" });
      }
    }
  }

  const diversity = analyzeDiversity(script);

  // Segunda pasada de naturalidad (opcional por defecto ACTIVADA):
  // modifica estilo, no contenido factual; luego re-verifica.
  let pulido = false;
  let polishNote: string | null = null;
  if (body.pulir !== false) {
    const result = polishDialogue(script);
    if (result.lineasFactualesIntactas) {
      script = result.script;
      pulido = result.cambios > 0;
      if (pulido) {
        for (const t of script.turns) {
          if (t.citations.length === 0 && t.text.trim().length >= 25) {
            const check = catalog.verifyClaim(t.text);
            if (check.state !== "VERIFIED") {
              verificacion.push({ turnId: t.id, semaforo: "yellow", detalle: "Línea pulida sin soporte directo — es estilo, revisar" });
            }
          }
        }
      }
      polishNote = result.cambios > 0 ? `${result.cambios} ajustes de estilo aplicados (contenido factual intacto)` : "sin cambios de estilo necesarios";
    } else {
      polishNote = "polisher omitido: modificó líneas factuales — se conservó el original";
    }
  }

  const metaPreSanitize = new Map(script.turns.map((t) => [t.id, t]));
  script = insertSponsorSlots(script, { enabled: comerciales, durationSec: duracionComercialSec });
  const editorial = sanitizeEditorialScript(script);
  script = editorial.script;
  // restaurar metadatos conversacionales que el sanitizador pudo perder
  for (const t of script.turns) {
    const prev = metaPreSanitize.get(t.id);
    if (prev) {
      t.intent = prev.intent; t.respondsTo = prev.respondsTo; t.emotion = prev.emotion;
      t.overlapPreviousMs = prev.overlapPreviousMs; t.sceneId = prev.sceneId; t.editorial = prev.editorial;
    }
  }
  const diversitySanitized = analyzeDiversity(script);
  const editorialQa = editorial.qa;

  json(res, 200, {
    script,
    modoLlmUsado,
    pipelineArtifacts,
    pipelineScore,
    modoUsado,
    proveedor: proveedorUsado,
    verificacion,
    diversity: diversitySanitized,
    diversityAntes: pulido ? diversity : null,
    pulido,
    polishNote,
    editorialQa,
    editorialCambios: editorial.cambios,
    recomendacion: duracionMin > 10 ? "ia" : "determinista",
    recomendacionDetalle:
      duracionMin > 10
        ? "Para programas largos se recomienda 'Natural con IA' (el modo determinista tiende a repetirse). El determinista permanece como fallback offline."
        : "El modo determinista es suficiente para programas cortos.",
    cobertura: {
      porcentaje: coverage.coverage,
      recomendado: coverage.recommended,
      items: coverage.items.map((i) => ({ label: i.label, estado: i.status === "available" ? "ok" : i.status === "review" ? "revisar" : "faltante" })),
      advertencias: coverage.warnings,
    },
    fragmentos: pack.relevantChunks.length,
  });
}

/** Raíces autorizadas para servir audio/media. Se resuelven con realpath. */
function mediaRoots(): string[] {
  return [
    path.join(REPO, "data", "tts"),
    path.join(REPO, "data", "projects"),
  ].map((p) => path.resolve(p));
}

async function handleMedia(res: http.ServerResponse, url: URL) {
  const raw = decodeURIComponent(url.searchParams.get("file") ?? "");
  if (!raw) return json(res, 400, { error: "file requerido" });
  const target = resolveMediaSafe(raw, mediaRoots());
  if (!target) return json(res, 404, { error: "archivo no disponible" });
  const ext = path.extname(target).toLowerCase();
  const mime = ext === ".wav" ? "audio/wav" : ext === ".mp3" ? "audio/mpeg" : ext === ".m4a" ? "audio/mp4" : "application/octet-stream";
  const buf = fs.readFileSync(target);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": buf.length, "Access-Control-Allow-Origin": "*" });
  res.end(buf);
}

const MUSICA_TIPOS: MusicaTipo[] = ["bed", "jingle", "sfx", "cortinilla", "ambiente"];

/** Estado del motor ACE-Step (server local de música). */
async function aceStepEstado(): Promise<Record<string, unknown>> {
  try {
    const health = await fetch(`${ACE_API}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()) as { data?: { service?: string; models_initialized?: boolean; loaded_model?: string } };
    const d = health.data ?? {};
    return {
      online: true,
      servicio: d.service ?? "ACE-Step API",
      modelo: d.loaded_model ?? null,
      modelosCargados: d.models_initialized ?? false,
    };
  } catch {
    return { online: false, servicio: null, modelo: null, modelosCargados: false, starting: false };
  }
}

async function handleMusica(res: http.ServerResponse) {
  const musicDir = path.join(REPO, "data", "tts", "music");
  const items: Array<Record<string, unknown>> = [];
  if (fs.existsSync(musicDir)) {
    for (const f of fs.readdirSync(musicDir)) {
      if (!/\.(wav|mp3|m4a)$/i.test(f)) continue;
      const esAce = /-ace-/.test(f);
      const esTest = /prueba|test/i.test(f);
      items.push({
        nombre: f,
        categoria: /jingle/.test(f) ? "jingle" : /cortinilla/.test(f) ? "cortinilla" : /bed|cama/.test(f) ? "bed" : /sfx/.test(f) ? "sfx" : "ambiente",
        duracionSec: null,
        licencia: esAce ? "MIT — ACE-Step 1.5" : esTest ? "TEST_ONLY_PLACEHOLDER" : "UNKNOWN",
        origen: esAce ? "generado localmente con ACE-Step 1.5 (acestep-v15-turbo, DiT, GTX 1650)" : esTest ? "sintetizado con ffmpeg (placeholder)" : "desconocido",
        notas: esTest ? "PLACEHOLDER DE PRUEBA — sustituir por música licenciada" : "",
        bytes: fs.statSync(path.join(musicDir, f)).size,
      });
    }
  }
  json(res, 200, items);
}

async function handleMusicaGenerar(res: http.ServerResponse, body: Record<string, unknown>) {
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return json(res, 400, { error: "prompt vacío" });
  const tipo = (MUSICA_TIPOS.includes(body.tipo as MusicaTipo) ? body.tipo : "bed") as MusicaTipo;
  const duracionSec = Math.min(120, Math.max(2, Number(body.duracionSec) || 30));

  const existente = leerJobMusica();
  if (existente && musicaWorkerVivo()) return json(res, 409, { error: "ya hay una generación musical en curso", job: resumenJobMusica(existente) });
  // El worker anterior murió (caída/cancelación forzada): el job queda en estado
  // RUNNING sin proceso vivo. Se marca como interrumpido para no bloquear el siguiente.
  if (existente && existente.estado === "RUNNING") {
    existente.estado = "INTERRUPTED";
    existente.error = "el worker murió sin finalizar la generación";
    existente.notas.push("interrumpido: el worker se detuvo antes de completar");
    guardarJobMusica(existente);
    console.warn(`[musica] job previo ${existente.id} quedó interrumpido (worker muerto)`);
  }

  let motor = await aceStepEstado();
  if (!motor.online) {
    const start = startAceStepIfNeeded();
    motor = { ...motor, starting: start.starting, startError: start.error };
    return json(res, 503, { error: start.error ? `no pude encender ACE-Step: ${start.error}` : "ACE-Step se está encendiendo; espera unos segundos y vuelve a generar", motor });
  }

  const job = nuevoJobMusica({ prompt, duracionSec, tipo });
  guardarJobMusica(job);
  spawnMusicaWorker();
  json(res, 202, { iniciado: true, job: resumenJobMusica(job) });
}

async function handleMusicaProgreso(res: http.ServerResponse) {
  const job = leerJobMusica();
  if (!job) return json(res, 200, { running: false, job: null });
  const hw = await detectHardware();
  json(res, 200, {
    running: musicaWorkerVivo(),
    gpu: { tempC: hw.gpu.tempC, vramUsadaMb: hw.gpu.vramUsedMb, vramTotalMb: hw.gpu.vramTotalMb },
    job: resumenJobMusica(job),
  });
}

async function handleMusicaMotor(res: http.ServerResponse) {
  let motor = await aceStepEstado();
  if (!motor.online) {
    const start = startAceStepIfNeeded();
    motor = { ...motor, starting: start.starting, startError: start.error };
  }
  const rtf = await readMusicaBenchmarkRtf();
  json(res, 200, {
    ...motor,
    provider: "acestep-local",
    modeloCompleto: "acestep-v15-turbo (DiT only, INT8, CPU offload, Tier 1)",
    rtfBenchmark: rtf,
    offline: true,
    costoApi: "$0.00",
  });
}

async function handleMusicaCancelar(res: http.ServerResponse) {
  const job = leerJobMusica();
  if (!job) return json(res, 404, { error: "no hay generación musical" });
  job.estado = "PAUSED";
  job.cancelado = true;
  job.notas.push("cancelado por el usuario");
  guardarJobMusica(job);
  json(res, 200, { cancelado: true, job: resumenJobMusica(job) });
}

async function handleDocList(res: http.ServerResponse) {
  const catalog = new NormativeCatalog(REPO);
  const states = new Map(catalog.db.listSourceStates().map((s) => [s.id, s]));
  json(res, 200, catalog.listDocuments().map((d) => {
    const ver = d.currentVersion ? catalog.getVersion(d.currentVersion) : null;
    const state = states.get(d.id);
    return {
      id: d.id,
      title: d.title,
      validity: d.validity,
      category: d.category,
      pages: ver?.pages ?? null,
      versionLabel: ver?.label ?? null,
      sourceState: state?.state ?? null,
      lastError: state?.lastError ?? null,
    };
  }));
}

async function handleNormativaBuscar(res: http.ServerResponse, body: Record<string, unknown>) {
  const query = String(body.query ?? "").trim();
  if (!query) return json(res, 400, { error: "consulta vacía" });
  const catalog = new NormativeCatalog(REPO);
  const hits = catalog.searchNormativeCorpus(query, { limit: 20 });
  json(res, 200, { total: hits.length, hits: hits.map((h) => ({
    documentId: h.documentId,
    documentTitle: h.documentTitle,
    clause: h.clause,
    article: h.article,
    pdfPageIndex: h.pdfPageIndex,
    printedPage: h.printedPage,
    snippet: h.snippet.replace(/\[|\]/g, ""),
    text: h.text,
    validity: h.validity,
  })) });
}

async function handleSistema(res: http.ServerResponse) {
  const hw = await detectHardware();
  let cpuLoad: number | null = null;
  try {
    const out = execFileSync("powershell", [
      "-NoProfile", "-NonInteractive", "-Command",
      "(Get-CimInstance Win32_Processor).LoadPercentage",
    ], { timeout: 8000, encoding: "utf8" });
    cpuLoad = Number(out.trim().split(/\s+/)[0]);
    if (!Number.isFinite(cpuLoad)) cpuLoad = null;
  } catch { /* no disponible */ }

  const top: Array<{ nombre: string; cpuDelta: number }> = [];
  try {
    const out = execFileSync("powershell", [
      "-NoProfile", "-NonInteractive", "-Command",
      "$a=Get-Process | Select-Object Id,Name,CPU; Start-Sleep -Milliseconds 1200; $b=Get-Process | Select-Object Id,Name,CPU; $d=@{}; foreach($p in $a){$d[$p.Id]=$p.CPU}; foreach($p in $b){$delta=[math]::Round($p.CPU-($d[$p.Id]??0),2); if($delta -gt 0.05){[pscustomobject]@{N=$p.Name;C=$delta}}}; $r=Get-Process | Select-Object -First 0; (($b | ForEach-Object { $dd=[math]::Round($_.CPU-($d[$_.Id]??0),2); if($dd -gt 0.05){[pscustomobject]@{N=$_.Name;C=$dd}} }) | Sort-Object C -Descending | Select-Object -First 8 | ForEach-Object { \"$($_.N)=$($_.C)\" })",
    ], { timeout: 15000, encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^(.+)=([\d.]+)$/);
      if (m) top.push({ nombre: m[1].trim(), cpuDelta: Number(m[2]) });
    }
  } catch { /* no disponible */ }

  const cargaAlta = (cpuLoad != null && cpuLoad > 70) || top.some((t) => /docker|chrome|msedge|code|node|python/i.test(t.nombre) && t.cpuDelta > 1.5);
  json(res, 200, {
    cpuLoad,
    ramLibreGb: hw.ramFreeGb,
    gpu: { tempC: hw.gpu.tempC, vramUsadaMb: hw.gpu.vramUsedMb, vramTotalMb: hw.gpu.vramTotalMb, util: hw.gpu.gpuUtil },
    procesosCompetidores: top.slice(0, 8),
    cargaAlta,
    aviso: cargaAlta
      ? "⚠ Rendimiento TTS reducido por carga del sistema. Se recomienda cerrar Docker, procesos de compilación y aplicaciones pesadas antes de producir."
      : null,
  });
}

async function handleFallbackTts(res: http.ServerResponse, body: Record<string, unknown>) {
  const escenas = Array.isArray(body.escenas) ? (body.escenas as Array<{ locutor: string; linea: string }>) : [];
  if (escenas.length === 0) return json(res, 400, { error: "sin escenas" });
  const eng = ensureEngine();
  try {
    const wavs: string[] = [];
    for (let i = 0; i < escenas.length; i++) {
      const voz = vozPorLocutor(escenas[i].locutor, {});
      const ident = identidadParaVoz(voz);
      const r = await eng.generate(cleanTtsText(escenas[i].linea), voz, {
        voiceId: ident?.voiceSourceId,
        characterId: ident?.profileId,
        seed: i,
      });
      if (!r.ok || !r.path) continue;
      wavs.push(r.path);
    }
    json(res, 200, { engine: "speechify", model: SPEECHIFY_MODEL, language: SPEECHIFY_LANGUAGE, wavs, blocks: wavs.length, total: escenas.length });
  } catch (e) {
    json(res, 502, { error: e instanceof Error ? e.message : String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  // Robustez: un cliente que se desconecta a mitad de request (navegador cerrado,
  // fetch abortado) no debe tumbar el sidecar.
  req.on("error", () => {});
  res.on("error", () => {});
  res.on("close", () => { if (res.writableEnded === false) res.destroy(); });
  try {
    if (req.method === "OPTIONS") return corsPreflight(res);
    if (req.method === "GET" && url.pathname === "/status") return await handleStatus(res);
    if (req.method === "GET" && url.pathname === "/casting") return await handleCasting(res);
    if (req.method === "POST" && url.pathname === "/casting/refresh") return await handleCastingRefresh(res);
    if (req.method === "GET" && url.pathname === "/progress") return await handleProgress(res);
    if (req.method === "GET" && url.pathname === "/musica") return await handleMusica(res);
    if (req.method === "GET" && url.pathname === "/musica/motor") return await handleMusicaMotor(res);
    if (req.method === "GET" && url.pathname === "/musica/progreso") return await handleMusicaProgreso(res);
    if (req.method === "POST" && url.pathname === "/musica/generar") return await handleMusicaGenerar(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/musica/cancelar") return await handleMusicaCancelar(res);
    if (req.method === "GET" && url.pathname === "/media") return await handleMedia(res, url);
    if (req.method === "GET" && url.pathname === "/events") return await handleSse(res, req);
    if (req.method === "GET" && url.pathname === "/normativa/documentos") return await handleDocList(res);
    if (req.method === "POST" && url.pathname === "/normativa/buscar") return await handleNormativaBuscar(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/investigar") return await handleInvestigar(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/guion") return await handleGuion(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/director") return await handleDirector(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/director/ajustar") return await handleAjustarGuion(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/generate") return await handleGenerate(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/resume") return await handleResume(res);
    if (req.method === "GET" && url.pathname === "/sistema") return await handleSistema(res);
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true, pid: process.pid, ready: true, port: PORT, bundle: BUNDLE_MTIME });
    if (req.method === "GET" && url.pathname === "/llm/health") return await handleLlmHealth(res);
    if (req.method === "POST" && url.pathname === "/llm/unload") return await handleLlmUnload(res);
    if (req.method === "POST" && url.pathname === "/cancel") return await handleCancel(res);
    if (req.method === "POST" && url.pathname === "/discard") return await handleDiscard(res);
    if (req.method === "POST" && url.pathname === "/master") return await handleMaster(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/regenerate") return await handleRegenerate(res, await readBody(req));
    if (req.method === "POST" && url.pathname === "/tts-fallback") return await handleFallbackTts(res, await readBody(req));
    // ── Rutas de proyecto (proposal-first) ──
    const pctx: ProjectRouteCtx = {
      store: projectStore,
      workflow: getWorkflow(),
      commercials: commercialService,
      json,
      startProduction: startProjectProduction,
      onDelete: deleteProjectCleanup,
    };
    if (await routeProject(url, req, res, pctx, () => readBody(req))) return;
    const cctx: CommercialRouteCtx = { commercials: commercialService, json };
    if (await routeCommercial(url, req, res, cctx, () => readBody(req))) return;
    json(res, 404, { error: "ruta desconocida" });
  } catch (e) {
    if (url.pathname.startsWith("/projects")) {
      const friendly = friendlyProjectError(e);
      json(res, 500, friendly);
      return;
    }
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

/**
 * Inicia la producción TTS real de un proyecto en la cola existente.
 * Reutiliza job-store + worker Speechify: GUIÓN → bloques → voces (resumible).
 */
async function startProjectProduction(id: string, script: StudioScript): Promise<{ started: boolean; total: number }> {
  clearProductionCancel();
  const voces: Record<string, VoiceSlot> = {};
  for (const t of script.turns) {
    if (!voces[t.speaker]) voces[t.speaker] = vozPorLocutor(t.speaker, {});
  }
  const bloques = script.turns.filter((t) => !t.adSlot).map((t) => ({ id: t.id, texto: t.ttsText ?? t.displayText, locutor: t.speaker }));
  const existente = leerJob();
  // Ya hay producción de ESTE proyecto activa → reanudar, no fallar (idempotente).
  if (existente && existente.estado !== "DONE" && existente.id === id) {
    spawnWorker();
    projectLog(id, "production.started", { total: existente.bloques.length, resumido: true });
    return { started: true, total: existente.bloques.length };
  }
  if (existente && workerVivo() && existente.estado !== "DONE" && existente.id !== id) {
    throw new Error("ya hay una producción en curso");
  }
  const perfiles = resolveVoiceProfiles(DEFAULT_SPEAKERS);
  const perfilPorId = new Map(perfiles.map((p) => [p.id, p]));
  const job = nuevoJob(
    id,
    script.topic,
    bloques.map((b) => {
      const perfil = perfilPorId.get(b.locutor.toUpperCase());
      return {
        id: b.id,
        texto: b.texto,
        locutor: b.locutor,
        voz: vozPorLocutor(b.locutor, voces),
        voiceProfileId: perfil?.id,
        referenceAudioSha256: perfil?.referenceAudioSha256,
        voiceSourceId: perfil?.voiceSourceId,
        modelRevision: perfil?.modelRevision,
      };
    }),
    voces
  );
  guardarJob(job);
  spawnWorker();
  projectLog(id, "production.started", { total: bloques.length });
  return { started: true, total: bloques.length };
}

/** Limpia el trabajo de producción del proyecto si se elimina desde la lista. */
function deleteProjectCleanup(id: string): void {
  requestProductionCancel();
  const job = leerJob();
  if (job && job.id === id) {
    try {
      job.estado = "PAUSED";
      job.cancelado = true;
      job.notas.push("proyecto eliminado");
      guardarJob(job);
      detenerWorkersProduccion();
      eliminarAudioDeJob(job);
      eliminarJob();
    } catch { /* mejor esfuerzo */ }
  } else {
    detenerWorkersProduccion();
  }
  // El worker (en memoria) puede reescribir el archivo una vez antes de frenar
  // al terminar el bloque en curso; lo limpiamos poco después.
  setTimeout(() => { try { eliminarJob(); } catch { /* mejor esfuerzo */ } }, 1600);
}

/** SSE — progreso en tiempo real para el frontend. */
async function handleSse(res: http.ServerResponse, req: import("node:http").IncomingMessage): Promise<void> {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 3000\n\n");
  const client: SseClient = { id: ++sseSeq, res };
  sseClients.set(client.id, client);
  res.write(`event: ready\ndata: ${JSON.stringify({ ts: new Date().toISOString(), clients: sseClients.size })}\n\n`);
  const ping = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* muted */ }
  }, 15000);
  req.on("close", () => {
    clearInterval(ping);
    sseClients.delete(client.id);
    try { res.end(); } catch { /* muted */ }
  });
}

server.on("clientError", (_err, socket) => { socket.destroy(); });
server.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE") {
    // Ya hay un sidecar vivo: si responde sano, reutilizarlo y salir limpio.
    fetch(`http://127.0.0.1:${PORT}/health`)
      .then((r) => r.json())
      .then(() => {
        console.log(`[sidecar] ya hay una instancia sana en el puerto ${PORT} — reutilizando, saliendo.`);
        process.exit(0);
      })
      .catch(() => {
        console.error(`[sidecar] puerto ${PORT} ocupado por instancia NO sana. Aborta (no se duplica proceso).`);
        process.exit(1);
      });
    return;
  }
  console.error(`[sidecar] error de servidor: ${e.message}`);
});

const PID_FILE = path.join(REPO, "data", "tts", "sidecar.pid");
let BUNDLE_MTIME = 0;
try { BUNDLE_MTIME = Math.floor(fs.statSync(__filename).mtimeMs); } catch {}

server.listen(PORT, "127.0.0.1", () => {
  try { fs.mkdirSync(path.dirname(PID_FILE), { recursive: true }); fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}
  console.log(`[sidecar] AI Radio Studio local en http://127.0.0.1:${PORT} (pid ${process.pid})`);
});

// Shutdown limpio: liberar pid file y cerrar servidor.
function shutdown(signal: string) {
  console.log(`[sidecar] ${signal} recibido — apagando limpio…`);
  try { if (fs.readFileSync(PID_FILE, "utf8").trim() === String(process.pid)) fs.rmSync(PID_FILE, { force: true }); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
