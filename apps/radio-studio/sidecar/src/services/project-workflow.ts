/**
 * ProjectWorkflowService — flujo proposal-first de un episodio.
 *
 * tema → research (biblioteca) → claims/coverage → PROPUESTA → aprobación
 * → guion por secciones → verificación factual → producción.
 *
 * Reutiliza la infraestructura existente (catálogo, cobertura, directRadioEpisode,
 * ScriptPipeline, cola de producción) en vez de reescribirla. El LLM local solo
 * razona/dirige/escribe; el corpus es la fuente de verdad.
 */
import {
  ProjectStore,
  type CreateProjectInput,
} from "./project-store";
import { NormativeCatalog } from "../../../../../src/features/normativa/services/catalog";
import { buildCoverage } from "../../../../../src/features/normativa/services/coverage";
import { LocalEditorialLLM } from "../llm/editorial/editorial-llm";
import { ScriptPipeline, buildEvidencePackV2 } from "../llm/pipeline";
import {
  researchPackToBundle,
  claimsFlat,
  coverageFlat,
} from "./studio-converters";
import {
  DEFAULT_SPEAKERS,
  directRadioEpisode,
  polishDialogue,
  sanitizeEditorialScript,
  validateRoleFirewall,
  type DialogueTurn,
  type EpisodeScript,
  type SpeakerProfile,
  type CitationMode,
  type VoiceSlot,
} from "@la-veinte/radio-core";
import {
  type Project,
  type ResearchBundle,
  type Proposal,
  type Script,
  type Turn,
  type VerifyResult,
  type ProjectConfig,
  EDITORIAL_FORMATS,
  EditorialFormatSchema,
  PROFUNDIDAD_MIN,
} from "@la-veinte/studio-contract";
import { planCommercialPlacements } from "./commercial-service";
import { verifyScript, type VerifierContext } from "./factual-verifier";
import type { Commercial, CommercialPlacement, Coverage } from "@la-veinte/studio-contract";

const EXPANSION_MAP: Record<string, string[]> = {
  "tiempo extra": ["jornada de trabajo", "descanso semanal", "pago de salario", "concepto 37"],
  extraordinario: ["jornada de trabajo", "descanso semanal", "pago de salario"],
  horario: ["jornada de trabajo", "turnos", "descanso semanal", "sustituciones"],
  vacacion: ["días de descanso", "prima vacacional", "permisos"],
  permiso: ["licencias", "permisos sindicales", "faltas"],
  nomina: ["pago de salario", "conceptos de nómina", "descuentos"],
  accidente: ["riesgos de trabajo", "incapacidad temporal", "ST-7", "dictaminación"],
};

function expansionQueries(topic: string): string[] {
  const t = topic.toLowerCase();
  const out: string[] = [];
  for (const [k, q] of Object.entries(EXPANSION_MAP)) {
    if (t.includes(k) || k.includes(t)) out.push(...q);
  }
  return [...new Set(out)].slice(0, 8);
}

export function autoFormat(topic: string): (typeof EDITORIAL_FORMATS)[number] {
  const t = topic.toLowerCase();
  if (/vacacion|permiso|licencia|solici[t]?o/.test(t)) return "GUIA_PASO_A_PASO";
  if (/horario|turno|cambiar|modificar tu/.test(t)) return "CASO_PRACTICO";
  if (/cambi[óo]|novedad|resumen de|actualizaci[óo]n|reforma/.test(t)) return "EXPLICADOR";
  if (/accidente|riesgo|enfermedad|incapacidad|derecho/.test(t)) return "CONSULTORIO";
  if (/debate|por[oó]u|diferencia|versus|argument/.test(t)) return "DEBATE";
  if (/bolet[ií]n|aviso|nuevo|actualiz/.test(t)) return "BOLETIN";
  if (/entrevista|pl[aá]tica con/.test(t)) return "ENTREVISTA_SIMULADA";
  return "EXPLICADOR";
}

const FIELD_WORDS = /unidad|hospital|guardia|terapia|piso|quir[oó]fano|urgencias|centro de salud|servicio|turno pr[aá]ctico|cl[ií]nica/i;

