/**
 * ProjectWorkflowService — flujo proposal-first de un episodio.
 *
 * TEMA → RESEARCH (biblioteca) → CLAIMS/COVERAGE → PROPUESTA (Groq)
 * → APROBACIÓN → GUION (Groq ScriptPipeline) → VERIFICACIÓN FACTUAL → PRODUCCIÓN.
 *
 * ARQUITECTURA PRODUCTIVA: GROQ-ONLY
 * Todo contenido editorial (propuestas, escaletas, guiones, diálogos y reparaciones)
 * es generado exclusivamente por Groq.
 * Código determinista actúa ÚNICAMENTE como guardarraíl y verificador.
 * Si Groq no está disponible o el contenido no pasa la verificación: NO SE GENERA EL EPISODIO.
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
  type Profundidad,
  EDITORIAL_FORMATS,
  EditorialFormatSchema,
  PROFUNDIDAD_MIN,
} from "@la-veinte/studio-contract";
import { planCommercialPlacements } from "./commercial-service";
import { verifyScript, type VerifierContext } from "./factual-verifier";
import type { Commercial, CommercialPlacement, Coverage } from "@la-veinte/studio-contract";
import {
  GroqUnavailableError,
  InsufficientEvidenceError,
  ProposalGenerationFailedError,
  ScriptQualityFailedError,
  ProductionBlockedError,
  GroqGenerationFailedError,
} from "../errors/editorial-errors";

const EXPANSION_MAP: Record<string, string[]> = {
  "tiempo extra": ["jornada de trabajo", "descanso semanal", "pago de salario", "concepto 37"],
  extraordinario: ["jornada de trabajo", "descanso semanal", "pago de salario"],
  horario: ["jornada de trabajo", "turnos", "descanso semanal", "sustituciones"],
  vacacion: ["días de descanso", "prima vacacional", "permisos", "continuidad", "antigüedad"],
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
  if (hasLegalClaims) ids.push("NARRADOR");
  if (FIELD_WORDS.test(topic.toLowerCase())) ids.push("RODRIGO");
  if (comerciales) ids.push("VALERIA");
  return ids;
}

/** Resuelve nombres/aliases a los ids oficiales del reparto */
function canonicalSpeakerId(idOrName: string): string {
  const t = (idOrName ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("JAVIER") || t.includes("NARRADOR") || t.includes("ALONSO") || t.includes("RÍOS")) return "NARRADOR";
  if (t.includes("RODRIGO") || t.includes("CORRESPONSAL")) return "RODRIGO";
  if (t.includes("VALERIA") || t.includes("COMERCIAL") || t.includes("PATROCIN")) return "VALERIA";
  if (t.includes("ANDREA") || t.includes("MARIANA")) return "ANDREA";
  return "EDUARDO";
}

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
  const has = (i: string) => seen.has(i);
  if (!has("EDUARDO")) { resolved.unshift(byId.get("EDUARDO")!); seen.add("EDUARDO"); }
  if (!has("ANDREA")) { resolved.splice(1, 0, byId.get("ANDREA")!); seen.add("ANDREA"); }
  return resolved.filter(Boolean);
}

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

/**
 * Quality Gate determinista para validar propuestas generadas por Groq.
 * Verifica que no sean genéricas y aborden los conceptos obligatorios del tema.
 */
