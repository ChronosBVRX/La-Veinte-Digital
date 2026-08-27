/**
 * Comerciales — biblioteca, selección, colocación contextual y firewall.
 * Valeria solo comercia: nunca interpreta normativa ni crea hechos jurídicos.
 */
import { z } from "zod";

export const COMMERCIAL_TYPES = ["COMMERCIAL", "INSTITUTIONAL"] as const;
export type CommercialType = (typeof COMMERCIAL_TYPES)[number];
export const CommercialTypeSchema = z.enum(COMMERCIAL_TYPES);

export const COMMERCIAL_STATES = ["active", "inactive", "archived"] as const;
export type CommercialState = (typeof COMMERCIAL_STATES)[number];
export const CommercialStateSchema = z.enum(COMMERCIAL_STATES);

export const INTERACTION_MODES = ["natural", "entry_exit", "none"] as const;
export type InteractionMode = (typeof INTERACTION_MODES)[number];
export const InteractionModeSchema = z.enum(INTERACTION_MODES);

export const CommercialSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: CommercialTypeSchema,
  description: z.string().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  targetDuration: z.number().default(30),
  presenter: z.string().default("VALERIA"),
  baseText: z.string(),
  asset: z.string().nullable().optional(),
  active: z.boolean().default(true),
  version: z.number().default(1),
  state: CommercialStateSchema.default("active"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Commercial = z.infer<typeof CommercialSchema>;

export const CommercialSelectionSchema = z.object({
  enabled: z.boolean().default(false),
  /** Ids de la biblioteca autorizados por el usuario. */
  ids: z.array(z.string()).default([]),
  /** Permitir que el Director elija entre los autorizados. */
  allowDirectorChoice: z.boolean().default(true),
  count: z.enum(["auto", "1", "2", "3"]).default("auto"),
  ubicacion: z.enum(["auto", "manual"]).default("auto"),
  interaccion: InteractionModeSchema.default("natural"),
  duracionSec: z.number().default(30),
});
export type CommercialSelection = z.infer<typeof CommercialSelectionSchema>;

export const CommercialPlacementSchema = z.object({
  commercialId: z.string(),
  topicBefore: z.string(),
  topicAfter: z.string(),
  speakerBefore: z.string(),
  speakerAfter: z.string(),
  interactionMode: InteractionModeSchema.default("natural"),
  placementReason: z.string().nullable().optional(),
  /** Índice (posición del bloque) dentro del guion. */
  atIndex: z.number().nullable().optional(),
});
export type CommercialPlacement = z.infer<typeof CommercialPlacementSchema>;

export const BridgeGeneratorResultSchema = z.object({
  bridgeIn: z.string().nullable().optional(),
  bridgeOut: z.string().nullable().optional(),
  commercialText: z.string().nullable().optional(),
  placement: CommercialPlacementSchema,
  firewallPassed: z.boolean().default(true),
});
export type BridgeGeneratorResult = z.infer<typeof BridgeGeneratorResultSchema>;

/** Firewall: regla que Valeria no puede cruzar. */
export const FirewallViolationSchema = z.object({
  turnId: z.string(),
  regla: z.string(),
  detalle: z.string(),
});
export type FirewallViolation = z.infer<typeof FirewallViolationSchema>;
