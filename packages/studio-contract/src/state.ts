/**
 * Estados y formatos compartidos del proyecto de episodio.
 * Frontend, sidecar y persistencia usan la MISMA definición.
 */
import { z } from "zod";

export const PROJECT_STATES = [
  "DRAFT",
  "RESEARCHING",
  "RESEARCHED",
  "PROPOSAL_READY",
  "PROPOSAL_APPROVED",
  "SCRIPT_GENERATING",
  "SCRIPT_READY",
  "SCRIPT_APPROVED",
  "PRODUCING",
  "NEEDS_REVIEW",
  "MASTERING",
  "DONE",
  "FAILED",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

export const ProjectStateSchema = z.enum(PROJECT_STATES);

export const EDITORIAL_FORMATS = [
  "EXPLICADOR",
  "CASO_PRACTICO",
  "CONSULTORIO",
  "GUIA_PASO_A_PASO",
  "DEBATE",
  "BOLETIN",
  "ENTREVISTA_SIMULADA",
] as const;

export type EditorialFormat = (typeof EDITORIAL_FORMATS)[number];

export const EditorialFormatSchema = z.enum(EDITORIAL_FORMATS);

export const INTERACTION_LEVELS = ["informativo", "natural", "dinamico"] as const;
export type InteractionLevel = (typeof INTERACTION_LEVELS)[number];
export const InteractionLevelSchema = z.enum(INTERACTION_LEVELS);

export const NIVEL_LABELS: Record<string, string> = {
  informativo: "Tranquilo y claro",
  natural: "Conversación natural",
  dinamico: "Ágil y movido",
};

export const FORMAT_LABELS: Record<string, string> = {
  EXPLICADOR: "Explicador",
  CASO_PRACTICO: "Caso práctico",
  CONSULTORIO: "Consultorio",
  GUIA_PASO_A_PASO: "Guía paso a paso",
  DEBATE: "Debate",
  BOLETIN: "Boletín",
  ENTREVISTA_SIMULADA: "Entrevista simulada",
};

export const ESTUDIO_STATES = [
  "IDLE",
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "CACHE_REUSE",
  "NEEDS_REVIEW",
  "DONE",
  "FAILED",
] as const;
export type StudioState = (typeof ESTUDIO_STATES)[number];

/** Pares de producción (solo Estado -> Estado permitido). */
export const STEP_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  DRAFT: ["RESEARCHING"],
  RESEARCHING: ["RESEARCHED", "FAILED", "DRAFT"],
  RESEARCHED: ["RESEARCHING", "PROPOSAL_READY", "DRAFT"],
  PROPOSAL_READY: ["RESEARCHED", "PROPOSAL_APPROVED"],
  PROPOSAL_APPROVED: ["PROPOSAL_READY", "SCRIPT_GENERATING"],
  SCRIPT_GENERATING: ["SCRIPT_READY", "FAILED", "PROPOSAL_APPROVED"],
  SCRIPT_READY: ["SCRIPT_GENERATING", "SCRIPT_APPROVED", "NEEDS_REVIEW"],
  SCRIPT_APPROVED: ["SCRIPT_READY", "PRODUCING"],
  PRODUCING: ["SCRIPT_APPROVED", "NEEDS_REVIEW", "MASTERING", "DONE", "FAILED"],
  NEEDS_REVIEW: ["SCRIPT_READY", "PRODUCING"],
  MASTERING: ["PRODUCING", "DONE", "FAILED", "NEEDS_REVIEW"],
  DONE: [],
  FAILED: ["DRAFT"],
};
