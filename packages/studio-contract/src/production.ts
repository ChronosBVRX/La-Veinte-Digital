/**
 * Estado de producción, master y progreso en tiempo real.
 */
import { z } from "zod";

export const PRODUCTION_STAGES = ["voces", "mezcla", "comerciales", "master", "qa", "done"] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];
export const ProductionStageSchema = z.enum(PRODUCTION_STAGES);

export const ProductionStateSchema = z.object({
  status: z.enum(["IDLE", "QUEUED", "RUNNING", "PAUSED", "CACHE_REUSE", "NEEDS_REVIEW", "DONE", "FAILED"]),
  stage: ProductionStageSchema.default("voces"),
  totalTurns: z.number().default(0),
  completedTurns: z.number().default(0),
  currentTurn: z.string().nullable().optional(),
  needsReview: z.array(z.string()).default([]),
  progress: z.number().min(0).max(100).default(0),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  engineRestarts: z.number().default(0),
  cacheHits: z.number().default(0),
});
export type ProductionState = z.infer<typeof ProductionStateSchema>;

export const MasterResultSchema = z.object({
  master: z.string().nullable().optional(),
  bytes: z.number().default(0),
  duraccionMs: z.number().default(0),
  formato: z.enum(["mp3", "wav"]).default("mp3"),
  kbps: z.number().nullable().optional(),
  turnos: z.number().default(0),
  needsReview: z.boolean().default(false),
  qa: z.unknown().nullable().optional(),
  mix: z.unknown().nullable().optional(),
});
export type MasterResult = z.infer<typeof MasterResultSchema>;

/** Clip producido (para cache/resume). */
export const ClipResultSchema = z.object({
  turnId: z.string(),
  speaker: z.string(),
  wav: z.string().nullable().optional(),
  durMs: z.number().nullable().optional(),
  status: z.enum(["PASS", "REUSE", "FAIL", "TIMEOUT", "HUMAN_REVIEW_REQUIRED"]).default("PASS"),
  qa: z.unknown().nullable().optional(),
  hash: z.string().nullable().optional(),
  voiceVersion: z.string().nullable().optional(),
  textHash: z.string().nullable().optional(),
  settingsHash: z.string().nullable().optional(),
  attempt: z.number().default(1),
});
export type ClipResult = z.infer<typeof ClipResultSchema>;
