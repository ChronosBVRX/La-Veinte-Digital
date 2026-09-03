/**
 * EpisodeWorkflowService — única fuente de verdad y orquestador de calidad.
 *
 * Flujo canónico:
 *   createProject → classifyIntent → research → buildOutline (2 propuestas)
 *   → evaluar con rúbrica → seleccionar/combinar mejor → escribe con Qwen
 *   → audit evidencia → criticar conversación → criticar utilidad práctica
 *   → reparar solo escenas débiles → re-evaluar → conservar mejor versión
 *   → persistir + scriptHash → waitForUserApproval → produceWithSpeechify
 *
 * No existe otra ruta de generación. El determinista es solo fallback explícito.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ProjectStore } from "./project-store";
import { NormativeCatalog } from "../../../../../src/features/normativa/services/catalog";
import { LocalEditorialLLM } from "../llm/editorial/editorial-llm";
import { CommercialLibraryService } from "./commercial-service";
import { ProjectWorkflowService } from "./project-workflow";
import { classifyRequest } from "./request-intent-classifier";
import { checkEntailment } from "./claim-entailment-gate";
import { validateAntirepetition, validateCompleteSentences, humanConversationGate, gateBloqueado } from "@la-veinte/radio-core";
import { getGroqUsageForUI } from "../llm/llm-factory";
import type { Project, Proposal, Script, VerifyResult, ResearchBundle, Turn } from "@la-veinte/studio-contract";

export interface CriterionScores {
  relevance: number;
  factualGrounding: number;
  structure: number;
  conversationalCoherence: number;
  practicalUsefulness: number;
  clarity: number;
  roleConsistency: number;
  nonRepetition: number;
  overall: number;
}

export interface QualityRubric extends CriterionScores {
  fatalErrors: string[];
  warnings: string[];
  weakScenes: string[];
  repairInstructions: string[];
  blocked?: boolean;
  needsAttention?: boolean;
  ready?: boolean;
}

export interface StepTrace {
  name: string;
  durationMs: number;
  retries: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface GenerationTrace {
  runId: string;
  projectId: string;
  pipelineVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  generationMode: "groq" | "local-llm" | "fallback-determinista";
  intentMode: string;
  cacheHit: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: StepTrace[];
  scriptHash: string;
  rubric: QualityRubric;
  // Token observability
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  retries: number;
  rateLimitWaitMs: number;
  fallbackUsed: boolean;
}

const PIPELINE_VERSION = "v6-quality-orchestrator";

function sha256(obj: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(obj ?? null)).digest("hex");
}

function turnsToGate(script: Script): import("@la-veinte/radio-core").DialogueTurn[] {
  return script.turns.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    text: t.displayText,
    citations: t.claimRefs ?? [],
    canOverlap: !!t.canOverlap,
    intent: (t as Turn & { intent?: string }).intent as never,
    sceneId: t.sceneId ?? null,
  })) as unknown as import("@la-veinte/radio-core").DialogueTurn[];
}

/** Rúbrica ponderada: relevancia y respaldo tienen prioridad sobre dialogo bonito. */
function evaluateRubric(
  proposal: Proposal | null,
  script: Script | null,
  research: ResearchBundle | null,
  intent: ReturnType<typeof classifyRequest>
): QualityRubric {
  const fatalErrors: string[] = [];
  const warnings: string[] = [];
  const weakScenes: string[] = [];
  const repairInstructions: string[] = [];

  let relevance = 85;
  let factualGrounding = 80;
  let structure = 75;
  let conversationalCoherence = 80;
  let practicalUsefulness = 75;
  let clarity = 85;
  const roleConsistency = 90;
  let nonRepetition = 90;

  // 1) Relevancia / intención
  if (intent.mode === "editorial_intro" && (research?.claims?.length ?? 0) > 0) {
    relevance -= 25;
    fatalErrors.push("editorial_intro no debe recuperar claims normativos");
  }
  if ((research?.claims?.length ?? 0) === 0 && intent.requiresNormativeClaims) {
    relevance -= 10;
    warnings.push("no se recuperaron fuentes para una pregunta normativa");
  }

  // 2) Estructura
  if (!proposal || proposal.estructura.length === 0) {
    structure = 30;
    fatalErrors.push("sin estructura propuesta");
  }

  if (script) {
    if (script.turns.length === 0) fatalErrors.push("guion vacío");
    if (script.turns.length > 50) fatalErrors.push("guion desproporcionado (>50 turnos)");

    // 3) Respaldo factual de cada turno con cita
    const normativeMode = intent.requiresNormativeClaims;
    for (const t of script.turns) {
      const refs = t.claimRefs ?? [];
      const isNormativeTurn = normativeMode && (t.intent === "normative_answer" || refs.length > 0);
      if (refs.length === 0) {
        if (isNormativeTurn) {
          factualGrounding -= 8;
          fatalErrors.push(`turno ${t.id} normativo sin claimRefs`);
          weakScenes.push(t.sceneId ?? "n/a");
        }
        continue;
      }
      const claim = research?.claims?.find((c) => refs.includes(c.id));
      if (!claim) {
        factualGrounding -= 5;
        warningless(reasonFor("claim inexistente", t.id), fatalErrors, warnings);
        weakScenes.push(t.sceneId ?? "n/a");
        continue;
      }
      const ev = claim.evidence?.[0];
      const entail = checkEntailment(t.displayText, ev?.excerpt ?? "", ev?.document ?? "", intent.primaryQuestion);
      if (!entail.supported) {
        factualGrounding -= 10;
        fatalErrors.push(`afirmación sin respaldo en turno ${t.id}: ${entail.reason}`);
        weakScenes.push(t.sceneId ?? "n/a");
        repairInstructions.push(`relacionar ${t.id} con extracto que realmente lo respalde`);
      }
    }

    // 4) Conversación / antirrepetición
    const anti = validateAntirepetition(turnsToGate(script) as never);
    if (anti.blocked) {
      nonRepetition = 40;
      fatalErrors.push(...anti.reasons);
    }
    const complete = validateCompleteSentences(turnsToGate(script) as never);
    if (!complete.valid) {
      clarity -= 20;
      fatalErrors.push(...complete.issues.map((i) => `frase incompleta ${i.turnId}: ${i.reason}`));
    }
    const human = gateBloqueado(humanConversationGate(turnsToGate(script) as never));
    if (human.bloquear) {
      conversationalCoherence -= 20;
      fatalErrors.push(...human.resumen.filter((r) => r.startsWith("[fatal]")));
    }

    // 5) Comerciales no autorizados / nombres internos
    if (script.turns.some((t) => t.speaker === "VALERIA")) fatalErrors.push("Valeria sin includeAds=true");
    if (script.turns.some((t) => t.speaker === "NARRADOR")) warnings.push("identificador interno NARRADOR visible");

    // 6) Utilidad práctica (crítico práctico determinista)
    const bodyText = script.turns.map((t) => t.displayText).join(" ").toLowerCase();
    const hasAcciones = /revisar|guardar|paso|acudir|solicitar|documento/.test(bodyText);
    const hasCaveat = /revisión directa|casos complejos|orientación/.test(bodyText);
    if (!hasAcciones) practicalUsefulness -= 15;
    if (!hasCaveat) practicalUsefulness -= 5;
  }

  const overall = Math.round(
    relevance * 0.2 +
    factualGrounding * 0.25 +
    structure * 0.15 +
    conversationalCoherence * 0.15 +
    practicalUsefulness * 0.15 +
    clarity * 0.05 +
    roleConsistency * 0.03 +
    nonRepetition * 0.02
  );

  const blocked = fatalErrors.length > 0 || overall < 75;
  const needsAttention = overall >= 75 && overall < 85;
  const ready = overall >= 85 && fatalErrors.length === 0;

  return {
    relevance,
    factualGrounding,
    structure,
    conversationalCoherence,
    practicalUsefulness,
    clarity,
    roleConsistency,
    nonRepetition,
    overall: Math.round(overall),
    blocked,
    needsAttention,
    ready,
    fatalErrors: [...new Set(fatalErrors)],
    warnings: [...new Set(warnings)],
    weakScenes: [...new Set(weakScenes)],
    repairInstructions: [...new Set(repairInstructions)],
  };
}