export function autoCast(topic: string, hasLegalClaims: boolean, comerciales: boolean): string[] {
  const ids: string[] = ["EDUARDO", "ANDREA"];
  if (hasLegalClaims) ids.push("NARRADOR"); // especialista normativo (id oficial "NARRADOR")
  if (FIELD_WORDS.test(topic.toLowerCase())) ids.push("RODRIGO");
  if (comerciales) ids.push("VALERIA");
  return ids;
}

/** Resuelve nombres/aliases a los ids oficiales del reparto (JAVIER ↔ NARRADOR, etc.). */
function canonicalSpeakerId(idOrName: string): string {
  const t = (idOrName ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("JAVIER") || t.includes("NARRADOR") || t.includes("ALONSO") || t.includes("RÍOS")) return "NARRADOR";
  if (t.includes("RODRIGO") || t.includes("CORRESPONSAL")) return "RODRIGO";
  if (t.includes("VALERIA") || t.includes("COMERCIAL") || t.includes("PATROCIN")) return "VALERIA";
  if (t.includes("ANDREA") || t.includes("MARIANA")) return "ANDREA";
  return "EDUARDO";
}

/** Duración objetivo (aproximada) desde la profundidad — es una guía, nunca un tope. */
function guiaMinutos(config: ProjectConfig): number {
  return (config && config.profundidad && PROFUNDIDAD_MIN[config.profundidad]) || config.duracionMin || 15;
}

function participantsToSpeakers(ids: string[], comerciales: boolean): SpeakerProfile[] {
  const byId = new Map(DEFAULT_SPEAKERS.map((s) => [s.id.toUpperCase(), s]));
  const resolved: SpeakerProfile[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const sp = byId.get(canonicalSpeakerId(raw));
    if (!sp || seen.has(sp.id)) continue;
    seen.add(sp.id);
    resolved.push(sp);
  }
  // garantía mínima de reparto: conductor + co-conductora
  const has = (i: string) => seen.has(i);
  if (!has("EDUARDO")) { resolved.unshift(byId.get("EDUARDO")!); seen.add("EDUARDO"); }
  if (!has("ANDREA")) { resolved.splice(1, 0, byId.get("ANDREA")!); seen.add("ANDREA"); }
  return resolved.filter(Boolean);
}

/** Convierte participantes del LLM (ids posiblemente vacíos) a ids oficiales del reparto. */
function normalizeParticipantes(participantes: Proposal["participantes"]): Proposal["participantes"] | null {
  if (!participantes || participantes.length === 0) return null;
  const byId = new Map(DEFAULT_SPEAKERS.map((s) => [s.id.toUpperCase(), s]));
  const out: Proposal["participantes"] = [];
  const seen = new Set<string>();
  for (const p of participantes) {
    const officialId = canonicalSpeakerId(p.nombre || p.id || "");
    const sp = byId.get(officialId);
    if (!sp || seen.has(sp.id)) continue;
    seen.add(sp.id);
    out.push({ ...p, id: sp.id, nombre: sp.nombre, rol: sp.rol, voz: sp.voz, participa: true });
  }
  return out.length > 0 ? out : null;
}

function voiceSlotForSpeaker(speaker: string): VoiceSlot {
  const s = speaker.toUpperCase();
  if (s.includes("VALERIA") || s.includes("COMERCIAL")) return "P";
  if (s.includes("RODRIGO") || s.includes("CORRESPONSAL")) return "C";
  if (s.includes("NARRADOR") || s.includes("JAVIER")) return "N";
  if (s.includes("ANDREA") || s.includes("MARIANA")) return "B";
  return "A";
}

export class ProjectWorkflowService {
  constructor(
    public store: ProjectStore,
    private repoRoot: string,
    private catalog: NormativeCatalog,
    private llm: LocalEditorialLLM,
    public commercials: import("./commercial-service").CommercialLibraryService
  ) {}

  async create(input: CreateProjectInput): Promise<Project> {
    return this.store.create(input);
  }

