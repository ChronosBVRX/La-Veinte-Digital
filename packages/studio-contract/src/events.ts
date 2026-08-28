/**
 * Eventos SSE de progreso y errores amigables (nunca exponer CUDA/SIGKILL/seeds
 * a un usuario novato; el mensaje técnico vive en `technical`).
 */
import { z } from "zod";

export const PROGRESS_EVENT_TYPES = [
  "project.created",
  "state.changed",
  "research.started",
  "research.progress",
  "research.completed",
  "proposal.ready",
  "proposal.approved",
  "script.started",
  "script.completed",
  "script.verified",
  "production.started",
  "production.turn.started",
  "production.turn.retry",
  "production.turn.completed",
  "production.completed",
  "master.started",
  "master.completed",
  "error",
] as const;
export type ProgressEventType = (typeof PROGRESS_EVENT_TYPES)[number];

export const ProgressEventSchema = z.object({
  type: z.enum(PROGRESS_EVENT_TYPES),
  projectId: z.string(),
  ts: z.string(),
  data: z.unknown().optional(),
});
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

export const STUDIO_ERROR_CODES = [
  "QWEN_HARD_TIMEOUT",
  "QWEN_QA_FAIL",
  "VOICE_REFERENCE_INVALID",
  "FACT_WITHOUT_EVIDENCE",
  "UNSUPPORTED_NUMERIC_CLAIM",
  "INVENTED_SOURCE",
  "COMMERCIAL_FIREWALL",
  "NO_FORCE_CAST",
  "HUMAN_REVIEW_REQUIRED",
  "MEDIA_FORBIDDEN",
  "MOTOR_UNAVAILABLE",
  "LOCAL_LIBRARY_UNAVAILABLE",
  "UNKNOWN",
] as const;
export type StudioErrorCode = (typeof STUDIO_ERROR_CODES)[number];

export const StudioErrorSchema = z.object({
  code: z.enum(STUDIO_ERROR_CODES),
  message: z.string(),
  /** Mensaje humanizado para el usuario novato. */
  userMessage: z.string().nullable().optional(),
  /** Detalle técnico solo para modo estudio. */
  technical: z.unknown().nullable().optional(),
  turnId: z.string().nullable().optional(),
});
export type StudioError = z.infer<typeof StudioErrorSchema>;
