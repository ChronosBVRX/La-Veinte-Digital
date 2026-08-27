/**
 * Guion y turnos. Cada turno conserva displayText (lo que lee el usuario) y
 * ttsText (lo que recibe el TTS, solo cambian números/siglas/pronunciación).
 * Toda afirmación factual normativa debe tener claimRefs.
 */
import { z } from "zod";
import { EditorialFormatSchema, InteractionLevelSchema } from "./state";

export const PAUSE_INTENTS = ["normal", "quick", "reflective", "interruption"] as const;
export type PauseIntent = (typeof PAUSE_INTENTS)[number];
export const PauseIntentSchema = z.enum(PAUSE_INTENTS);

export const SourceRefSchema = z.object({
  sourceId: z.string(),
  document: z.string(),
  section: z.string().nullable().optional(),
  article: z.string().nullable().optional(),
  clause: z.string().nullable().optional(),
  procedure: z.string().nullable().optional(),
  page: z.number().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  claimId: z.string().nullable().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const TurnSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  displayText: z.string(),
  ttsText: z.string().optional(),
  section: z.string().nullable().optional(),
  intent: z.string().nullable().optional(),
  pauseIntent: PauseIntentSchema.nullable().optional(),
  pauseBeforeMs: z.number().nullable().optional(),
  pauseAfterMs: z.number().nullable().optional(),
  canOverlap: z.boolean().default(false),
  energy: z.number().nullable().optional(),
  pace: z.string().nullable().optional(),
  claimRefs: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
  commercialContext: z.string().nullable().optional(),
  transition: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  adSlot: z.boolean().default(false),
  adDurationSec: z.number().nullable().optional(),
  sponsorName: z.string().nullable().optional(),
  sceneId: z.string().nullable().optional(),
  respondsTo: z.string().nullable().optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  turns: z.array(TurnSchema).default([]),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScriptSchema = z.object({
  topic: z.string(),
  formato: EditorialFormatSchema,
  nivel: InteractionLevelSchema.default("natural"),
  speakers: z.array(SourceRefSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  turns: z.array(TurnSchema).default([]),
  cutoff: z.string().nullable().optional(),
  estimacionDurSec: z.number().default(0),
  /** Memoria editorial para que un 9B mantenga coherencia sin 50 turnos en contexto. */
  memory: z.object({
    factsCovered: z.array(z.string()).default([]),
    claimsUsed: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    importantPointsRemaining: z.array(z.string()).default([]),
    lastSpeaker: z.string().nullable().optional(),
    tone: z.string().nullable().optional(),
    commercialsUsed: z.array(z.string()).default([]),
  }).optional(),
  generatedAt: z.string().optional(),
  promptVersion: z.string().nullable().optional(),
});
export type Script = z.infer<typeof ScriptSchema>;

/** Resultado del Verificador factual. */
export const VerifyIssueSchema = z.object({
  turnId: z.string(),
  code: z.enum([
    "FACT_WITHOUT_EVIDENCE",
    "UNSUPPORTED_NUMERIC_CLAIM",
    "INVENTED_SOURCE",
    "CLAIM_REF_MISSING",
    "COMMERCIAL_FIREWALL",
    "INVALID_SPEAKER",
    "OK",
  ]),
  detail: z.string(),
});
export type VerifyIssue = z.infer<typeof VerifyIssueSchema>;

export const VerifyResultSchema = z.object({
  verified: z.boolean(),
  totalClaims: z.number(),
  verifiedClaims: z.number(),
  sources: z.array(z.string()).default([]),
  issues: z.array(VerifyIssueSchema).default([]),
  estimatedDurSec: z.number().default(0),
});
export type VerifyResult = z.infer<typeof VerifyResultSchema>;
