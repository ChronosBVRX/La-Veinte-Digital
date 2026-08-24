/**
 * Schemas Zod para las salidas estructuradas del pipeline multipasso.
 * Cada PASS valida su salida contra su schema; falla = SCHEMA_FAIL → reparación.
 */
import { z } from "zod";

export const AnalystReportSchema = z.object({
  centralQuestion: z.string().min(10),
  workerProblem: z.string().min(20),
  keyFacts: z.array(z.string()).min(2).max(12),
  normativeFindings: z.array(z.object({
    fact: z.string(),
    sourceIds: z.array(z.string()).min(1),
    certainty: z.enum(["alta", "media", "baja"]),
  })).min(1).max(8),
  uncertainties: z.array(z.string()).max(6),
  dangerousClaims: z.array(z.string()).max(6),
  questionsToAnswer: z.array(z.string()).min(2).max(8),
  recommendedAngle: z.string().min(10),
});

export const EpisodePlanSchema = z.object({
  scenes: z.array(z.object({
    id: z.string(),
    purpose: z.string().min(5),
    dramaticQuestion: z.string().min(5),
    factsIntroduced: z.array(z.string()),
    factsResolved: z.array(z.string()),
    sourcesRequired: z.array(z.string()),
    preferredSpeakers: z.array(z.enum(["EDUARDO", "ANDREA", "NARRADOR", "RODRIGO", "VALERIA"])),
  })).min(3).max(9),
});

export const ConversationDirectionSchema = z.object({
  turns: z.array(z.object({
    id: z.string(),
    sceneId: z.string(),
    speaker: z.enum(["EDUARDO", "ANDREA", "NARRADOR", "RODRIGO"]),
    intent: z.enum([
      "statement", "question", "answer", "reaction", "backchannel",
      "agreement", "disagreement", "interrupt_question", "interrupt_correction",
      "clarification", "example", "callback", "summary", "handoff",
      "normative_request", "normative_answer", "field_report",
    ]),
    respondsTo: z.string().nullable(),
    purpose: z.string().min(3),
    /** El modelo a veces responde escala 0-5; se normaliza después */
    energy: z.number().min(0).max(5),
    sourceIds: z.array(z.string()).default([]),
  })).min(6).max(120),
});

export const DialogueScriptSchema = z.object({
  turns: z.array(z.object({
    id: z.string(),
    text: z.string().min(1),
  })).min(6),
});

export interface NormativeIssue {
  turnId: string;
  severity: "critical" | "warning";
  type: "unsupported_claim" | "citation_mismatch" | "invented_source" | "norm_vs_recommendation";
  reason: string;
}

export const NormativeAuditSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.object({
    turnId: z.string(),
    severity: z.enum(["critical", "warning"]),
    type: z.enum([
      "unsupported_claim", "citation_mismatch", "invented_source",
      "norm_vs_recommendation",
      /** La fuente existe pero NO trata el tema del turno (ej. salario citado para horario) */
      "citation_hallucination",
      /** La fuente es parcialmente pertinente pero no fundamenta la afirmación concreta */
      "source_irrelevant_to_claim",
    ]),
    reason: z.string(),
    /** ¿El texto del documento implica realmente lo que el turno afirma? */
    citationEntailmentScore: z.number().min(0).max(1).optional(),
    /** ¿La fuente es pertinente al tema/problema del episodio? */
    citationRelevanceScore: z.number().min(0).max(1).optional(),
  })),
});

export const ConversationCritiqueSchema = z.object({
  conversationQualityScore: z.number().min(0).max(100),
  subscores: z.object({
    naturalness: z.number().min(0).max(100),
    coherence: z.number().min(0).max(100),
    turnVariety: z.number().min(0).max(100),
    interaction: z.number().min(0).max(100),
    speakerBalance: z.number().min(0).max(100),
    transitionQuality: z.number().min(0).max(100),
    nonRepetition: z.number().min(0).max(100),
    actionability: z.number().min(0).max(100),
  }),
  criticalIssues: z.array(z.object({ turnId: z.string(), issue: z.string() })),
  /** Cada issue trae instrucción de reparación concreta para el PASS 7. */
  issues: z.array(z.object({
    turnId: z.string(),
    issueType: z.enum([
      "generic_response", "unanswered_question", "quote_without_landing",
      "muletilla", "repeated_start", "semantic_repetition", "ignores_previous",
      "voice_change_without_reason", "monologue", "mechanical_transition",
      "missing_callback", "unnatural_phrasing", "other",
    ]),
    problema: z.string().min(10),
    evidencia: z.string(),
    esperabaEscuchar: z.string().min(5),
    repairInstruction: z.string().min(15),
    severidad: z.enum(["alta", "media"]).default("alta"),
  })).default([]),
});

export const RepairedTurnsSchema = z.object({
  turns: z.array(z.object({
    id: z.string(),
    text: z.string().min(1),
  })).min(1),
});
