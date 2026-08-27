/**
 * Propuesta editorial — se presenta ANTES del guion y debe aprobarse.
 */
import { z } from "zod";
import { EditorialFormatSchema, InteractionLevelSchema } from "./state";
import { CoverageSchema } from "./research";
import { CommercialPlacementSchema } from "./commercial";

export const ParticipantSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  rol: z.string(),
  funcionEditorial: z.string().nullable().optional(),
  voz: z.string().nullable().optional(),
  participa: z.boolean().default(true),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const ProposalSchema = z.object({
  topic: z.string(),
  enfoque: z.string(),
  formato: EditorialFormatSchema,
  nivel: InteractionLevelSchema.default("natural"),
  duracionEstimadaMin: z.number(),
  participantes: z.array(ParticipantSchema).default([]),
  estructura: z.array(z.object({
    seccion: z.string(),
    proposito: z.string(),
    notas: z.string().nullable().optional(),
  })).default([]),
  fuentes: z.array(z.string()).default([]),
  cobertura: CoverageSchema,
  huecos: z.array(z.string()).default([]),
  comerciales: z.array(CommercialPlacementSchema).default([]),
  advertencias: z.array(z.string()).default([]),
  publicable: z.boolean(),
  /** Cómo se decidió cada cosa (para trazabilidad). */
  decisionRationale: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
});
export type Proposal = z.infer<typeof ProposalSchema>;
