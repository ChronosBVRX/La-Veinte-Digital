/**
 * Contratos canónicos de progreso de producción y operaciones por turno
 * para AI Radio Studio V1.1 — Wave Studio.
 * Single Source of Truth para frontend y sidecar.
 */
import { z } from "zod";

export const CANONICAL_PROGRESS_STATES = [
  "idle",
  "investigando",
  "generando_guion",
  "generando_voces",
  "mezclando_audio",
  "planificando_visuales",
  "renderizando_video",
  "exportando",
  "completado",
  "error",
  "cancelado",
] as const;
export type CanonicalProgressState = (typeof CANONICAL_PROGRESS_STATES)[number];
export const CanonicalProgressStateSchema = z.enum(CANONICAL_PROGRESS_STATES);

export const CANONICAL_PROGRESS_LABELS: Record<CanonicalProgressState, string> = {
  idle: "Listo para comenzar",
  investigando: "Consultando base normativa...",
  generando_guion: "Escribiendo guion a varias voces...",
  generando_voces: "Sintetizando voces de locución...",
  mezclando_audio: "Ensamblando master de audio y cortinillas...",
  planificando_visuales: "Generando storyboard Wave Premium...",
  renderizando_video: "Renderizando video reactivo a voz...",
  exportando: "Empaquetando entregables finales...",
  completado: "Episodio producido al 100%",
  error: "Producción detenida — requiere atención",
  cancelado: "Producción cancelada por el usuario",
};

export const PRODUCTION_PHASES = [
  "investigacion",
  "guion",
  "voces",
  "audio",
  "visual",
  "video",
  "exportacion",
] as const;
export type ProductionPhase = (typeof PRODUCTION_PHASES)[number];
export const ProductionPhaseSchema = z.enum(PRODUCTION_PHASES);

export interface StageWeights {
  investigacion: number;
  guion: number;
  voces: number;
  audio: number;
  visual: number;
  video: number;
  exportacion: number;
}

export const STAGE_WEIGHTS_AUDIO_VIDEO: StageWeights = {
  investigacion: 0.10,
  guion: 0.15,
  voces: 0.20,
  audio: 0.15,
  visual: 0.10,
  video: 0.25,
  exportacion: 0.05,
};

export const STAGE_WEIGHTS_AUDIO_ONLY: StageWeights = {
  investigacion: 0.15,
  guion: 0.25,
  voces: 0.30,
  audio: 0.25,
  visual: 0.00,
  video: 0.00,
  exportacion: 0.05,
};

/**
 * Cálculo determinista de porcentaje global basado en el formato y
 * el avance de cada fase (0..1).
 */
export function calculateOverallPercent(
  format: "audio_video" | "audio_only",
  phaseProgress: Partial<Record<ProductionPhase, number>>
): number {
  const weights = format === "audio_only" ? STAGE_WEIGHTS_AUDIO_ONLY : STAGE_WEIGHTS_AUDIO_VIDEO;
  let total = 0;
  for (const phase of PRODUCTION_PHASES) {
    const p = Math.max(0, Math.min(1, phaseProgress[phase] ?? 0));
    total += p * weights[phase];
  }
  return Math.round(Math.min(100, Math.max(0, total * 100)));
}

export const ProductionProgressCountsSchema = z.object({
  current: z.number(),
  total: z.number(),
  unit: z.string(),
});
export type ProductionProgressCounts = z.infer<typeof ProductionProgressCountsSchema>;

export const ProductionProgressTimingsSchema = z.object({
  startedAt: z.string().optional(),
  updatedAt: z.string(),
  estimatedRemainingSeconds: z.number().optional(),
  elapsedSeconds: z.number().default(0),
});
export type ProductionProgressTimings = z.infer<typeof ProductionProgressTimingsSchema>;

export const ProductionProgressErrorSchema = z.object({
  stage: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  actionSuggested: z.string(),
});
export type ProductionProgressError = z.infer<typeof ProductionProgressErrorSchema>;

export const ProductionProgressOutputsSchema = z.object({
  audioMasterPath: z.string().optional(),
  videoPath9x16: z.string().optional(),
  videoPath16x9: z.string().optional(),
  previewPath: z.string().optional(),
  folderPath: z.string(),
});
export type ProductionProgressOutputs = z.infer<typeof ProductionProgressOutputsSchema>;

export const EpisodeProductionProgressSchema = z.object({
  projectId: z.string(),
  state: CanonicalProgressStateSchema,
  phase: ProductionPhaseSchema,
  overallPercent: z.number().min(0).max(100),
  currentStagePercent: z.number().min(0).max(100),
  currentAction: z.string(),
  counts: ProductionProgressCountsSchema.optional(),
  timings: ProductionProgressTimingsSchema,
  format: z.enum(["audio_video", "audio_only"]),
  orientation: z.enum(["9:16", "16:9", "both"]).optional(),
  error: ProductionProgressErrorSchema.optional(),
  outputs: ProductionProgressOutputsSchema.optional(),
});
export type EpisodeProductionProgress = z.infer<typeof EpisodeProductionProgressSchema>;

export const TurnUpdatePayloadSchema = z.object({
  turnId: z.string(),
  speakerId: z.string().optional(),
  text: z.string().optional(),
  locked: z.boolean().optional(),
});
export type TurnUpdatePayload = z.infer<typeof TurnUpdatePayloadSchema>;

export const TurnRegeneratePayloadSchema = z.object({
  turnId: z.string(),
  context: z.string().optional(),
});
export type TurnRegeneratePayload = z.infer<typeof TurnRegeneratePayloadSchema>;

export const TurnAuditionPayloadSchema = z.object({
  turnId: z.string(),
});
export type TurnAuditionPayload = z.infer<typeof TurnAuditionPayloadSchema>;