export function evaluateProposalQuality(
  topic: string,
  proposal: Partial<Proposal>,
  research: ResearchBundle
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lowerEnfoque = (proposal.enfoque ?? "").toLowerCase();

  // 1. Detección de propuesta genérica / cliché
  if (
    lowerEnfoque.includes("cómo se aplica en la práctica y qué conviene revisar") ||
    lowerEnfoque.includes("qué dice la normativa, cómo se aplica y qué revisar") ||
    lowerEnfoque.length < 35
  ) {
    issues.push("El enfoque es genérico y no aborda las particularidades del tema.");
  }

  // 2. Comprobación de conceptos requeridos en el tema
  const lowerTopic = topic.toLowerCase();
  if (lowerTopic.includes("vacacion") || lowerTopic.includes("vacaciones")) {
    const mentionsInclusion = lowerTopic.includes("inclusion") || lowerTopic.includes("inclusión");
    const mentionsContinuidad = lowerTopic.includes("continuidad");
    const mentionsVencimiento = lowerTopic.includes("vencimiento");

    const fullText = (
      (proposal.enfoque ?? "") + " " +
      (proposal.estructura ?? []).map((e) => e.seccion + " " + e.proposito).join(" ")
    ).toLowerCase();

    if (mentionsInclusion && !fullText.includes("inclusi")) {
      issues.push("La propuesta de vacaciones debe abordar explícitamente las marcas de inclusión.");
    }
    if (mentionsContinuidad && !fullText.includes("continuidad")) {
      issues.push("La propuesta de vacaciones debe abordar explícitamente la continuidad.");
    }
    if (mentionsVencimiento && !fullText.includes("vencimiento")) {
      issues.push("La propuesta de vacaciones debe abordar explícitamente las fechas de vencimiento.");
    }
  }

  // 3. Estructura mínima y participantes
  if (!proposal.estructura || proposal.estructura.length < 3) {
    issues.push("La estructura debe contar con al menos 3 secciones definidas.");
  }
  if (!proposal.participantes || proposal.participantes.length < 2) {
    issues.push("Se requieren al menos 2 locutores para el episodio.");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export class ProjectWorkflowService {
  constructor(
    public store: ProjectStore,
    private repoRoot: string,
    private catalog: NormativeCatalog,
    public llm: LocalEditorialLLM,
    public commercials: import("./commercial-service").CommercialLibraryService
  ) {}

  get editorialLlm(): LocalEditorialLLM { return this.llm; }

  async create(input: CreateProjectInput): Promise<Project> {
    return this.store.create(input);
  }

  async research(id: string): Promise<{ project: Project; research: ResearchBundle }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    // Corpus ausente: fail-closed. Sin biblioteca no se investiga
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

  /**
   * Crea la propuesta editorial mediante Groq.
   * Sin fallback determinista. Si Groq falla o falta evidencia, se detiene.
   */
  async createProposal(id: string): Promise<{ project: Project; proposal: Proposal }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const research = this.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!research) throw new Error("RESEARCH_REQUIRED");

    // 1. Salud del motor Groq
    const available = await this.llm.isAvailable();
    if (!available) {
      this.store.updateState(id, "PROPOSAL_GENERATION_FAILED");
      throw new GroqUnavailableError("El motor editorial no está disponible.");
    }

    // 2. Gate de evidencia normativa
    const coverage = research.coverage;
    const claims = research.claims;
    if (!claims || claims.length === 0) {
      this.store.updateState(id, "PROPOSAL_GENERATION_FAILED");
      throw new InsufficientEvidenceError(project.topic);
    }

    this.store.updateState(id, "GENERATING_PROPOSALS");

    // 3. Generación con Groq
    const availableSpeakers = autoCast(project.topic, claims.length > 0, project.config.comerciales.enabled);
    let partialProposal: Partial<Proposal>;
    try {
      const analysis = await this.llm.analyzeTopic(project.topic, claimsFlat(claims));
      const evaluation = await this.llm.evaluateEvidence(project.topic, claimsFlat(claims));

      partialProposal = await this.llm.createProposal({
        topic: project.topic,
        enfoque: analysis.enfoque,
        coverageSummary: coverageFlat(coverage),
        claimsFlat: claimsFlat(claims),
        duracionMin: guiaMinutos(project.config),
        nivel: project.config.nivel,
        comerciales: project.config.comerciales,
        participants: availableSpeakers,
      });

      // Validar contra Quality Gate de propuesta
      let qualityCheck = evaluateProposalQuality(project.topic, partialProposal, research);
      if (!qualityCheck.valid) {
        // Intento de reparación focalizada con Groq
        partialProposal = await this.llm.createProposal({
          topic: project.topic,
          enfoque: `${analysis.enfoque}. REQUERIMIENTO EDITORIAL ESTRICTO: debe abordar obligatoriamente: ${qualityCheck.issues.join("; ")}`,
          coverageSummary: coverageFlat(coverage),
          claimsFlat: claimsFlat(claims),
          duracionMin: guiaMinutos(project.config),
          nivel: project.config.nivel,
          comerciales: project.config.comerciales,
          participants: availableSpeakers,
        });
        qualityCheck = evaluateProposalQuality(project.topic, partialProposal, research);
        if (!qualityCheck.valid) {
          throw new ProposalGenerationFailedError(`Propuesta no superó el Quality Gate: ${qualityCheck.issues.join("; ")}`);
        }
      }

      const participantesNormalizados = normalizeParticipantes(partialProposal.participantes) ??
        availableSpeakers.map((id) => {
          const s = DEFAULT_SPEAKERS.find((x) => x.id.toUpperCase() === id.toUpperCase());
          return { id: s?.id ?? id, nombre: s?.nombre ?? id, rol: s?.rol ?? "participante", funcionEditorial: s?.funcionEditorial ?? null, voz: s?.voz ?? voiceSlotForSpeaker(id), participa: true };
        });

      const fullProposal: Proposal = {
        topic: project.topic,
        enfoque: partialProposal.enfoque ?? `Análisis normativo y práctico sobre ${project.topic}`,
        formato: partialProposal.formato ?? EditorialFormatSchema.parse(autoFormat(project.topic)),
        nivel: (partialProposal.nivel as "informativo" | "natural" | "dinamico") ?? project.config.nivel,
        duracionEstimadaMin: partialProposal.duracionEstimadaMin ?? guiaMinutos(project.config),
        participantes: participantesNormalizados,
        estructura: partialProposal.estructura ?? [
          { seccion: "Apertura", proposito: "Presentar el tema y su impacto laboral." },
          { seccion: "Fundamento normativo", proposito: "Explicar los artículos y cláusulas aplicables." },
          { seccion: "Aplicación y cierre", proposito: "Pasos concretos para ejercer el derecho." },
        ],
        fuentes: partialProposal.fuentes ?? claims.slice(0, 6).map((c) => c.evidence[0]?.document ?? "").filter(Boolean),
        cobertura: coverage,
        huecos: [...new Set([...(partialProposal.huecos ?? []), ...(evaluation?.faltantes ?? []), ...(coverage?.missing ?? [])])],
        advertencias: [...new Set([...(partialProposal.advertencias ?? []), ...(evaluation?.advertencias ?? []), ...(coverage?.warnings ?? [])])],
        publicable: partialProposal.publicable ?? coverage.recommended,
        comerciales: [],
        decisionRationale: ["Propuesta editorial generada íntegramente por Groq y validada por Quality Gate"],
        createdAt: new Date().toISOString(),
      };

      this.store.writeProposal(id, fullProposal);
      const next = this.store.update(id, { proposal: fullProposal, state: "PROPOSAL_READY" })!;
      return { project: next, proposal: fullProposal };
    } catch (e) {
      this.store.updateState(id, "PROPOSAL_GENERATION_FAILED");
      if (e instanceof ProposalGenerationFailedError || e instanceof InsufficientEvidenceError || e instanceof GroqUnavailableError) {
        throw e;
      }
      throw new ProposalGenerationFailedError(e instanceof Error ? e.message : String(e));
    }
  }

  async createProposalVariant(id: string): Promise<{ project: Project; proposal: Proposal }> {
    return this.createProposal(id);
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

  /**
   * Genera el guion mediante el pipeline multipass de Groq.
   * Sin fallback determinista ni fallback a modelos locales.
   */
  async generateScript(id: string): Promise<{ project: Project; script: Script; verify: VerifyResult }> {
    const project = this.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const proposal = project.proposal;
    const research = this.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!proposal || !research) throw new Error("PROPOSAL_OR_RESEARCH_REQUIRED");

    // 1. Salud del motor Groq
    const available = await this.llm.isAvailable();
    if (!available) {
      this.store.updateState(id, "SCRIPT_GENERATION_FAILED");
      throw new GroqUnavailableError("El motor editorial no está disponible.");
    }

    this.store.updateState(id, "SCRIPT_GENERATING");

    const claims = research.claims.map((c) => ({
      id: c.id, texto: c.statement, documento: c.evidence[0]?.document ?? "",
      clausula: c.evidence[0]?.clause ?? null, articulo: c.evidence[0]?.article ?? null, pagina: c.evidence[0]?.page ?? null,
    }));

    const speakers = participantsToSpeakers((proposal.participantes ?? []).map((p) => p.id), project.config.comerciales.enabled);
    const nivel = proposal.nivel as "informativo" | "natural" | "dinamico";
    const duracionMin = proposal.duracionEstimadaMin;

    const pack2 = buildEvidencePackV2(`p-${id}`, project.topic, claims, research.cutoff);
    const artifactsDir = this.store.artifactPaths(id).logsDir;

    // 2. Ejecución estricta con Groq Pipeline
    let pipelineResult;
    try {
      pipelineResult = await new ScriptPipeline().run({
        tema: project.topic,
        duracionMin,
        speakers,
        nivel,
        claims,
        cutoff: research.cutoff,
        fuentes: research.documents.map((d) => ({ id: d.sourceId, title: d.title, versionLabel: d.versionLabel ?? "", sha256: d.sha256 ?? "" })),
        modoCita: "natural",
        evidencePack: pack2,
        artifactsDir,
      });
    } catch (e) {
      this.store.updateState(id, "SCRIPT_GENERATION_FAILED");
      throw new GroqGenerationFailedError("generación de guion", e);
    }

    if (!pipelineResult?.turns || pipelineResult.turns.length < 4) {
      this.store.updateState(id, "SCRIPT_GENERATION_FAILED");
      throw new ScriptQualityFailedError(["El guion devuelto por Groq no cuenta con suficientes turnos"]);
    }

    let script: EpisodeScript = {
      tema: project.topic,
      duracionMin,
      speakers,
      nivel,
      claims,
      cutoff: research.cutoff,
      fuentes: research.documents.map((d) => ({ id: d.sourceId, title: d.title, versionLabel: d.versionLabel ?? "", sha256: d.sha256 ?? "" })),
      modoCita: "natural",
      turns: pipelineResult.turns,
      scenes: groupScenes(pipelineResult.turns),
      estimacionDurSec: Math.round(pipelineResult.turns.reduce((a, t) => a + t.text.split(/\s+/).length / 2.6, 0)),
    };

    // Pulido de diálogo (estilo sin alterar hechos)
    const polished = polishDialogue(script);
    if (polished.lineasFactualesIntactas) script = polished.script;
    script = sanitizeEditorialScript(script).script;

    // Mapear al contrato de studio
    const studioScript: Script = mapEpisodeScriptToStudio(script, project);

    // Comerciales si aplican
    const selections = project.config.comerciales;
    const lib = this.commercials.list({ onlyActive: true });
    let placements: CommercialPlacement[] = [];
    if (selections.enabled && lib.length > 0) {
      const authorized = selections.ids.length > 0 ? lib.filter((c) => selections.ids.includes(c.id)) : lib;
      const chosen = authorized.length > 0 ? authorized : lib;
      placements = planCommercialPlacements(studioScript.turns.map((t) => ({ id: t.id, speaker: t.speaker, text: t.displayText, adSlot: t.adSlot })), selections, chosen);
      applyCommercials(studioScript, placements, chosen, this.commercials);
    }

    // 3. Verificación factual determinista
    const ctx: VerifierContext = {
      claims: research.claims,
      sources: new Map(research.documents.map((d) => [d.sourceId, d.document])),
      speakers: new Set(speakers.map((s) => s.id.toUpperCase())),
    };
    const verify = verifyScript(studioScript, ctx);

    // Si hay fallas de verificación factual, se detiene o repara con Groq.
    // NUNCA degradar a texto determinista.
    if (!verify.verified) {
      this.store.writeScript(id, studioScript);
      this.store.updateState(id, "SCRIPT_QUALITY_FAILED");
      throw new ScriptQualityFailedError(verify.issues.map((i) => `${i.turnId}: ${i.detail}`));
    }

    this.store.writeScript(id, studioScript);
    this.store.writeCommercials(id, placements);
    const next = this.store.update(id, { script: studioScript, state: "SCRIPT_READY" })!;
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
    if (!project.script) throw new ProductionBlockedError("El proyecto no tiene un guion listo");

    // Validar estado previo a producción:
    // Exigir SCRIPT_READY o SCRIPT_APPROVED, más verificación aprobada
    if (project.state !== "SCRIPT_APPROVED" && project.state !== "SCRIPT_READY" && project.state !== "PRODUCING" && project.state !== "MASTERING" && project.state !== "DONE") {
      throw new ProductionBlockedError(`Estado ${project.state} no permite producción.`);
    }

    const verify = await this.verify(id);
    if (!verify.verified) {
      throw new ProductionBlockedError(`El guion tiene afirmaciones no verificadas (${verify.issues.length} observaciones).`);
    }

    if (project.state === "PRODUCING" || project.state === "MASTERING" || project.state === "DONE") {
      return this.store.update(id, { state: "PRODUCING" })!;
    }
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