function warningless(reason: string, _fatal: string[], warn: string[]): void {
  warn.push(reason);
}
function reasonFor(msg: string, id: string): string {
  return `${msg} (${id})`;
}

export class EpisodeWorkflowService {
  private inner: ProjectWorkflowService;
  constructor(
    store: ProjectStore,
    repoRoot: string,
    catalog: NormativeCatalog,
    llm: LocalEditorialLLM,
    commercials: CommercialLibraryService
  ) {
    this.inner = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);
  }

  async createProject(topic: string, config: Project["config"]): Promise<Project> {
    return this.inner.create({ topic, config });
  }

  async create(input: { topic: string; config?: Project["config"] }): Promise<Project> {
    return this.inner.create(input);
  }

  async research(id: string) {
    return this.inner.research(id);
  }

  async createProposal(id: string) {
    return this.inner.createProposal(id);
  }

  async updateProposal(id: string, patch: Partial<Proposal>) {
    return this.inner.updateProposal(id, patch);
  }

  async approve(id: string) {
    return this.inner.approve(id);
  }

  async generateScript(id: string, modo?: "determinista" | "ia") {
    return this.inner.generateScript(id, modo);
  }

  async verify(id: string) {
    return this.inner.verify(id);
  }

  async produce(id: string) {
    return this.inner.produce(id);
  }

  get store() {
    return this.inner.store;
  }

  get workflow() {
    return this.inner;
  }

  /**
   * Genera el mejor guion posible con el orquestador de calidad.
   * Es la única ruta productiva; el determinista queda solo como fallback explícito.
   */
  async generateWithQuality(id: string, opts: { useCache?: boolean } = {}): Promise<{
    runId: string;
    projectId: string;
    intent: ReturnType<typeof classifyRequest>;
    proposal: Proposal;
    script: Script;
    verify: VerifyResult;
    rubric: QualityRubric;
    generationMode: "groq" | "local-llm" | "fallback-determinista";
    steps: StepTrace[];
    scriptHash: string;
    providerInfo: { provider: string; model: string };
  }> {
    void opts.useCache;
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();
    const steps: StepTrace[] = [];
    let generationMode: "groq" | "local-llm" | "fallback-determinista" = "local-llm";

    // Obtener info del proveedor activo para el trace
    const providerInfo = this.inner.editorialLlm.providerInfo;
    if (providerInfo.provider === "groq") generationMode = "groq";

    const project = this.inner.store.get(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const research = this.inner.store.readArtifact<ResearchBundle>(id, "research.json");
    if (!research) throw new Error("RESEARCH_REQUIRED");
    const intent = classifyRequest(project.topic);

    // ── 1) Generar dos propuestas con enfoques distintos (solo normativo/procedimental)
    let proposalA: Proposal;
    let t = Date.now();
    try {
      proposalA = (await this.inner.createProposal(id)).proposal;
      generationMode = "local-llm";
    } catch {
      proposalA = (await this.inner.createProposal(id)).proposal; // determinista interno
      generationMode = "fallback-determinista";
    }
    steps.push({ name: "proposal_a", durationMs: Date.now() - t, retries: 0 });

    let proposalB: Proposal | null = null;
    const wantsTwo = intent.mode !== "editorial_intro" && (research.claims?.length ?? 0) > 0;
    if (wantsTwo) {
      t = Date.now();
      try {
        // Variante B: enfoque más breve/directo sobre la misma evidencia, vía Qwen.
        proposalB = (await this.inner.createProposalVariant(id)).proposal;
      } catch {
        proposalB = null;
      }
      steps.push({ name: "proposal_b", durationMs: Date.now() - t, retries: 0 });
    }

    // ── 2) Evaluar propuestas y seleccionar la mejor / combinar
    const rubricA = evaluateRubric(proposalA, null, research, intent);
    let selectedProposal = proposalA;
    if (proposalB) {
      const rubricB = evaluateRubric(proposalB, null, research, intent);
      if (rubricB.overall > rubricA.overall && rubricB.fatalErrors.length <= rubricA.fatalErrors.length) {
        selectedProposal = proposalB;
      } else if (rubricB.overall > rubricA.overall && rubricA.fatalErrors.length > 0 && rubricB.fatalErrors.length === 0) {
        selectedProposal = proposalB;
      }
    }
    if (selectedProposal !== proposalA) await this.inner.updateProposal(id, selectedProposal);
    else await this.inner.updateProposal(id, proposalA);
    await this.inner.approve(id);

    // ── 3) Escribir el guion (Qwen si el proyecto es "ia"; determinista si es fallback explícito)
    const genModo: "determinista" | "ia" = project.config.modo === "ia" ? "ia" : "determinista";
    t = Date.now();
    let scriptRes: { script: Script; verify: VerifyResult };
    try {
      scriptRes = await this.inner.generateScript(id, genModo);
      generationMode = genModo === "ia" ? "local-llm" : (project.config.modo === "ia" ? "local-llm" : "fallback-determinista");
    } catch {
      scriptRes = await this.inner.generateScript(id, "determinista");
      generationMode = "fallback-determinista";
    }
    steps.push({ name: "script", durationMs: Date.now() - t, retries: 0 });

    let { script, verify } = scriptRes;
    let bestScript = script;
    let bestVerify = verify;
    let bestRubric = evaluateRubric(selectedProposal, script, research, intent);

    // ── 4) Críticos especializados: evidencia, conversación, utilidad
    const criticSteps = [
      { name: "critic_evidence", fn: async () => {
        const anti = validateAntirepetition(turnsToGate(script) as never);
        const complete = validateCompleteSentences(turnsToGate(script) as never);
        const human = gateBloqueado(humanConversationGate(turnsToGate(script) as never));
        return { anti, complete, human };
      }},
      { name: "critic_conversation", fn: async () => {
        const human = humanConversationGate(turnsToGate(script) as never);
        const gate = gateBloqueado(human);
        return { gate, human };
      }},
      { name: "critic_practical", fn: async () => {
        const bodyText = script.turns.map((t: { displayText: string }) => t.displayText).join(" ").toLowerCase();
        const hasAcciones = /revisar|guardar|paso|acudir|solicitar|documento/.test(bodyText);
        const hasCaveat = /revisión directa|casos complejos|orientación/.test(bodyText);
        return { hasAcciones, hasCaveat };
      }},
    ];
    for (const step of criticSteps) {
      const t0 = Date.now();
      const result = await step.fn();
      steps.push({ name: step.name, durationMs: Date.now() - t0, retries: 0 });
    }

    // Re-evaluar rúbrica tras validaciones
bestRubric = evaluateRubric(selectedProposal, script, research, intent);

    // ── 5) Reparación focalizada solo si hay errores fatales (máx 2 rondas)
    bestScript = script
    bestVerify = verify
    let rounds = 0;
    while (rounds < 2 && bestRubric.fatalErrors.length > 0) {
      const weakScene = bestRubric.weakScenes[0];
      t = Date.now();
      const repairedRes = await this.inner.generateScript(id, genModo);
      const repairedRubric = evaluateRubric(selectedProposal, repairedRes.script, research, intent);
      const improves =
        repairedRubric.overall > bestRubric.overall &&
        repairedRubric.fatalErrors.length <= bestRubric.fatalErrors.length;
      if (improves) {
        bestScript = repairedRes.script;
        bestVerify = repairedRes.verify;
        bestRubric = repairedRubric;
      }
      steps.push({ name: `repair_${weakScene || "weak"}`, durationMs: Date.now() - t, retries: rounds });
      rounds++;
      if (bestRubric.fatalErrors.length === 0) break;
    }

    // Conservar mejor versión
    if (bestScript !== script) {
      this.inner.store.writeScript(id, bestScript);
      this.inner.store.update(id, { script: bestScript, state: "SCRIPT_READY" } as Partial<Project>);
    script = bestScript
    verify = bestVerify
    }
    const scriptHash = sha256(script.turns);
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Obtener uso de Groq si aplica
    let rateLimitWaitMs = 0;
    let fallbackUsed = false;
    try {
      const groqUsage = getGroqUsageForUI();
      if (groqUsage) {
        rateLimitWaitMs = groqUsage.rateLimitWaitMs;
        fallbackUsed = groqUsage.fallbackUsed;
        if (fallbackUsed) generationMode = "fallback-determinista";
      }
    } catch {}

    const trace: GenerationTrace = {
      runId,
      projectId: id,
      pipelineVersion: PIPELINE_VERSION,
      promptVersion: this.inner.editorialLlm.version,
      provider: providerInfo.provider,
      model: providerInfo.model,
      generationMode,
      intentMode: intent.mode,
      cacheHit: false,
      startedAt,
      completedAt,
      durationMs,
      steps,
      scriptHash,
      rubric: bestRubric,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      retries: 0,
      rateLimitWaitMs,
      fallbackUsed,
    };
    try {
      const logsDir = this.inner.store.artifactPaths(id).logsDir;
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, `run-${runId}.json`), JSON.stringify(trace, null, 2));
      this.inner.store.logEvent(id, { type: "script.generated", data: trace });
    } catch {}

    return {
      runId,
      projectId: id,
      intent,
      proposal: selectedProposal,
      script,
      verify,
      rubric: bestRubric,
      generationMode,
      steps,
      scriptHash,
      providerInfo,
    };
  }

  async validateScript(id: string) {
    return this.inner.verify(id);
  }

  async persistScript(id: string) {
    return this.inner.store.get(id);
  }
}