  async research(id: string): Promise<{ project: Project; research: ResearchBundle }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    // Corpus ausente: fail-closed. Sin biblioteca no se investiga — nunca se usa
    // el conocimiento paramétrico del LLM para inventar contenido.
    let docsCount = 0;
    try { docsCount = this.catalog.listDocuments().length; } catch { docsCount = 0; }
    if (docsCount === 0) throw new Error("LOCAL_LIBRARY_UNAVAILABLE");
    this.store.updateState(id, "RESEARCHING");
    const topic = project.topic;
    const pack = this.catalog.buildEvidencePack(topic, { limit: 25 });
    const expansion = expansionQueries(topic);
    for (const q of expansion) {
      const extra = this.catalog.buildEvidencePack(q, { limit: 8 });
      for (const c of extra.claims) {
        if (!pack.claims.some((x) => x.text === c.text)) {
          pack.claims.push(c);
          pack.relevantChunks.push(...extra.relevantChunks.filter((ch) => !pack.relevantChunks.includes(ch)));
        }
      }
      if (pack.claims.length >= 40) break;
    }
    const coverage = buildCoverage(this.catalog, topic);
    const bundle = researchPackToBundle(topic, pack, expansion, coverage, []);
    this.store.writeResearch(id, bundle);
    const next = this.store.update(id, { research: bundle, state: "RESEARCHED" })!;
    return { project: next, research: bundle };
  }

  async createProposal(id: string): Promise<{ project: Project; proposal: Proposal }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const research = this.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!research) throw new Error("RESEARCH_REQUIRED");
    const coverage = research.coverage;
    const claims = research.claims;
    const hasLegal = claims.some((c) => c.evidence.some((e) => e.clause || e.article));

    const base = deterministicProposal(project, research, hasLegal);
    let proposal: Proposal = base;
    if (project.config.modo === "ia") {
      try {
        const available = await this.llm.isAvailable();
        if (!available) throw new Error("LOCAL_LLM_UNAVAILABLE");
      const analysis = await this.llm.analyzeTopic(project.topic, claimsFlat(research.claims));
      const evaluation = await this.llm.evaluateEvidence(project.topic, claimsFlat(research.claims));
      const partial = await this.llm.createProposal({
        topic: project.topic,
        enfoque: analysis.enfoque,
        coverageSummary: coverageFlat(coverage),
        claimsFlat: claimsFlat(research.claims),
        duracionMin: guiaMinutos(project.config),
        nivel: project.config.nivel,
        comerciales: project.config.comerciales,
        participants: base.participantes.map((p) => p.id),
      });
      // fusionar la propuesta del motor local con el armazón determinista
      // (que aporta cobertura completos + estructura base si faltan)
      proposal = {
        ...base,
        ...partial,
        topic: project.topic,
        formato: partial.formato ?? base.formato,
        duracionEstimadaMin: partial.duracionEstimadaMin ?? base.duracionEstimadaMin,
        participantes: partial.participantes?.length ? partial.participantes : base.participantes,
        estructura: partial.estructura?.length ? partial.estructura : base.estructura,
        fuentes: partial.fuentes?.length ? partial.fuentes : base.fuentes,
        cobertura: coverage,
        huecos: [...new Set([...(partial.huecos ?? []), ...evaluation.faltantes, ...coverage.missing])],
        advertencias: [...new Set([...(partial.advertencias ?? []), ...evaluation.advertencias, ...coverage.warnings])],
        publicable: partial.publicable ?? base.publicable,
        decisionRationale: [...base.decisionRationale, "propuesta generada por el motor local"],
      };
      } catch (e) {
        proposal = base;
        proposal.decisionRationale.push(`propuesta determinista (${e instanceof Error ? e.message : "motor local no disponible"})`);
      }
    } else {
      proposal = base;
      proposal.decisionRationale.push("propuesta determinista (modo determinista)");
    }
    // Los participantes del LLM pueden venir con id vacío; los normalizamos a ids
    // oficiales del reparto (por nombre) y descartamos los que no cuadran.
    proposal.participantes = normalizeParticipantes(proposal.participantes) ?? base.participantes;
    proposal.topic = project.topic;
    proposal.createdAt = new Date().toISOString();
    this.store.writeProposal(id, proposal);
    const next = this.store.update(id, { proposal, state: "PROPOSAL_READY" })!;
    return { project: next, proposal };
  }

  async updateProposal(id: string, patch: Partial<Proposal>): Promise<Project> {
    const p = this.store.get(id);
    if (!p) throw new Error("PROJECT_NOT_FOUND");
    const current = this.store.readArtifact<Proposal>(id, "proposal.json") ?? p.proposal;
    if (!current) throw new Error("PROPOSAL_REQUIRED");
    const merged: Proposal = { ...current, ...patch, topic: p.topic };
    this.store.writeProposal(id, merged);
    return this.store.update(id, { proposal: merged, state: "PROPOSAL_READY" })!;
  }

  async approve(id: string): Promise<Project> {
    const p = this.store.get(id);
    if (!p) throw new Error("PROJECT_NOT_FOUND");
    if (!p.proposal) throw new Error("PROPOSAL_REQUIRED");
    return this.store.update(id, { state: "PROPOSAL_APPROVED" })!;
  }

  async generateScript(id: string, modoOverride?: "determinista" | "ia"): Promise<{ project: Project; script: Script; verify: VerifyResult }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const proposal = project.proposal;
    const research = this.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!proposal || !research) throw new Error("PROPOSAL_OR_RESEARCH_REQUIRED");
    const modo = modoOverride ?? project.config.modo;
    this.store.updateState(id, "SCRIPT_GENERATING");

    const claims = research.claims.map((c) => ({
      id: c.id, texto: c.statement, documento: c.evidence[0]?.document ?? "",
      clausula: c.evidence[0]?.clause ?? null, articulo: c.evidence[0]?.article ?? null, pagina: c.evidence[0]?.page ?? null,
    }));

    const speakers = participantsToSpeakers((proposal.participantes ?? []).map((p) => p.id), project.config.comerciales.enabled);
    const nivel = proposal.nivel as "informativo" | "natural" | "dinamico";
    const duracionMin = proposal.duracionEstimadaMin;

    let script: EpisodeScript = directRadioEpisode({
      tema: project.topic,
      duracionMin,
      speakers,
      nivel,
      claims,
      cutoff: research.cutoff,
      fuentes: research.documents.map((d) => ({ id: d.sourceId, title: d.title, versionLabel: d.versionLabel ?? "", sha256: d.sha256 ?? "" })),
      modoCita: "natural" as CitationMode,
    });

    let modoUsado = "determinista";
    if (modo === "ia") {
      try {
        const pack2 = buildEvidencePackV2(`p-${id}`, project.topic, claims, research.cutoff);
        const artifactsDir = this.store.artifactPaths(id).logsDir;
        const resultado = await new ScriptPipeline().run({
          tema: project.topic, duracionMin, speakers, nivel, claims,
          cutoff: research.cutoff,
          fuentes: research.documents.map((d) => ({ id: d.sourceId, title: d.title, versionLabel: d.versionLabel ?? "", sha256: d.sha256 ?? "" })),
          modoCita: "natural",
          evidencePack: pack2, artifactsDir,
        });
        if (resultado.turns.length >= 6 && validateRoleFirewall(resultado.turns).length === 0) {
          script = { ...script, turns: resultado.turns, scenes: groupScenes(resultado.turns), estimacionDurSec: Math.round(resultado.turns.reduce((a, t) => a + t.text.split(/\s+/).length / 2.6, 0)) };
          modoUsado = "local-ia";
        }
      } catch { /* fallback determinista */ }
    }

    // pulido de estilo (contenido factual intacto)
    const polished = polishDialogue(script);
    if (polished.lineasFactualesIntactas) script = polished.script;

    script = sanitizeEditorialScript(script).script;

    // map to studio contract
    const studioScript: Script = mapEpisodeScriptToStudio(script, project);

    // commercials
    const selections = project.config.comerciales;
    const lib = this.commercials.list({ onlyActive: true });
    let placements: CommercialPlacement[] = [];
    if (selections.enabled && lib.length > 0) {
      // Autorizados: los ids elegidos por el usuario; si no eligió, todos los activos.
      const authorized = selections.ids.length > 0 ? lib.filter((c) => selections.ids.includes(c.id)) : lib;
      const chosen = authorized.length > 0 ? authorized : lib;
      placements = planCommercialPlacements(studioScript.turns.map((t) => ({ id: t.id, speaker: t.speaker, text: t.displayText, adSlot: t.adSlot })), selections, chosen);
      applyCommercials(studioScript, placements, chosen, this.commercials);
    }

    // verificación factual
    const ctx: VerifierContext = {
      claims: research.claims,
      sources: new Map(research.documents.map((d) => [d.sourceId, d.document])),
      speakers: new Set(speakers.map((s) => s.id.toUpperCase())),
    };
    const verify = verifyScript(studioScript, ctx);

    this.store.writeScript(id, studioScript);
    this.store.writeCommercials(id, placements);
    const state = verify.verified ? "SCRIPT_READY" : "NEEDS_REVIEW";
    const next = this.store.update(id, { script: studioScript, state: state as Project["state"] })!;
    return { project: next, script: studioScript, verify };
  }

  async verify(id: string): Promise<VerifyResult> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const script = project.script ?? this.store.readArtifact<Script>(id, "script.json");
    if (!script) throw new Error("SCRIPT_REQUIRED");
    const research = this.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!research) throw new Error("RESEARCH_REQUIRED");
    const ctx: VerifierContext = {
      claims: research.claims,
      sources: new Map(research.documents.map((d) => [d.sourceId, d.document])),
      speakers: new Set((script.turns.map((t) => t.speaker)).map((s) => s.toUpperCase())),
    };
    return verifyScript(script, ctx);
  }

  async produce(id: string): Promise<Project> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    if (project.state !== "SCRIPT_APPROVED" && project.state !== "SCRIPT_READY") {
      throw new Error("PRODUCTION_REQUIRES_SCRIPT_APPROVED");
    }
    this.store.updateState(id, "PRODUCING");
    // La producción real la gestiona la cola existente (handleGenerate). Aquí solo
    // dejamos el proyecto listo para que el route /project/:id/produce la dispare.
    return this.store.update(id, { state: "PRODUCING" })!;
  }
}

