/**
 * Proyecto de episodio — contenedor raíz persistente.
 */
import { z } from "zod";
import { ProjectStateSchema, InteractionLevelSchema, type ProjectState } from "./state";
import { ResearchBundleSchema, type ResearchBundle } from "./research";
import { ProposalSchema, type Proposal } from "./proposal";
import { ScriptSchema, type Script } from "./script";
import { ProductionStateSchema, MasterResultSchema, type ProductionState, type MasterResult } from "./production";
import { CommercialSelectionSchema, type CommercialSelection } from "./commercial";

export const PROFUNDIDADES = ["breve", "estandar", "profundo"] as const;
export type Profundidad = (typeof PROFUNDIDADES)[number];
export const ProfundidadSchema = z.enum(PROFUNDIDADES);

/** Duración objetivo (aproximada) por profundidad — es una guía, nunca un tope. */
export const PROFUNDIDAD_MIN: Record<Profundidad, number> = {
  breve: 8,
  estandar: 15,
  profundo: 25,
};

export const PROFUNDIDAD_LABELS: Record<Profundidad, string> = {
  breve: "Breve — lo esencial",
  estandar: "Estándar — buen balance",
  profundo: "A fondo — explicación completa",
};

export const ProjectConfigSchema = z.object({
  duracionMin: z.number().default(15),
  profundidad: ProfundidadSchema.default("estandar"),
  nivel: InteractionLevelSchema.default("natural"),
  contextoExtra: z.string().default(""),
  modo: z.enum(["determinista", "ia"]).default("ia"),
  comerciales: CommercialSelectionSchema,
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  topic: z.string(),
  state: ProjectStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  config: ProjectConfigSchema,
  research: ResearchBundleSchema.nullable().optional(),
  proposal: ProposalSchema.nullable().optional(),
  script: ScriptSchema.nullable().optional(),
  production: ProductionStateSchema.nullable().optional(),
  master: MasterResultSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;
export type { ProjectState, ResearchBundle, Proposal, Script, ProductionState, MasterResult, CommercialSelection };

/** Piezas del proyecto guardadas por separado bajo data/projects/<id>/. */
export const PROJECT_ARTIFACTS = [
  "project.json",
  "research.json",
  "claims.json",
  "coverage.json",
  "proposal.json",
  "script.json",
  "production.json",
  "commercials.json",
  "master.json",
  "logs.json",
] as const;
export type ProjectArtifact = (typeof PROJECT_ARTIFACTS)[number];
