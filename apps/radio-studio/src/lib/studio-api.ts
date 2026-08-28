/**
 * Cliente del sidecar local de AI Radio Studio (Node).
 * El sidecar expone HTTP en 127.0.0.1:3977 y ejecuta tts-core + corpus normativo.
 * Si no estÃ¡ disponible, devuelve estado demo (la UI funciona igual).
 */

const SIDECAR_URL = "http://127.0.0.1:3977";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Conexión realmente caída (el sidecar no responde en la red), NO un timeout. */
function isNetworkDown(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /failed to fetch|load failed|networkerror/i.test(`${e.name} ${e.message}`);
}

/** Tiempo de espera agotado (el motor sigue trabajando; no es conexión perdida). */
function isTimeout(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "AbortError" || /abort|timeout|timed out/i.test(`${e.name} ${e.message}`);
}

function motorLocalError(): Error {
  return new Error("No pude conectar con el motor local. Cierra y vuelve a abrir AI Radio Studio; si sigue igual, revisa que el sidecar esté iniciado.");
}

function motorWorkingError(): Error {
  return new Error("El motor local está trabajando en tu solicitud. Espera un momento; la conexión sigue activa.");
}

async function parseError(res: Response): Promise<Error> {
  try {
    const body = await res.json() as { error?: string };
    if (body?.error) return new Error(body.error);
  } catch { /* respuesta no JSON */ }
  return new Error(`sidecar ${res.status}`);
}