function groupScenes(turns: DialogueTurn[]): EpisodeScript["scenes"] {
  const map = new Map<string, { id: string; titulo: string; turns: DialogueTurn[] }>();
  for (const t of turns) {
    const key = t.sceneId ?? "s1";
    if (!map.has(key)) map.set(key, { id: key, titulo: key, turns: [] });
    map.get(key)!.turns.push(t);
  }
  return [...map.values()];
}

export function deterministicProposal(project: Project, research: ResearchBundle, hasLegal: boolean): Proposal {
  const format = autoFormat(project.topic);
  const ids = autoCast(project.topic, hasLegal, project.config.comerciales.enabled);
  const estructura = defaultStructure(format);
  return {
    topic: project.topic,
    enfoque: `Explicar el tema de forma clara y cercana para trabajadoras y trabajadores: qué dice la normativa, cómo se aplica en la práctica y qué conviene revisar.`,
    formato: EditorialFormatSchema.parse(format),
    nivel: project.config.nivel as "informativo" | "natural" | "dinamico",
    duracionEstimadaMin: guiaMinutos(project.config),
    participantes: ids.map((id) => {
      const s = DEFAULT_SPEAKERS.find((x) => x.id.toUpperCase() === id.toUpperCase());
      return { id: s?.id ?? id, nombre: s?.nombre ?? id, rol: s?.rol ?? "participante", funcionEditorial: s?.funcionEditorial ?? null, voz: s?.voz ?? voiceSlotForSpeaker(id), participa: true };
    }),
    estructura,
    fuentes: research.claims.slice(0, 6).map((c) => c.evidence[0]?.document ?? "").filter(Boolean),
    cobertura: research.coverage,
    huecos: research.coverage.missing,
    comerciales: [],
    advertencias: research.coverage.warnings,
    publicable: research.coverage.recommended,
    decisionRationale: ["formato y reparto elegidos por heurística determinista"],
  };
}

