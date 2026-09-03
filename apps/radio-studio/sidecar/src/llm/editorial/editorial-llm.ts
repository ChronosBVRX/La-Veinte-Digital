/**
 * LocalEditorialLLM — capa única de interacción editorial con el LLM activo.
 *
 * TODA llamada editorial pasa por aquí: análisis, evaluación de evidencia,
 * propuesta, escaleta, escritura por sección, crítica, reparación y puentes.
 * El modelo (Groq o Ollama) es razonador/director/escritor; las fuentes de verdad
 * son el corpus, el Evidence Pack y el Claim Ledger.
 * Selección de proveedor: llm-factory.ts vía LLM_PROVIDER env var.
 */
import { z } from "zod";
import { type ILLMProvider } from "../local-llm";
import { getActiveLLMProvider } from "../llm-factory";
import {
  PRESETS,
  TOPIC_ANALYSIS,
  EVIDENCE_EVALUATION,
  PROPOSAL,
  OUTLINE,
  DIALOGUE,
  CRITIQUE,
  REPAIR,
  COMMERCIAL_BRIDGE,
  PROMPT_VERSION,
  type LLMPreset,
} from "./prompts";
import {
  ProposalSchema,
  type Proposal,
} from "@la-veinte/studio-contract";
import { acceptBridgeText } from "../../services/commercial-service";
import type { Commercial } from "@la-veinte/studio-contract";

//

const TopicAnalysisSchema = z.object({
  enfoque: z.string().min(10),
  preguntas: z.array(z.string()).min(1).max(8),
  subtemas: z.array(z.string()).min(1).max(6),
  riesgos: z.array(z.string()).max(6),
  publicable: z.boolean(),
});

const EvidenceEvaluationSchema = z.object({
  fuerte: z.array(z.string()).max(12),
  parcial: z.array(z.string()).max(12),
  faltantes: z.array(z.string()).max(10),
  preguntasSinResponder: z.array(z.string()).max(8),
  advertencias: z.array(z.string()).max(6),
});

const OutlineSchema = z.object({
  estructura: z.array(z.object({
    seccion: z.string().min(3),
    proposito: z.string().min(5),
    claimIds: z.array(z.string()).default([]),
  })).min(3).max(9),
});

const CriticSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    turnId: z.string(),
    severidad: z.enum(["baja", "media", "alta"]),
    defecto: z.string(),
    reparacion: z.string(),
  })).default([]),
});

const RepairSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

const BridgeSchema = z.object({
  bridgeIn: z.string().min(1),
  bridgeOut: z.string().min(1),
});

const LooseProposalSchema = z.object({
  enfoque: z.string().min(20),
  formato: z.enum(["EXPLICADOR", "CASO_PRACTICO", "CONSULTORIO", "GUIA_PASO_A_PASO", "DEBATE", "BOLETIN", "ENTREVISTA_SIMULADA"]),
  duracionEstimadaMin: z.number().min(5).max(90),
  participantes: z.array(z.object({
    id: z.string(), nombre: z.string(), rol: z.string(), funcionEditorial: z.string().nullable(), voz: z.string().nullable(), participa: z.boolean(),
  })).min(2).max(6),
  estructura: z.array(z.object({ seccion: z.string(), proposito: z.string(), notas: z.string().nullable() })).min(3).max(9),
  fuentes: z.array(z.string()).max(12),
  huecos: z.array(z.string()).max(12),
  advertencias: z.array(z.string()).max(8),
  publicable: z.boolean(),
});

export class LocalEditorialLLM {
  constructor(private llm: ILLMProvider) {}

  static create(repoRoot: string): LocalEditorialLLM {
    return new LocalEditorialLLM(getActiveLLMProvider(repoRoot));
  }

  get version(): string {
    return PROMPT_VERSION;
  }

  /** Alias para compatibilidad: devuelve info del proveedor activo */
  get providerInfo(): { provider: string; model: string } {
    return { provider: this.llm.provider, model: this.llm.model };
  }