async function post<T>(path: string, body: unknown, timeoutMs = 15000, startupRetries = 0): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
      try {
        const res = await fetch(`${SIDECAR_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) throw await parseError(res);
        return (await res.json()) as T;
      } catch (e) {
        // Un timeout NO significa que el sidecar esté caído: el motor puede estar
        // generando con el LLM local y tardar varios minutos.
        if (isTimeout(e)) throw motorWorkingError();
        if (attempt >= startupRetries || !isNetworkDown(e)) {
          if (isNetworkDown(e)) throw motorLocalError();
          throw e;
        }
        await sleep(Math.min(1200 + attempt * 700, 3500));
      }
    }
    throw motorLocalError();
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SIDECAR_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`sidecar ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface StudioStatus {
  motor: {
    provider: string;
    model: string;
    device: string;
    calidad: "GOOD" | "USABLE" | "SLOW" | "UNSTABLE" | "UNSUPPORTED" | "UNKNOWN";
    offline: boolean;
    costoApi: string;
    vramTotalMb: number | null;
    vramUsadaMb: number | null;
    tempC: number | null;
    rtfConservador: number;
    estado: "listo" | "cargando" | "apagado" | "error";
  };
  corpus: {
    documentos: number;
    vigentes: number;
    pendientes: number;
    disponibles?: number;
    verificadas?: number;
    bloqueadas?: number;
    porRevisar?: number;
    historicos?: number;
  };
  cache: { hits: number; misses: number; entries: number };
  hardware?: { perfil: string; gpu: string | null; bateria: boolean };
}

const DEMO_STATUS: StudioStatus = {
  motor: {
    provider: "qwen-base-clone",
    model: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device: "cuda",
    calidad: "GOOD",
    offline: true,
    costoApi: "$0.00",
    vramTotalMb: 4096,
    vramUsadaMb: null,
    tempC: null,
    rtfConservador: 1.96,
    estado: "apagado",
  },
  corpus: { documentos: 53, vigentes: 10, pendientes: 12, disponibles: 0, verificadas: 0, bloqueadas: 0, porRevisar: 12, historicos: 0 },
  cache: { hits: 0, misses: 0, entries: 0 },
};

export async function fetchStudioStatus(): Promise<{ status: StudioStatus; sidecarOnline: boolean }> {
  try {
    const status = await get<StudioStatus>("/status", 4000);
    return { status, sidecarOnline: true };
  } catch {
    return { status: DEMO_STATUS, sidecarOnline: false };
  }
}

export interface CastingProfile {
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
}

export interface CastingResult {
  perfiles: CastingProfile[];
  personas: Array<{
    id: string;
    displayName: string;
    role: string;
    userAssignedVoiceRole: string;
    voz: VoiceSlot;
    descripcion: string;
    acento: string;
    diccion: string;
    estilo: string;
    entonacion: string;
    objetivo: string;
  }>;
  casting: { ok: boolean; estado: string };
}

export async function obtenerCasting(): Promise<CastingResult | null> {
  try {
    return await get<CastingResult>("/casting", 5000);
  } catch {
    return null;
  }
}

export interface CoverageData {
  porcentaje: number;
  recomendado: boolean;
  items: Array<{ label: string; estado: "ok" | "faltante" | "revisar" }>;
  advertencias: string[];
}

export interface ResearchResult {
  tema: string;
  fragmentos: number;
  afirmaciones: number;
  investigador?: string;
  analisisIa?: {
    enfoque?: string;
    preguntasTrabajador?: string[];
    subtemas?: string[];
    fuentesClave?: string[];
    faltantes?: string[];
    riesgos?: string[];
    publicable?: boolean;
    error?: string;
  } | null;
  cobertura: CoverageData;
}

export async function investigar(tema: string): Promise<ResearchResult> {
  try {
    return await post<ResearchResult>("/investigar", { tema }, 45000, 8);
  } catch {
    return {
      tema,
      fragmentos: 12,
      afirmaciones: 8,
      cobertura: {
        porcentaje: 67,
        recomendado: false,
        items: [
          { label: "CCT 2025-2027", estado: "ok" },
          { label: "LFT vigente", estado: "ok" },
          { label: "Procedimiento 1A74-003-031", estado: "faltante" },
        ],
        advertencias: [],
      },
    };
  }
}

export interface GuionResult {  tema: string;
  guion: { titulo: string; escenas: Array<{ locutor: string; linea: string; citas: string[] }> };
  citas: Record<string, { documento: string; clausula: string | null; articulo: string | null; pagina: number | null }>;
  cutoff: string;
  fuentes: Array<{ id: string; title: string; versionLabel: string; sha256: string }>;
}

import type { DialogueTurn } from "@la-veinte/radio-core";
import type { SpeakerProfile, VoiceSlot } from "@la-veinte/radio-core";
export type { DialogueTurn, SpeakerProfile };

export interface DirectorResult {
  script: {
    tema: string;
    formato: string;
    nivel: string;
    speakers: SpeakerProfile[];
    scenes: Array<{ id: string; titulo: string; turns: DialogueTurn[] }>;
    turns: DialogueTurn[];
    cutoff: string;
    fuentes: Array<{ id: string; title: string; versionLabel: string; sha256: string }>;
    estimacionDurSec: number;
  };
  cobertura: CoverageData;
  fragmentos: number;
  editorialQa?: {
    score: number;
    issues: Array<{ tipo: string; severidad: "baja" | "media" | "alta"; detalle: string; ocurrencias: number }>;
    stats: { turnos: number; cortinillasInternas: number; pausasLargas: number; cierresPrematuros: number; temasDesviados: number };
  };
  editorialCambios?: number;
}

export async function dirigirPrograma(
  tema: string,
  nivel: "informativo" | "natural" | "dinamico",
  duracionMin: number,
  modo: "determinista" | "ia" = "ia",
  contextoExtra = "",
  comerciales = true,
  duracionComercialSec = 30,
  speakers?: SpeakerProfile[]
): Promise<DirectorResult> {
  return post<DirectorResult>(
    "/director",
    { tema, nivel, duracionMin, modo, contextoExtra, comerciales, duracionComercialSec, speakers, pulir: true, modoCita: "natural" },
    modo === "ia" ? 600000 : 45000,
    8
  );
}

export interface AjusteGuionResult {
  script: DirectorResult["script"];
  nota: string;
  proveedor: string;
  editorialQa?: DirectorResult["editorialQa"];
  editorialCambios?: number;
  verificacion?: Array<{ turnId: string; semaforo: "green" | "yellow" | "red"; detalle: string | null }>;
  fragmentos: number;
}

export async function ajustarGuion(opts: {
  script: DirectorResult["script"];
  contexto: string;
  scope: string;
}): Promise<AjusteGuionResult> {
  return post<AjusteGuionResult>("/director/ajustar", opts, 600000, 4);
}

export async function crearGuion(tema: string): Promise<GuionResult> {
  return post<GuionResult>("/guion", { tema }, 30000);
}

export interface MasterResult {
  master: string;
  bytes: number;
  turnos: number;
  duracionTotalMs: number;
  bedUsada: boolean;
  jingleUsado: boolean;
  introOutro?: number;
}

export interface MasterOptions {
  voces?: Record<string, VoiceSlot>;
  bed?: boolean;
  jingle?: boolean;
  kbps?: 128 | 192 | 256 | 320;
  formato?: "mp3" | "wav";
  ducking?: boolean;
  bedGainDb?: number;
  bedDuckDb?: number;
  duckAttack?: number;
  duckRelease?: number;
}

export async function masterPrograma(turns: DialogueTurn[], opts: MasterOptions = {}): Promise<MasterResult> {
  return post<MasterResult>(
    "/master",
    {
      turns,
      voces: opts.voces ?? {},
      bed: opts.bed !== false ? "auto" : false,
      jingle: opts.jingle !== false ? "auto" : false,
      kbps: opts.kbps ?? 192,
      formato: opts.formato ?? "mp3",
      ducking: opts.ducking !== false,
      bedGainDb: opts.bedGainDb ?? -25,
      bedDuckDb: opts.bedDuckDb ?? 6,
      duckAttack: opts.duckAttack ?? 120,
      duckRelease: opts.duckRelease ?? 1400,
    },
    600000
  );
}

export interface AudioItem {
  nombre: string;
  categoria: "jingle" | "cortinilla" | "bed" | "sfx" | "ambiente";
  duracionSec: number | null;
  licencia: string;
  origen: string;
  notas: string;
  bytes: number;
}

export async function listarAudio(): Promise<AudioItem[]> {
  try {
    return await get<AudioItem[]>("/musica", 4000);
  } catch {
    return [];
  }
}

export interface MusicaMotor {
  online: boolean;
  starting?: boolean;
  startError?: string | null;
  servicio: string | null;
  modelo: string | null;
  modelosCargados: boolean;
  provider: string;
  modeloCompleto: string;
  rtfBenchmark: number | null;
  offline: boolean;
  costoApi: string;
}

export async function obtenerMusicaMotor(): Promise<MusicaMotor | null> {
  try {
    return await get<MusicaMotor>("/musica/motor", 6000);
  } catch {
    return null;
  }
}

export type MusicaTipo = "bed" | "jingle" | "sfx" | "cortinilla" | "ambiente";

export interface MusicaJob {
  id: string;
  prompt: string;
  duracionSec: number;
  tipo: MusicaTipo;
  estado: "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "PAUSED";
  wavPath: string | null;
  genSec: number | null;
  rtf: number | null;
  seed: string | null;
  bpm: number | null;
  keyscale: string | null;
  bytes: number | null;
  licencia: string;
  origen: string;
  error: string | null;
  notas: string[];
}

export interface MusicaProgreso {
  running: boolean;
  gpu: { tempC: number | null; vramUsadaMb: number | null; vramTotalMb: number | null };
  job: MusicaJob | null;
}

export async function generarMusica(opts: { prompt: string; tipo: MusicaTipo; duracionSec: number }): Promise<{ iniciado: boolean; job: MusicaJob }> {
  return post<{ iniciado: boolean; job: MusicaJob }>("/musica/generar", opts, 20000);
}

export async function obtenerMusicaProgreso(): Promise<MusicaProgreso | null> {
  try {
    return await get<MusicaProgreso>("/musica/progreso", 4000);
  } catch {
    return null;
  }
}

export async function cancelarMusica(): Promise<void> {
  try {
    await post("/musica/cancelar", {}, 4000);
  } catch { /* sidecar apagado */ }
}

export interface DocResumen {
  id: string;
  title: string;
  validity: string;
  category: string;
  pages: number | null;
  versionLabel: string | null;
  sourceState?: string | null;
  lastError?: string | null;
}

export async function buscarNormativa(query: string): Promise<{ total: number; hits: Array<Record<string, unknown>> }> {
  try {
    return await post<{ total: number; hits: Array<Record<string, unknown>> }>("/normativa/buscar", { query }, 20000);
  } catch {
    return { total: 0, hits: [] };
  }
}

export async function listarDocumentos(): Promise<DocResumen[]> {
  try {
    return await get<DocResumen[]>("/normativa/documentos", 4000);
  } catch {
    return [];
  }
}

export interface BloqueProgreso {
  id: string;
  texto: string;
  locutor: string;
  voz: string;
  estado: "pendiente" | "generado" | "fallo";
  durMs: number | null;
  rtf: number | null;
  cacheHit: boolean;
  error: string | null;
  wavPath: string | null;
}

export interface ProgresoProduccion {
  running: boolean;
  paused?: boolean;
  estado: string | null;
  tema?: string;
  total: number;
  done: number;
  cacheHits: number;
  generados?: number;
  generated?: number;
  fallos: number;
  current: string | null;
  porLocutor: Record<string, { hecho: number; total: number }>;
  bloques?: BloqueProgreso[];
  gpu: { tempC: number | null; vramUsadaMb: number | null; vramTotalMb: number | null };
  rtf?: number | null;
  rtfReciente?: number | null;
  audioPendienteEstimadoMs?: number;
  reiniciosPrevistos?: number;
  etaMin?: number;
  reiniciosWorker?: number;
  vozAcumuladaDesdeReinicioMs?: number;
  tiempoRestanteMin: number | null;
  masterMp3: string | null;
  notas?: string[];
}

export async function iniciarGeneracion(
  bloques: Array<{ id: string; texto: string; locutor: string }>,
  voces: Record<string, VoiceSlot> = {}
): Promise<{ iniciado: boolean; total: number }> {
  return post<{ iniciado: boolean; total: number }>("/generate", { bloques, voces }, 15000);
}

/** Regenera una intervención pasando el contexto (anterior + siguiente) al motor. */
export async function regenerarTurno(opts: {
  turnId: string;
  texto: string;
  locutor: string;
  prevTexto?: string;
  nextTexto?: string;
  voces?: Record<string, VoiceSlot>;
}): Promise<{ regenerado: boolean; wavPath: string | null; url: string; durS: number | null }> {
  return post("/regenerate", opts, 120000);
}

// ─── IA local (Ollama/Qwen) ──────────────────────────────────────────────

export interface LlmHealthInfo {
  config: { model: string; enabled: boolean; contextTokens: number };
  health: { ok: boolean; version?: string; error?: string };
  modelos: string[];
  modeloObjetivoOk: boolean;
  gpu: { state: string; owner: string | null; lastError: string | null };
  stats: Array<{ name: string; sizeVramMb: number | null }>;
}

export async function obtenerLlmSalud(): Promise<LlmHealthInfo | null> {
  try {
    return await get<LlmHealthInfo>("/llm/health", 5000);
  } catch {
    return null;
  }
}

export async function obtenerProgreso(): Promise<ProgresoProduccion | null> {
  try {
    return await get<ProgresoProduccion>("/progress", 4000);
  } catch {
    return null;
  }
}

export interface SistemaInfo {
  cpuLoad: number | null;
  ramLibreGb: number;
  gpu: { tempC: number | null; vramUsadaMb: number | null; vramTotalMb: number | null; util: number | null };
  procesosCompetidores: Array<{ nombre: string; cpuDelta: number }>;
  cargaAlta: boolean;
  aviso: string | null;
}

export async function obtenerSistema(): Promise<SistemaInfo | null> {
  try {
    return await get<SistemaInfo>("/sistema", 20000);
  } catch {
    return null;
  }
}

export async function reanudarProduccion(): Promise<{ reanudado: boolean }> {
  return post("/resume", {}, 4000);
}

export async function cancelarProduccion(): Promise<void> {
  try {
    await post("/cancel", {}, 4000);
  } catch { /* sidecar apagado */ }
}

export async function descartarProduccion(): Promise<{ eliminado: boolean; wavsEliminados?: number }> {
  try {
    return await post<{ eliminado: boolean; wavsEliminados?: number }>("/discard", {}, 10000);
  } catch {
    return { eliminado: true };
  }
}

export async function masterEpisodio(bloques: Array<{ texto: string; locutor: string }>): Promise<{ master: string; bytes: number; faltantes: string[] }> {
  return post("/master", { bloques }, 600000);
}

export const SIDECAR_URL_EXPORT = SIDECAR_URL;

// ─── Proyecto (flujo proposal-first) ─────────────────────────────────────────

import type {
  Project,
  ProjectConfig,
  ResearchBundle,
  Proposal,
  VerifyResult,
  Script,
  Commercial,
} from "@la-veinte/studio-contract";

export interface CreateProjectInput {
  topic: string;
  config?: Partial<ProjectConfig>;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return post<Project>("/projects", {
    topic: input.topic,
    config: {
      duracionMin: 15,
      profundidad: "estandar",
      nivel: "natural",
      contextoExtra: "",
      modo: "ia",
      comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
      ...(input.config ?? {}),
    },
  }, 20000, 3);
}

export async function listProjects(): Promise<Project[]> {
  try {
    return await get<Project[]>("/projects", 5000);
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    return await get<Project>(`/projects/${id}`, 5000);
  } catch {
    return null;
  }
}

async function del<T>(path: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SIDECAR_URL}${path}`, { method: "DELETE", signal: controller.signal });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteProject(id: string): Promise<{ deleted: boolean; id: string }> {
  return del<{ deleted: boolean; id: string }>(`/projects/${id}`);
}

export async function projectResearch(id: string): Promise<{ project: Project; research: ResearchBundle }> {
  return post<{ project: Project; research: ResearchBundle }>(`/projects/${id}/research`, {}, 90000, 3);
}

export async function projectProposal(id: string): Promise<{ project: Project; proposal: Proposal }> {
  return post<{ project: Project; proposal: Proposal }>(`/projects/${id}/proposal`, {}, 900000, 2);
}

export async function projectProposalUpdate(id: string, patch: Partial<Proposal>): Promise<Project> {
  return post<Project>(`/projects/${id}/proposal/update`, { patch }, 20000, 3);
}

export async function projectApprove(id: string): Promise<Project> {
  return post<Project>(`/projects/${id}/approve`, {}, 20000, 3);
}

export async function projectScript(id: string, modo?: "determinista" | "ia"): Promise<{ project: Project; script: Script; verify: VerifyResult }> {
  return post<{ project: Project; script: Script; verify: VerifyResult }>(`/projects/${id}/script`, { modo }, 900000, 2);
}

export async function projectVerify(id: string): Promise<VerifyResult> {
  return post<VerifyResult>(`/projects/${id}/verify`, {}, 60000, 3);
}

export async function projectProduce(id: string): Promise<{ project: Project; started?: { started: boolean; total: number } }> {
  return post<{ project: Project; started?: { started: boolean; total: number } }>(`/projects/${id}/produce`, {}, 30000, 3);
}

export async function listCommercials(): Promise<Commercial[]> {
  try {
    return await get<Commercial[]>("/commercials", 5000);
  } catch {
    return [];
  }
}

export async function seedCommercials(): Promise<{ added: number; items: Commercial[] }> {
  return post<{ added: number; items: Commercial[] }>("/commercials?seed=true", {}, 10000).catch(() => ({ added: 0, items: [] } as { added: number; items: Commercial[] }));
}