function defaultStructure(format: string): Proposal["estructura"] {
  const base: Proposal["estructura"] = [
    { seccion: "Apertura", proposito: "Presentar el tema con una situación de arranque cercana." },
    { seccion: "Qué dice la normativa", proposito: "Explicar el fundamento con la fuente a la mano." },
  ];
  if (format === "GUIA_PASO_A_PASO") {
    base.push({ seccion: "Pasos a seguir", proposito: "Secuencia concreta para actuar." });
  }
  base.push({ seccion: "Ojo con esto", proposito: "Errores comunes y advertencias." });
  base.push({ seccion: "Cómo documentarlo", proposito: "Qué guardar y con quién acudir." });
  base.push({ seccion: "Cierre práctico", proposito: "3 pasos accionables." });
  return base;
}

function mapEpisodeScriptToStudio(script: EpisodeScript, project: Project): Script {
  const turns: Turn[] = script.turns.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    displayText: t.text,
    ttsText: t.text,
    section: t.sceneId ?? null,
    intent: t.intent ?? null,
    pauseIntent: t.intent === "interrupt_question" || t.intent === "interrupt_correction" ? "interruption" : t.intent === "summary" ? "reflective" : t.canOverlap ? "quick" : "normal",
    pauseBeforeMs: t.pauseBeforeMs ?? null,
    pauseAfterMs: t.pauseAfterMs ?? null,
    canOverlap: !!t.canOverlap,
    energy: t.energy ?? null,
    pace: t.pace ?? null,
    claimRefs: t.citations ?? [],
    sourceRefs: [],
    commercialContext: null,
    transition: t.transition ?? null,
    kind: (t.kind ?? "dialogue") as "dialogue" | "ad",
    adSlot: !!t.adSlot,
    adDurationSec: t.adDurationSec ?? null,
    sponsorName: t.sponsorName ?? null,
    sceneId: t.sceneId ?? null,
    respondsTo: t.respondsTo ?? null,
  }));
  return {
    topic: script.tema,
    formato: EditorialFormatSchema.parse(autoFormat(script.tema)),
    nivel: script.nivel as "informativo" | "natural" | "dinamico",
    speakers: [],
    scenes: script.scenes.map((s) => ({ id: s.id, titulo: s.titulo, turns: turns.filter((t) => t.sceneId === s.id) })),
    turns,
    cutoff: script.cutoff ?? null,
    estimacionDurSec: script.estimacionDurSec,
    generatedAt: new Date().toISOString(),
    promptVersion: null,
  };
}