  async isAvailable(): Promise<boolean> {
    const health = await this.llm.health();
    if (!health.ok) return false;
    // Para Groq: si llega aquí y tiene key, está disponible
    if (this.llm.provider === "groq") return true;
    // Para Ollama: verificar que el modelo esté instalado
    const ollamaLlm = this.llm as unknown as { listModels?: () => Promise<string[]>; cfg?: { model: string } };
    if (typeof ollamaLlm.listModels === "function") {
      const models = await ollamaLlm.listModels();
      const model = this.llm.model;
      return models.some((m: string) => m.startsWith(model.split(":")[0]));
    }
    return true;
  }

  async unload(): Promise<boolean> {
    // Solo Ollama tiene unload; Groq no necesita descarga de VRAM
    const ollamaLlm = this.llm as unknown as { unload?: () => Promise<boolean> };
    if (typeof ollamaLlm.unload === "function") {
      return ollamaLlm.unload();
    }
    return true;
  }

  private preset(p: LLMPreset): { temperature: number; task: string } {
    return PRESETS[p] ?? PRESETS.FACTUAL;
  }

  async analyzeTopic(topic: string, claimsFlat: string): Promise<{ enfoque: string; preguntas: string[]; subtemas: string[]; riesgos: string[]; publicable: boolean }> {
    const schema = this.toSchema(TopicAnalysisSchema);
    const preset = this.preset("FACTUAL");
    return this.llm.generateStructured({
      task: preset.task,
      system: TOPIC_ANALYSIS.system,
      user: `TEMA: ${topic}\n\nEVIDENCIA DEL CORPUS:\n${claimsFlat}`,
      jsonSchema: schema,
      validate: (raw) => TopicAnalysisSchema.parse(raw),
    });
  }

  async evaluateEvidence(topic: string, claimsFlat: string): Promise<{ fuerte: string[]; parcial: string[]; faltantes: string[]; preguntasSinResponder: string[]; advertencias: string[] }> {
    return this.llm.generateStructured({
      task: this.preset("FACTUAL").task,
      system: EVIDENCE_EVALUATION.system,
      user: `TEMA: ${topic}\n\nEVIDENCIA:\n${claimsFlat}`,
      jsonSchema: this.toSchema(EvidenceEvaluationSchema),
      validate: (raw) => EvidenceEvaluationSchema.parse(raw),
    });
  }

  async createProposal(input: {
    topic: string;
    enfoque: string | null;
    coverageSummary: string;
    claimsFlat: string;
    duracionMin: number;
    nivel: string;
    comerciales: { enabled: boolean; ids: string[]; interaccion: string; count: string } | null;
    participants: string[];
  }): Promise<Partial<Proposal>> {
    const preset = this.preset("DIRECTOR");
    const result = await this.llm.generateStructured({
      task: preset.task,
      system: PROPOSAL.system,
      user: `TEMA: ${input.topic}
DURACIÓN OBJETIVO: ${input.duracionMin} min
NIVEL: ${input.nivel}
ENFOQUE SUGERIDO: ${input.enfoque ?? "(por evaluar)"}
COBERTURA:
${input.coverageSummary}
HECHOS:
${input.claimsFlat}
PARTICIPANTES DISPONIBLES: ${input.participants.join(", ")}
COMERCIALES: ${input.comerciales?.enabled ? `activados (${input.comerciales.ids.join(", ") || "elija el Director"}, interacción ${input.comerciales.interaccion})` : "sin comerciales"}

Devuelve la propuesta: enfoque, formato, duración estimada, participantes necesarios, estructura por secciones, fuentes, y en 'huecos' lo que NO se puede afirmar. No inventes hechos.`,
      jsonSchema: this.toSchema(LooseProposalSchema),
      validate: (raw) => LooseProposalSchema.parse(raw) as Partial<Proposal>,
    });
    return result;
  }

  async createOutline(topic: string, claimsFlat: string, enfoque: string): Promise<{ estructura: Array<{ seccion: string; proposito: string; claimIds: string[] }> }> {
    return this.llm.generateStructured({
      task: this.preset("DIRECTOR").task,
      system: OUTLINE.system,
      user: `TEMA: ${topic}\nENFOQUE: ${enfoque}\nHECHOS DISPONIBLES:\n${claimsFlat}\n\nDefine la escaleta por secciones.`,
      jsonSchema: this.toSchema(OutlineSchema),
      validate: (raw) => OutlineSchema.parse(raw),
    });
  }