function applyCommercials(script: Script, placements: CommercialPlacement[], lib: Commercial[], service: import("./commercial-service").CommercialLibraryService): void {
  const byId = new Map(lib.map((c) => [c.id, c]));
  for (const p of placements) {
    const commercial = byId.get(p.commercialId);
    if (!commercial) continue;
    const at = p.atIndex ?? Math.min(Math.max(4, Math.floor(script.turns.length * 0.55)), script.turns.length - 3);
    const before = script.turns[at - 1];
    const after = script.turns[at];
    const bridgeInTurn: Turn = {
      id: `ad-in-${p.commercialId}`,
      speaker: before?.speaker ?? "EDUARDO",
      displayText: `Antes de seguir, hagamos una breve pausa.`,
      ttsText: `Antes de seguir, hagamos una breve pausa.`,
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      transition: "espacio comercial",
      kind: "dialogue",
      adSlot: false,
      pauseBeforeMs: 220,
      pauseAfterMs: 220,
    };
    const commercialTurn: Turn = {
      id: `ad-${p.commercialId}`,
      speaker: commercial.presenter,
      displayText: commercial.baseText,
      ttsText: commercial.baseText,
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      transition: "comercial",
      kind: "ad",
      adSlot: true,
      adDurationSec: commercial.targetDuration,
      sponsorName: commercial.name,
      commercialContext: JSON.stringify(p),
      pauseBeforeMs: 200,
      pauseAfterMs: 200,
    };
    const bridgeOutTurn: Turn = {
      id: `ad-out-${p.commercialId}`,
      speaker: after?.speaker ?? "EDUARDO",
      displayText: `Ahora sí, seguimos con lo nuestro.`,
      ttsText: `Ahora sí, seguimos con lo nuestro.`,
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      transition: "espacio comercial",
      kind: "dialogue",
      adSlot: false,
      pauseBeforeMs: 220,
      pauseAfterMs: 240,
    };
    script.turns.splice(at, 0, bridgeInTurn, commercialTurn, bridgeOutTurn);
  }
  // reconstruir escenas
  script.scenes = groupScenesFromTurns(script.turns);
  script.estimacionDurSec = Math.round(script.turns.reduce((a, t) => a + t.displayText.split(/\s+/).length / 2.6, 0));
}

function groupScenesFromTurns(turns: Turn[]): Script["scenes"] {
  const map = new Map<string, { id: string; titulo: string; turns: Turn[] }>();
  for (const t of turns) {
    const key = t.sceneId ?? "s1";
    if (!map.has(key)) map.set(key, { id: key, titulo: key, turns: [] });
    map.get(key)!.turns.push(t);
  }
  return [...map.values()];
}