  async writeSection(input: {
    topic: string;
    seccion: string;
    proposito: string;
    claims: string;
    speakers: string;
    memory: string;
    comercial: string | null;
  }): Promise<Array<{ speaker: string; text: string }>> {
    const schema = z.array(z.object({ speaker: z.string(), text: z.string().min(1) })).min(2);
    return this.llm.generateStructured({
      task: this.preset("DIALOGUE").task,
      system: DIALOGUE.system,
      user: `TEMA: ${input.topic}
SECCIÓN: ${input.seccion}
PROPÓSITO: ${input.proposito}
HECHOS PERMITIDOS (solo esto):
${input.claims}
LOCUTORES: ${input.speakers}
MEMORIA EDITORIAL PREVIA:
${input.memory}
${input.comercial ? `CONTEXTO COMERCIAL: ${input.comercial}\n` : ""}
Escribe de 6 a 14 turnos conversacionales para esta sección. Cada turno: {"speaker":"...","text":"..."}.`,
      jsonSchema: this.toSchema(schema),
      validate: (raw) => schema.parse(raw),
    });
  }

  async critiqueSection(turns: Array<{ id: string; speaker: string; text: string }>): Promise<{ score: number; issues: Array<{ turnId: string; severidad: string; defecto: string; reparacion: string }> }> {
    return this.llm.generateStructured({
      task: this.preset("DIALOGUE").task,
      system: CRITIQUE.system,
      user: `GUION A CRITICAR:\n${JSON.stringify(turns)}`,
      jsonSchema: this.toSchema(CriticSchema),
      validate: (raw) => CriticSchema.parse(raw),
    });
  }

  async repairTurn(input: {
    prev: string;
    turno: string;
    next: string;
    error: string;
    claims: string;
    speaker: string;
    tone: string;
  }): Promise<{ id: string; text: string }> {
    const result = await this.llm.generateStructured({
      task: this.preset("REPAIR").task,
      system: REPAIR.system,
      user: `TURNO PREVIO: ${input.prev}
TURNO A REPARAR: ${input.turno}
TURNO SIGUIENTE: ${input.next}
MOTIVO: ${input.error}
HECHOS PERMITIDOS:
${input.claims}
LOCUTOR: ${input.speaker}
TONO: ${input.tone}
Reescribe exactamente este turno. Devuelve {"id":... ,"text":"..."}.`,
      jsonSchema: this.toSchema(RepairSchema),
      validate: (raw) => RepairSchema.parse(raw),
      useCache: false,
    });
    return result;
  }

  async generateCommercialBridge(input: {
    topic: string;
    topicBefore: string;
    topicAfter: string;
    commercial: Commercial;
    interaction: "natural" | "entry_exit" | "none";
  }): Promise<{ bridgeIn: string; bridgeOut: string; commercialText: string; firewallPassed: boolean }> {
    const preset = this.preset("DIALOGUE");
    const bridge = await this.llm.generateStructured({
      task: preset.task,
      system: COMMERCIAL_BRIDGE.system,
      user: `TEMA: ${input.topic}\nTEMA ANTES: ${input.topicBefore}\nTEMA DESPUÉS: ${input.topicAfter}\nVOZ: ${input.commercial.presenter}\n\nDevuelve bridgeIn y bridgeOut. Solo dos líneas cortas, sin contenido normativo.`,
      jsonSchema: this.toSchema(BridgeSchema),
      validate: (raw) => BridgeSchema.parse(raw),
    });
    // Firewall: si el LLM cruza, se sustituye por el bridge determinista seguro.
    const accepted = acceptBridgeText(
      { commercialId: input.commercial.id, topicBefore: input.topicBefore, topicAfter: input.topicAfter, speakerBefore: "", speakerAfter: "", interactionMode: input.interaction, placementReason: "" },
      { bridgeIn: bridge.bridgeIn, bridgeOut: bridge.bridgeOut, commercialText: input.commercial.baseText }
    );
    return {
      bridgeIn: accepted.bridgeIn ?? "",
      bridgeOut: accepted.bridgeOut ?? "",
      commercialText: accepted.commercialText ?? input.commercial.baseText,
      firewallPassed: accepted.firewallPassed,
    };
  }

  private toSchema(schema: z.ZodType): object {
    return z.toJSONSchema(schema, { io: "input" }) as object;
  }
}
